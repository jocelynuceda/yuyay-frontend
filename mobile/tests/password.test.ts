import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordChecks, passwordError, utf8Bytes } from '../src/utils/password.ts';

test('passwordError reports the first missing rule with the same text as the web', () => {
  assert.equal(passwordError('corta1'), 'Usa al menos 8 caracteres.');
  assert.equal(passwordError('A1' + 'ñ'.repeat(36)), 'La contraseña es demasiado larga. Usa menos caracteres o símbolos.');
  assert.equal(passwordError('ññññ1234'), 'Incluye al menos una letra de la A a la Z.');
  assert.equal(passwordError('SinNumero'), 'Incluye al menos un número.');
  assert.equal(passwordError('Clave123'), undefined);
  assert.equal(passwordError('A1' + 'ñ'.repeat(35)), undefined);
});

test('passwordChecks marks each rule separately', () => {
  assert.deepEqual(passwordChecks('ññññ1234').map((c) => c.ok), [true, true, false, true]);
});

test('Unicode and emoji password limits match the backend UTF-8 byte boundary', () => {
  for (const password of ['A1' + 'ñ'.repeat(35), 'A1' + 'ñ'.repeat(36), ' Synthetic_123_ñ🩺 ']) {
    assert.equal(utf8Bytes(password), Buffer.byteLength(password, 'utf8'));
  }
  assert.equal(utf8Bytes('A1' + 'ñ'.repeat(35)), 72);
  assert.equal(utf8Bytes('A1' + 'ñ'.repeat(36)), 74);
});
