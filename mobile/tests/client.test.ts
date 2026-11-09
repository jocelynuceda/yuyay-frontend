import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, createApiClient, MAX_RETRIES } from '../src/services/client.ts';

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined,
    { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
}

test('concurrent 401 responses share refresh and late old-token 401 does not rotate again', async () => {
  let accessToken = 'old';
  let renewals = 0;
  let inFlight: Promise<void> | undefined;
  const session = {
    generation: 1,
    get accessToken() { return accessToken; },
    refresh: () => inFlight ??= new Promise<void>((resolve) => {
      renewals++;
      setTimeout(() => { accessToken = 'new'; resolve(); }, 10);
    }).finally(() => { inFlight = undefined; }),
  };
  const http = createApiClient('http://localhost/api/v1', session);
  http.defaults.adapter = async (config) => {
    if (config.headers.Authorization === 'Bearer old') {
      await new Promise((resolve) => setTimeout(resolve, config.url === '/late' ? 50 : 0));
      throw unauthorized(config);
    }
    return { status: 200, statusText: 'OK', data: {}, headers: {}, config } as AxiosResponse;
  };
  await Promise.all([http.get('/a'), http.get('/b'), http.get('/late')]);
  assert.equal(renewals, 1);
});

test('refresh transport and server failures propagate without becoming a credential error', async () => {
  for (const status of [0, 500]) {
    const http = createApiClient('http://localhost', {
      generation: 1, accessToken: 'old',
      refresh: async () => { throw new ApiError(status, 'Recoverable'); },
    });
    http.defaults.adapter = async (config) => { throw unauthorized(config); };
    await assert.rejects(http.get('/users/me'), (error: ApiError) => error.status === status);
  }
});

test('auth requests and 401 responses arriving after logout never invoke refresh', async () => {
  let generation = 1;
  let refreshes = 0;
  const http = createApiClient('http://localhost', {
    get generation() { return generation; }, accessToken: null,
    refresh: async () => { refreshes++; },
  });
  http.defaults.adapter = async (config) => {
    generation++;
    throw unauthorized(config);
  };
  await assert.rejects(http.post('/auth/login'), ApiError);
  await assert.rejects(http.get('/users/me'), ApiError);
  assert.equal(refreshes, 0);
});

function failure(config: InternalAxiosRequestConfig, status?: number) {
  if (status === undefined) return new AxiosError('Network Error', 'ERR_NETWORK', config);
  return new AxiosError('Error', 'ERR_BAD_RESPONSE', config, undefined,
    { status, statusText: 'Error', data: {}, headers: {}, config });
}

const ok = (config: InternalAxiosRequestConfig) =>
  ({ status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config }) as AxiosResponse;

test('GET retries network and 503 failures, then succeeds', async () => {
  let calls = 0;
  const http = createApiClient('http://localhost', { generation: 1, accessToken: 't', refresh: async () => {} }, { retryDelayMs: 1 });
  http.defaults.adapter = async (config) => {
    calls++;
    if (calls === 1) throw failure(config);
    if (calls === 2) throw failure(config, 503);
    return ok(config);
  };
  const { data } = await http.get('/care-subjects');
  assert.deepEqual(data, { ok: true });
  assert.equal(calls, 3);
});

test('GET gives up after MAX_RETRIES with a friendly error', async () => {
  let calls = 0;
  const http = createApiClient('http://localhost', { generation: 1, accessToken: 't', refresh: async () => {} }, { retryDelayMs: 1 });
  http.defaults.adapter = async (config) => { calls++; throw failure(config); };
  await assert.rejects(http.get('/care-subjects'), (error: ApiError) =>
    error.status === 0 && error.message.includes('conexión'));
  assert.equal(calls, 1 + MAX_RETRIES);
});

test('writes and non-transient errors are never retried', async () => {
  for (const [method, status] of [['post', undefined], ['delete', 503], ['get', 400], ['get', 500]] as const) {
    let calls = 0;
    const http = createApiClient('http://localhost', { generation: 1, accessToken: 't', refresh: async () => {} }, { retryDelayMs: 1 });
    http.defaults.adapter = async (config) => { calls++; throw failure(config, status); };
    await assert.rejects(http.request({ method, url: '/x' }), ApiError);
    assert.equal(calls, 1, `${method} ${status ?? 'network'}`);
  }
});
