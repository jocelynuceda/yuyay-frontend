import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type AxiosResponse } from 'axios';
import { loadAndroidPreviewImage } from '../src/services/androidPreviewImage.ts';
import { createApiClient } from '../src/services/client.ts';

const path = '/care-subjects/1/attachments/7/content';
const signal = new AbortController().signal;
const createClient = () => createApiClient('https://api.example.test', {
  generation: 1, accessToken: 'fixture', refresh: async () => {},
}, { retryDelayMs: 0 });

test('Android descarga la imagen con la sesión y entrega al visor solo los bytes locales', async (t) => {
  const client = createClient();
  const bytes = new Uint8Array([137, 80, 78, 71]);
  let closed = false;
  const image = Object.assign(new Blob([bytes], { type: 'image/png' }), { close() { closed = true; } });
  let requests = 0;
  client.defaults.adapter = async (config) => {
    requests++;
    assert.equal(config.url, path);
    assert.equal(config.headers.Authorization, 'Bearer fixture');
    assert.equal(config.responseType, 'blob');
    assert.equal(config.signal, signal);
    return { status: 200, statusText: 'OK', data: image, headers: {}, config };
  };
  // El ejecutor Node carece del FileReader que provee React Native.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  class FixtureReader {
    result = '';
    onload?: () => void;
    async readAsDataURL(blob: Blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
      this.onload?.();
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { value: FixtureReader, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'FileReader', previous);
    else Reflect.deleteProperty(globalThis, 'FileReader');
  });
  assert.deepEqual(await loadAndroidPreviewImage(client, path, signal), { uri: 'data:image/png;base64,iVBORw==' });
  assert.equal(closed, true);
  assert.equal(requests, 1);
});

test('Android propaga la denegación o la falta de contenido sin producir una fuente de imagen', async () => {
  for (const status of [403, 404, 503]) {
    const client = createClient();
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Unavailable', undefined, config, undefined, { status, data: {}, config } as AxiosResponse);
    };
    await assert.rejects(loadAndroidPreviewImage(client, path, signal), { status });
  }
});
