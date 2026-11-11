import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PILOTS, pilotRequest} from '../provider/pilots.mjs';
import {MAX_PHOTO_BYTES, SpicyAPI} from '../provider/spicy.mjs';

const plans = fileURLToPath(new URL('../.synthkiss-pilot/', import.meta.url));
const output = value => console.log(JSON.stringify(value, null, 2));

function printHelp() {
  console.log([
    'Usage: node --env-file=.env.synthkiss.local scripts/spicy-pilot.mjs <command>',
    '  presets                              List local pilot presets',
    '  models                               Check model access for the Synthkiss key',
    '  quote <preset> <test-photo>           Upload a reference and show a free bound quote',
    '  submit <plan-id> <approved-max-usd>   Confirm one paid task at the displayed price',
    '  status <job-id>                      Read status, cost and result URLs',
  ].join('\n'));
}

function planFile(id) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw new Error('Enter the quoted plan ID.');
  return join(plans, id + '.json');
}

async function main([command, ...args]) {
  if (!command || ['-h', '--help'].includes(command)) {
    printHelp();
    return;
  }
  if (command === 'presets' && args.length === 0) {
    output(Object.fromEntries(Object.entries(PILOTS).map(([name, pilot]) => [name, pilot.model])));
    return;
  }
  const arities = {models: 0, quote: 2, submit: 2, status: 1};
  if (!Object.hasOwn(arities, command) || args.length !== arities[command]) {
    throw new Error('Invalid pilot command. Run with --help.');
  }

  const client = new SpicyAPI(process.env.SYNTHKISS_SPICY_API_KEY);
  if (command === 'models') {
    const entries = Object.entries(PILOTS);
    const results = await Promise.allSettled(entries.map(([, pilot]) => client.assertModel(pilot)));
    output(results.map((result, index) => ({
      preset: entries[index][0], model: entries[index][1].model,
      available: result.status === 'fulfilled',
      ...(result.status === 'rejected' ? {error: result.reason.message} : {}),
    })));
    if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
    return;
  }
  if (command === 'quote') {
    const [preset, filename] = args;
    if (!Object.hasOwn(PILOTS, preset)) throw new Error('Unknown preset. Run presets for available names.');
    const info = await stat(filename);
    if (!info.isFile() || info.size === 0 || info.size > MAX_PHOTO_BYTES) {
      throw new Error('Choose a JPEG, PNG or WebP file up to 10 MiB.');
    }
    await client.assertModel(PILOTS[preset]);
    const photo = await client.uploadPhoto(await readFile(filename));
    const request = pilotRequest(preset, photo.uri);
    const quote = await client.quote(request);
    const id = randomUUID();
    const plan = {id, request, quote, photoExpiresAt: photo.expiresAt, keyFingerprint: await client.keyFingerprint()};
    await mkdir(plans, {recursive: true, mode: 0o700});
    await writeFile(planFile(id), JSON.stringify(plan), {flag: 'wx', mode: 0o600});
    output({preset, planId: id, model: quote.model, maxUsd: quote.maxCharge,
      expiresAt: new Date(Math.min(Date.parse(quote.expiresAt), Date.parse(photo.expiresAt))).toISOString()});
    return;
  }
  if (command === 'submit') {
    const [id, approvedUsd] = args;
    const plan = JSON.parse(await readFile(planFile(id), 'utf8'));
    if (plan.id !== id) throw new Error('Pilot plan does not match the quoted ID.');
    output(await client.submit(plan, approvedUsd));
    return;
  }
  output(await client.status(args[0]));
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
