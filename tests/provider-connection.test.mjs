import assert from 'node:assert/strict';
import test from 'node:test';
import {onRequest} from '../functions/api/provider-connection.js';
import {PILOTS} from '../provider/pilots.mjs';

const preview = 'https://synthkiss-provider-check.synthkiss.pages.dev/api/provider-connection';
const key = char => 'sk-spicy-' + char.repeat(48);
const context = (url = preview, method = 'GET', secret = key('a')) => ({
  request: new Request(url, {method}), env: {SYNTHKISS_SPICY_API_KEY: secret},
});

test('check rejects production, unrelated previews, writes and a missing key before any fetch', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network call'); });
  assert.equal((await onRequest(context('https://synthkiss.com/api/provider-connection'))).status, 404);
  assert.equal((await onRequest(context('https://synthkiss.pages.dev/api/provider-connection'))).status, 404);
  assert.equal((await onRequest(context('https://other.synthkiss.pages.dev/api/provider-connection'))).status, 404);
  assert.equal((await onRequest(context(preview, 'POST'))).status, 405);
  assert.equal((await onRequest(context(preview, 'GET', ''))).status, 503);
  assert.equal((await onRequest(context(preview, 'GET', 'bad-key'))).status, 503);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('check reads the catalog once and returns only requested model availability', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.spicyapi.ai/api/v1/models');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.get('Authorization'), 'Bearer ' + key('b'));
    return Response.json({code: 200, data: {items: [
      {model: PILOTS['seedance-25'].model, enabled: true, available: true, accountPrice: 'private'},
      {model: PILOTS['wan-3'].model, enabled: true, available: false},
      {model: 'unrelated/model', enabled: true, available: true, prompt: 'private'},
    ]}});
  });
  const responses = await Promise.all([onRequest(context(preview, 'GET', key('b'))), onRequest(context(preview, 'GET', key('b')))]);
  const result = await responses[0].json();
  assert.equal(result.connected, true);
  assert.equal(result.models.length, 9);
  assert.deepEqual(result.models.find(model => model.preset === 'seedance-25'), {preset: 'seedance-25', enabled: true, available: true});
  assert.deepEqual(result.models.find(model => model.preset === 'wan-3'), {preset: 'wan-3', enabled: true, available: false});
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes(key('b')), false);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(responses[0].headers.get('Cache-Control'), 'no-store');
});

test('provider errors are sanitized, cached and isolated when the secret changes', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({code: 40303, msg: key('c')}, {status: 403}));
  const first = await (await onRequest(context(preview, 'GET', key('c')))).json();
  assert.equal(first.connected, false);
  assert.match(first.error, /40303.*region/);
  assert.equal(JSON.stringify(first).includes(key('c')), false);
  await onRequest(context(preview, 'GET', key('c')));
  assert.equal(fetchMock.mock.callCount(), 1);
  await onRequest(context(preview, 'GET', key('d')));
  assert.equal(fetchMock.mock.callCount(), 2);
});
