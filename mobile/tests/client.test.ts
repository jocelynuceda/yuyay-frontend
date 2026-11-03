import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, createApiClient } from '../src/services/client.ts';

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
