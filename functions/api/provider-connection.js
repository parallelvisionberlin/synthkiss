import {PILOTS} from '../../provider/pilots.mjs';
import {SpicyAPI} from '../../provider/spicy.mjs';

const PREVIEW_HOST = 'synthkiss-provider-check.synthkiss.pages.dev';
const checks = new Map();

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'},
  });
}

async function connectionReport(client) {
  const fingerprint = await client.keyFingerprint();
  let check = checks.get(fingerprint);
  if (!check || check.expiresAt <= Date.now()) {
    // Coalesce concurrent checks and briefly cache failures as well as successes.
    const report = client.pilotAvailability(PILOTS)
      .then(models => ({connected: true, models, checkedAt: new Date().toISOString()}))
      .catch(error => ({connected: false, error: error.message, checkedAt: new Date().toISOString()}));
    checks.clear();
    check = {report, expiresAt: Date.now() + 60_000};
    checks.set(fingerprint, check);
  }
  return check.report;
}

export async function onRequest({request, env}) {
  if (new URL(request.url).hostname !== PREVIEW_HOST) return reply({error: 'Not found.'}, 404);
  if (request.method !== 'GET') return reply({error: 'Use GET.'}, 405);
  if (!env.SYNTHKISS_SPICY_API_KEY) return reply({error: 'The Preview secret is not configured.'}, 503);
  let client;
  try {
    client = new SpicyAPI(env.SYNTHKISS_SPICY_API_KEY);
  } catch {
    return reply({error: 'The Preview secret has an invalid API key format.'}, 503);
  }
  return reply(await connectionReport(client));
}
