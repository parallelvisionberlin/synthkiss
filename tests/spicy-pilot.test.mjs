import assert from 'node:assert/strict';
import test from 'node:test';
import {PILOTS, pilotRequest} from '../provider/pilots.mjs';
import {SpicyAPI, photoMime, sha256Hex} from '../provider/spicy.mjs';

const key = 'sk-spicy-' + 'a'.repeat(48);
const photo = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const fileId = 'fil_fixture123';
const fileUri = 'spicy://f/' + fileId;
const taskId = 'job_fixture123';
const preset = PILOTS['night-flash'];
const request = pilotRequest('night-flash', fileUri);
const future = () => new Date(Date.now() + 4 * 60_000).toISOString();
const envelope = data => Response.json({code: 200, data});
const ticket = overrides => ({
  fileId, uploadUrl: 'https://uploads.spicyapi.ai/fixture?signature=example',
  method: 'PUT', maxBytes: 10 * 1024 * 1024, expiresAt: future(),
  headers: {'content-type': 'image/png', 'content-length': String(photo.length)},
  ...overrides,
});
const quote = overrides => ({
  model: preset.model, quoteId: 'quote_fixture123', estimatedCost: '0.01',
  maxCharge: '0.01', currency: 'USD', expiresAt: future(), ...overrides,
});
async function plan(client, overrides) {
  return {
    id: '2d8d2bc9-60e0-4af6-aa6a-48ab12178390', request, quote: quote(),
    keyFingerprint: await client.keyFingerprint(), photoExpiresAt: future(), ...overrides,
  };
}

test('one-photo profiles select exact image and video request shapes', () => {
  assert.equal(request.model, 'bytedance/seedream-5.0-pro/edit');
  assert.deepEqual(request.input.image_urls, [fileUri]);
  assert.equal(request.input.resolution, '1k');
  assert.deepEqual(pilotRequest('wan-3', fileUri).input.reference_image_urls, [fileUri]);
  assert.equal(pilotRequest('seedance-25', fileUri).input.image_url, fileUri);
  assert.equal(pilotRequest('seedance-25-spicy', fileUri).input.resolution, '4k');
  assert.throws(() => pilotRequest('constructor', fileUri), /Unknown/);
  assert.throws(() => photoMime(new Uint8Array([1, 2, 3])), /JPEG, PNG or WebP/);
});

test('catalog, upload, quote, confirmed submit and result stay separate', async () => {
  const steps = [];
  const sha256 = await sha256Hex(photo);
  const client = new SpicyAPI(key, async (url, options) => {
    assert.equal(options.redirect, 'manual');
    const {hostname, pathname, searchParams} = new URL(url);
    steps.push(pathname);
    if (hostname === 'uploads.spicyapi.ai') {
      assert.equal(options.method, 'PUT');
      assert.equal(options.headers.has('authorization'), false);
      assert.deepEqual(options.body, photo);
      return new Response(null, {status: 204});
    }
    assert.equal(options.headers.get('Authorization'), 'Bearer ' + key);
    if (pathname.includes('/models/')) {
      return envelope({
        model: preset.model, available: true, enabled: true,
        inputSchema: {properties: {image_urls: {type: 'array'}}},
      });
    }
    if (pathname.endsWith('/upload-url')) {
      assert.deepEqual(JSON.parse(options.body), {contentType: 'image/png', bytes: photo.length});
      return envelope(ticket());
    }
    if (pathname.endsWith('/commit')) {
      assert.equal(options.method, 'POST');
      return envelope({
        fileId, uri: fileUri, status: 'ready', sha256,
        bytes: photo.length, contentType: 'image/png', expiresAt: future(),
      });
    }
    if (pathname.endsWith('/quote')) {
      assert.deepEqual(JSON.parse(options.body), request);
      assert.equal(options.headers.has('Idempotency-Key'), false);
      return envelope(quote());
    }
    if (pathname.endsWith('/createTask')) {
      assert.equal(options.headers.get('Idempotency-Key'), '2d8d2bc9-60e0-4af6-aa6a-48ab12178390');
      assert.deepEqual(JSON.parse(options.body), {...request, quoteId: 'quote_fixture123', expectedCost: '0.01'});
      return Response.json({code: 200, data: {taskId, state: 'queued'}}, {status: 202});
    }
    assert.equal(pathname, '/api/v1/jobs/recordInfo');
    assert.equal(searchParams.get('taskId'), taskId);
    return envelope({state: 'succeeded', settled: true, cost: '0.01', output: {assets: [{url: 'https://cdn.spicyapi.ai/fixture.png'}]}});
  });
  await client.assertModel(preset);
  const upload = await client.uploadPhoto(photo);
  assert.equal(upload.uri, fileUri);
  const boundQuote = await client.quote(request);
  assert.equal(boundQuote.maxCharge, '0.01');
  assert.deepEqual(steps, [
    '/api/v1/models/' + preset.model, '/api/v1/common/upload-url', '/fixture',
    '/api/v1/files/' + fileId + '/commit', '/api/v1/jobs/quote',
  ]);
  const savedPlan = await plan(client, {quote: boundQuote, photoExpiresAt: upload.expiresAt});
  assert.equal((await client.submit(savedPlan, '0.01')).taskId, taskId);
  assert.deepEqual(await client.status(taskId), {
    taskId, state: 'succeeded', settled: true, cost: '0.01', errorCode: undefined,
    assets: ['https://cdn.spicyapi.ai/fixture.png'],
  });
  assert.equal(steps.filter(path => path.endsWith('/createTask')).length, 1);
});

