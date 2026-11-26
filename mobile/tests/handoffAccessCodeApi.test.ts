import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from '../src/services/client.ts';
import { createHandoffAccessApi } from '../src/services/security/handoffAccessCodeApi.ts';

test('solicita protección explícita y envía autenticación sólo en la cabecera', async () => {
  const token = 'credencial-ficticia-no-real';
  const http = createApiClient('https://api.example/api/v1', { generation: 1, accessToken: token, refresh: async () => {} });
  const controller = new AbortController();
  const bodies: unknown[] = [];
  let codeFetched = false;
  http.defaults.adapter = async (config) => {
    assert.equal(config.headers.Authorization, `Bearer ${token}`);
    assert.equal(config.url?.includes(token), false);
    assert.equal(config.params, undefined);
    if (config.method === 'post') {
      assert.equal(config.url, '/handoffs/12/sessions');
      bodies.push(JSON.parse(config.data));
    } else {
      assert.equal(config.url, '/handoff-sessions/34/access-code');
      assert.equal(config.signal, controller.signal);
      assert.equal(config.data, undefined);
      codeFetched = true;
    }
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config };
  };
  const api = createHandoffAccessApi(http);
  await api.createSession(12, 24, 30);
  await api.createSession(12, { expiresInMinutes: 90, sessionWindowMinutes: 45 });
  await api.createSession(12, { expiresInMinutes: 90, sessionWindowMinutes: 45, allowDownload: true });
  await api.getCode(34, controller.signal);
  assert.deepEqual(bodies, [
    { expiresInHours: 24, sessionWindowMinutes: 30, requireAccessCode: true },
    { expiresInMinutes: 90, sessionWindowMinutes: 45, requireAccessCode: true },
    { expiresInMinutes: 90, sessionWindowMinutes: 45, allowDownload: true, requireAccessCode: true },
  ]);
  assert.equal(codeFetched, true);
});
