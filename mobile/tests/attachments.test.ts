import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, type AxiosResponse } from 'axios';
import { appendAttachment, attachmentMimeType, attachmentUploadOptions, MAX_ATTACHMENT_BYTES, validateAttachment } from '../src/services/attachmentUpload.ts';
import { ApiError, createApiClient } from '../src/services/client.ts';

const source = { uri: 'file:///cache/documento.jpg', name: 'documento.jpg', mimeType: 'image/jpeg', size: 20 };

test('native multipart uses a file descriptor; web sends the original File bytes', () => {
  const calls: unknown[][] = [];
  const form = { append: (...args: unknown[]) => { calls.push(args); } };
  appendAttachment(form, source, 'native');
  assert.deepEqual(calls[0], ['file', { uri: source.uri, name: source.name, type: source.mimeType }]);
  const file = new File([new Uint8Array([255, 216, 255, 0])], 'foto.jpg', { type: 'image/jpeg' });
  const web = new FormData();
  appendAttachment(web, { ...source, file }, 'web');
  assert.equal((web.get('file') as File).size, 4);
  assert.equal((web.get('file') as File).name, source.name);
  assert.throws(() => appendAttachment(web, source, 'web'), /Vuelve a seleccionarlo/);
});

test('file validation rejects audio, HEIC without conversion, empty and oversized files', () => {
  for (const mimeType of ['audio/mpeg', 'image/heic', 'application/octet-stream']) {
    assert.throws(() => validateAttachment({ ...source, mimeType }), /JPG o PNG/);
  }
  for (const size of [0, -1, NaN]) assert.throws(() => validateAttachment({ ...source, size }), /vacío/);
  assert.throws(() => validateAttachment({ ...source, size: MAX_ATTACHMENT_BYTES + 1 }), /10 MB/);
  assert.doesNotThrow(() => validateAttachment({ ...source, size: MAX_ATTACHMENT_BYTES }));
  assert.equal(attachmentMimeType('documento.PDF'), 'application/pdf');
  assert.equal(attachmentMimeType('foto.jpg', 'audio/mpeg'), 'audio/mpeg');
});

test('Axios upload keeps FormData and bytes across a 401 refresh, without the default JSON header', async () => {
  let token = 'old';
  let refreshes = 0;
  const client = createApiClient('https://api.example.test', {
    generation: 1,
    get accessToken() { return token; },
    refresh: async () => { refreshes++; token = 'new'; },
  });
  const body = new FormData();
  const file = new File(['contenido'], 'documento.pdf', { type: 'application/pdf' });
  appendAttachment(body, { uri: 'blob:documento', name: file.name, mimeType: file.type, file }, 'web');
  let attempts = 0;
  client.defaults.adapter = async (config) => {
    attempts++;
    assert.equal(config.data, body);
    assert.equal(config.headers.getContentType(), 'multipart/form-data');
    assert.equal(await (config.data.get('file') as File).text(), 'contenido');
    if (attempts === 1) {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined,
        { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
    }
    assert.equal(config.headers.Authorization, 'Bearer new');
    return { status: 201, statusText: 'Created', data: { id: 1 }, headers: {}, config } as AxiosResponse;
  };
  await client.post('/attachments', body, attachmentUploadOptions);
  assert.equal(refreshes, 1);
  assert.equal(attempts, 2);
});

test('native FormData keeps URI parts across Axios transformations and refresh retry', async () => {
  class NativeFormData {
    readonly [Symbol.toStringTag] = 'FormData';
    parts: unknown[][] = [];
    append(...part: unknown[]) { this.parts.push(part); }
    getParts() { return this.parts; }
  }
  const body = new NativeFormData();
  appendAttachment(body, source, 'native');
  let token = 'old';
  const client = createApiClient('https://api.example.test', {
    generation: 1, get accessToken() { return token; }, refresh: async () => { token = 'new'; },
  });
  client.defaults.adapter = async (config) => {
    assert.equal(config.data, body);
    assert.equal(config.headers.getContentType(), 'multipart/form-data');
    assert.deepEqual(body.parts[0], ['file', { uri: source.uri, name: source.name, type: source.mimeType }]);
    if (token === 'old') throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config });
    return { status: 201, statusText: 'Created', data: {}, headers: {}, config } as AxiosResponse;
  };
  await client.post('/attachments', body, attachmentUploadOptions);
});

test('multipart permissions and referenced-file conflicts remain actionable errors', async () => {
  for (const status of [403, 409, 502]) {
    const client = createApiClient('https://api.example.test', { generation: 1, accessToken: 'token', refresh: async () => {} });
    client.defaults.adapter = async (config) => {
      throw new AxiosError('Rejected', 'ERR_BAD_REQUEST', config, undefined,
        { status, statusText: 'Rejected', data: { message: 'El archivo está referenciado en el historial.' }, headers: {}, config });
    };
    await assert.rejects(client.delete('/attachments/1'), (e: ApiError) => e.status === status && !!e.message);
  }
});
