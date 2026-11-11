const API = 'https://api.spicyapi.ai/api/v1';
const API_KEY = /^sk-spicy-[a-f0-9]{48}$/;
const FILE_ID = /^fil_[A-Za-z0-9_-]{8,128}$/;
const TASK_ID = /^job_[A-Za-z0-9_-]{8,128}$/;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const PROVIDER_ERRORS = {
  401: 'The Synthkiss API key is invalid, expired or revoked.',
  40201: 'The Synthkiss payer has insufficient available balance.',
  40202: 'A provider spend limit has been reached.',
  40301: 'This key is not permitted to call the selected model.',
  40302: 'The key IP restriction rejected this server.',
  40303: 'SpicyAPI rejected this backend region.',
  40901: 'The bound quote expired or changed. Review a fresh quote before generating.',
};

export function photoMime(bytes) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error('Choose a photo up to 10 MiB.');
  const ascii = new TextDecoder('ascii');
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (ascii.decode(bytes.subarray(0, 4)) === 'RIFF' && ascii.decode(bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  throw new Error('Choose a JPEG, PNG or WebP photo.');
}

export function usdMicros(value) {
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,6})?$/.test(value)) throw new Error('Expected a decimal USD amount.');
  const [dollars, cents = ''] = value.split('.');
  return Number(dollars) * 1_000_000 + Number(cents.padEnd(6, '0'));
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

function verifiedQuote(quote, model) {
  if (quote?.model !== model || quote.currency !== 'USD' ||
      typeof quote.quoteId !== 'string' || !quote.quoteId || quote.quoteId.length > 250 ||
      !(Date.parse(quote.expiresAt) > Date.now()) ||
      usdMicros(quote.maxCharge) < usdMicros(quote.estimatedCost)) {
    throw new Error('SpicyAPI did not return a current, bound USD quote.');
  }
  return {
    model, quoteId: quote.quoteId, estimatedCost: quote.estimatedCost,
    maxCharge: quote.maxCharge, currency: quote.currency, expiresAt: quote.expiresAt,
  };
}

function safeUploadTarget(uploadUrl) {
  const url = new URL(uploadUrl);
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !(host.endsWith('.spicyapi.ai') || host.endsWith('.r2.cloudflarestorage.com'))) {
    throw new Error('SpicyAPI returned an unexpected upload host.');
  }
  return url;
}

// Reusable server-side transport. The caller supplies its own project key.
export class SpicyAPI {
  #key;
  #fetch;

  constructor(key, fetchImpl = globalThis.fetch) {
    if (!API_KEY.test(key || '')) throw new Error('Set the dedicated SYNTHKISS_SPICY_API_KEY secret.');
    this.#key = key;
    this.#fetch = fetchImpl;
  }

