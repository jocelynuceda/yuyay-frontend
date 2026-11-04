import assert from 'node:assert/strict';
import test from 'node:test';
import { utf8Bytes } from '../src/utils/password.ts';

test('Unicode and emoji password limits match the backend UTF-8 byte boundary', () => {
  for (const password of ['A1' + 'ñ'.repeat(35), 'A1' + 'ñ'.repeat(36), ' Synthetic_123_ñ🩺 ']) {
    assert.equal(utf8Bytes(password), Buffer.byteLength(password, 'utf8'));
  }
  assert.equal(utf8Bytes('A1' + 'ñ'.repeat(35)), 72);
  assert.equal(utf8Bytes('A1' + 'ñ'.repeat(36)), 74);
});
