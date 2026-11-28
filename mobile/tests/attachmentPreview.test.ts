import assert from 'node:assert/strict';
import test from 'node:test';
import { attachmentPreviewState as advance } from '../src/hooks/attachmentPreviewState.ts';

const signedImage = advance({ status: 'loading', origin: 's3' }, {
  type: 'loaded', origin: 's3', source: { uri: 'https://s3.example.test/document.png' },
});

test('discard the signed image while waiting for the API, then show the authenticated source', () => {
  const retry = advance(signedImage, { type: 'error', origin: 's3' });
  assert.deepEqual(retry, { status: 'loading', origin: 'api' });
  const source = { uri: 'https://api.example.test/content', headers: { Authorization: 'Bearer fixture' } };
  const ready = advance(retry, { type: 'loaded', origin: 'api', source });
  assert.deepEqual(ready, { status: 'ready', origin: 'api', source });
  assert.equal(advance(ready, { type: 'error', origin: 's3' }), ready);
});

test('a rejected API request ends the retry with no image', () => {
  const retry = advance(signedImage, { type: 'error', origin: 's3' });
  const failure = advance(retry, { type: 'error', origin: 'api' });
  assert.deepEqual(failure, { status: 'failed', origin: 'api' });
});

test('a native image error for the API source also ends the retry', () => {
  const retry = advance(signedImage, { type: 'error', origin: 's3' });
  const ready = advance(retry, { type: 'loaded', origin: 'api', source: { uri: '/content' } });
  const failure = advance(ready, { type: 'error', origin: 'api' });
  assert.deepEqual(failure, { status: 'failed', origin: 'api' });
  assert.equal(advance(failure, { type: 'error', origin: 'api' }), failure);
});
