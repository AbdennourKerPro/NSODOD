import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedGarden } from '../src/shared-garden.mjs';
import { COMMON_GARDEN } from '../server/garden.mjs';

test('separate anonymous browsers resolve the same server garden', async () => {
  const requests = [];
  const server = async (path, request) => {
    requests.push(request);
    assert.equal(path, '/api/garden');
    assert.deepEqual(JSON.parse(request.body), {});
    return { ok: true, json: async () => ({ roomId: COMMON_GARDEN }) };
  };
  const browsers = ['meriem-new-browser', 'abdennour-new-browser'].map(token => ({ getIdToken: async () => token }));
  assert.deepEqual(await Promise.all(browsers.map(browser => sharedGarden(browser, server))), [COMMON_GARDEN, COMMON_GARDEN]);
  assert.notEqual(requests[0].headers.Authorization, requests[1].headers.Authorization);
});

test('an unavailable bootstrap never falls back to a new or remembered garden', async () => {
  const user = { getIdToken: async () => 'test-token' };
  await assert.rejects(sharedGarden(user, async () => ({ ok: false, json: async () => ({ error: 'indisponible' }) })), /indisponible/);
  await assert.rejects(sharedGarden(user, async () => ({ ok: true, json: async () => ({ roomId: 'invalid' }) })), /chargé/);
  await assert.rejects(sharedGarden(user, async () => ({ ok: false, json: async () => { throw new Error(); } })), /indisponible/);
});
