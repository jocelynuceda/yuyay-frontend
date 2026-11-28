import assert from 'node:assert/strict';
import test from 'node:test';
import { isActivationKey } from '../src/utils/keyboard.ts';

test('Enter y Espacio activan el botón', () => {
  assert.equal(isActivationKey({ key: 'Enter' }), true);
  assert.equal(isActivationKey({ key: ' ' }), true);
  assert.equal(isActivationKey({ key: 'Spacebar' }), true);
});

test('otras teclas no lo activan', () => {
  assert.equal(isActivationKey({ key: 'Tab' }), false);
  assert.equal(isActivationKey({ key: 'a' }), false);
  assert.equal(isActivationKey({}), false);
});

test('mantener la tecla no lo abre varias veces', () => {
  assert.equal(isActivationKey({ key: 'Enter', repeat: true }), false);
});