test('unavailable or changed model is rejected by the authenticated catalogue', async () => {
  const unavailable = new SpicyAPI(key, async () => envelope({model: preset.model, enabled: true, available: false}));
  await assert.rejects(unavailable.assertModel(preset), /unavailable/);
  const changed = new SpicyAPI(key, async () => envelope({
    model: preset.model, enabled: true, available: true,
    inputSchema: {properties: {image_urls: {type: 'string'}}},
  }));
  await assert.rejects(changed.assertModel(preset), /schema differs/);
});

test('upload rejects a third-party ticket and an explicit region error', async () => {
  const ticketRequests = [];
  const client = new SpicyAPI(key, async url => {
    ticketRequests.push(url);
    return envelope(ticket({uploadUrl: 'https://uploads.spicyapi.ai.other.example/fixture'}));
  });
  await assert.rejects(client.uploadPhoto(photo), /unexpected upload host/);
  assert.equal(ticketRequests.length, 1);
  const blocked = new SpicyAPI(key, async () => Response.json({code: 40303}, {status: 403}));
  await assert.rejects(blocked.uploadPhoto(photo), /40303.*region/);
});

test('paid submission is blocked by the ceiling, expiry or a changed key', async () => {
  let calls = 0;
  const client = new SpicyAPI(key, async () => { calls++; });
  await assert.rejects(client.submit(await plan(client), '0.009'), /above the approved/);
  await assert.rejects(client.submit(await plan(client, {quote: quote({expiresAt: new Date(0).toISOString()})}), '0.01'), /current, bound/);
  await assert.rejects(client.submit(await plan(client, {keyFingerprint: 'different'}), '0.01'), /different key/);
  assert.equal(calls, 0);
});

test('uncertain submission never automatically resubmits', async () => {
  const calls = [];
  const client = new SpicyAPI(key, async (_url, options) => {
    calls.push(options.headers.get('Idempotency-Key'));
    throw new Error('simulated connection loss');
  });
  const savedPlan = await plan(client);
  await assert.rejects(client.submit(savedPlan, '0.01'), /unconfirmed.*Logs/);
  assert.deepEqual(calls, [savedPlan.id]);
});

test('catalog diagnostics distinguish timeout, network and a non-JSON response', async () => {
  const timeout = new SpicyAPI(key, async () => { throw new DOMException('fixture', 'TimeoutError'); });
  await assert.rejects(timeout.pilotAvailability(PILOTS), /request timed out for \/models/);
  const network = new SpicyAPI(key, async () => { throw new Error('fixture'); });
  await assert.rejects(network.pilotAvailability(PILOTS), /network layer/);
  const unavailable = new SpicyAPI(key, async () => new Response('fixture', {status: 503}));
  await assert.rejects(unavailable.pilotAvailability(PILOTS), /non-JSON.*HTTP 503/);
});

test('manual redirects stop before forwarding credentials or repeating a submission', async () => {
  const calls = [];
  const client = new SpicyAPI(key, async (url, options) => {
    assert.equal(options.redirect, 'manual');
    calls.push(url);
    return new Response(null, {status: 307, headers: {Location: 'https://other.example/'}});
  });
  await assert.rejects(client.pilotAvailability(PILOTS), /redirect.*HTTP 307/);
  await assert.rejects(client.submit(await plan(client), '0.01'), /unconfirmed/);
  assert.equal(calls.length, 2);
  assert.equal(calls.every(url => url.startsWith('https://api.spicyapi.ai/api/v1/')), true);
});