  keyFingerprint() {
    return sha256Hex(new TextEncoder().encode(this.#key));
  }

  async #request(path, {method = 'GET', body, idempotencyKey} = {}) {
    const headers = new Headers({Authorization: 'Bearer ' + this.#key, Accept: 'application/json'});
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const paid = path === '/jobs/createTask';
    let response;
    let payload;
    try {
      response = await this.#fetch(API + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error', signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (paid) throw new Error('Submission is unconfirmed. Check SpicyAPI Logs before starting another job.');
      const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
      const reason = timedOut ? 'timed out' : 'failed at the network layer';
      throw new Error('SpicyAPI request ' + reason + ' for ' + path.split('?')[0] + '.');
    }
    try {
      payload = await response.json();
    } catch {
      if (paid) throw new Error('Submission is unconfirmed. Check SpicyAPI Logs before starting another job.');
      if (response?.status === 403) throw new Error('SpicyAPI refused this request before returning an API response (HTTP 403).');
      throw new Error('SpicyAPI returned a non-JSON response (HTTP ' + response.status + ') for ' + path.split('?')[0] + '.');
    }
    const code = Number(payload?.code);
    if (response.ok && code === 200 && payload.data != null) return payload.data;
    const reason = PROVIDER_ERRORS[code];
    if (paid && !reason && (response.status >= 500 || response.status === 408 || response.ok)) {
      throw new Error('Submission is unconfirmed. Check SpicyAPI Logs before starting another job.');
    }
    const providerCode = Number.isSafeInteger(code) ? code : response.status;
    throw new Error(`SpicyAPI (${providerCode}): ${reason || 'Request rejected.'}`);
  }

  async assertModel({model, imageField, multiple = false}) {
    const modelPath = model.split('/').map(encodeURIComponent).join('/');
    const live = await this.#request('/models/' + modelPath);
    if (live.model !== model || live.enabled !== true || live.available !== true) {
      throw new Error('Model unavailable for the Synthkiss key: ' + model);
    }
    const field = live.inputSchema?.properties?.[imageField];
    if (!field || field.type !== (multiple ? 'array' : 'string')) {
      throw new Error('Model input schema differs from the Synthkiss pilot: ' + model);
    }
  }

  async pilotAvailability(pilots) {
    const catalog = await this.#request('/models');
    if (!Array.isArray(catalog?.items)) throw new Error('SpicyAPI did not return a readable model catalog.');
    const models = new Map(catalog.items.map(item => [item.model, item]));
    return Object.entries(pilots).map(([preset, {model}]) => {
      const live = models.get(model);
      const enabled = live?.enabled === true;
      return {preset, enabled, available: enabled && live?.available === true};
    });
  }

  async uploadPhoto(bytes) {
    const contentType = photoMime(bytes);
    const ticket = await this.#request('/common/upload-url', {
      method: 'POST', body: {contentType, bytes: bytes.length},
    });
    if (!FILE_ID.test(ticket.fileId || '') || ticket.method !== 'PUT' ||
        !Number.isSafeInteger(ticket.maxBytes) || ticket.maxBytes < bytes.length ||
        !(Date.parse(ticket.expiresAt) > Date.now())) {
      throw new Error('SpicyAPI did not return a usable upload ticket.');
    }
    const target = safeUploadTarget(ticket.uploadUrl);
    const headers = new Headers(ticket.headers);
    if (headers.has('authorization') || headers.has('cookie') ||
        headers.get('content-type') !== contentType || headers.get('content-length') !== String(bytes.length)) {
      throw new Error('SpicyAPI upload headers do not match the photo.');
    }
    const response = await this.#fetch(target, {
      method: 'PUT', headers, body: bytes, redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`SpicyAPI could not receive the photo (HTTP ${response.status}).`);
    const file = await this.#request('/files/' + ticket.fileId + '/commit', {method: 'POST'});
    if (file.fileId !== ticket.fileId || file.status !== 'ready' ||
        file.uri !== 'spicy://f/' + ticket.fileId || file.bytes !== bytes.length ||
        file.contentType !== contentType || !(Date.parse(file.expiresAt) > Date.now()) ||
        typeof file.sha256 !== 'string' || file.sha256.toLowerCase() !== await sha256Hex(bytes)) {
      throw new Error('SpicyAPI did not verify the uploaded photo.');
    }
    return {uri: file.uri, expiresAt: file.expiresAt};
  }

  async quote(request) {
    return verifiedQuote(await this.#request('/jobs/quote', {method: 'POST', body: request}), request.model);
  }

  async submit(plan, approvedUsd) {
    if (!(Date.parse(plan.photoExpiresAt) > Date.now()) ||
        plan.keyFingerprint !== await this.keyFingerprint() ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(plan.id || '')) {
      throw new Error('The pilot plan is invalid, expired or bound to a different key.');
    }
    const quote = verifiedQuote(plan.quote, plan.request.model);
    if (usdMicros(approvedUsd) < usdMicros(quote.maxCharge)) {
      throw new Error('The quote is above the approved USD maximum.');
    }
    const result = await this.#request('/jobs/createTask', {
      method: 'POST', idempotencyKey: plan.id,
      body: {...plan.request, quoteId: quote.quoteId, expectedCost: quote.estimatedCost},
    });
    if (!TASK_ID.test(result.taskId || '')) {
      throw new Error('Submission is unconfirmed. Check SpicyAPI Logs before starting another job.');
    }
    return {taskId: result.taskId, state: result.state, deadlineAt: result.deadlineAt};
  }

  async status(taskId) {
    if (!TASK_ID.test(taskId || '')) throw new Error('Enter a SpicyAPI job ID.');
    const result = await this.#request('/jobs/recordInfo?taskId=' + encodeURIComponent(taskId));
    return {
      taskId, state: result.state, settled: result.settled, cost: result.cost,
      errorCode: result.errorCode, assets: result.output?.assets?.map(asset => asset.url),
    };
  }
}
