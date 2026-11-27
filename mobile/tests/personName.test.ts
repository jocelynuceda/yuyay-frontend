import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestUserName } from '../src/utils/personName.ts';

test('El nombre de usuario propuesto usa inicial mayúscula, con tildes, ñ y apellidos compuestos', () => {
  assert.equal(suggestUserName('ÁNGELA ÑAHUI D\'ANGELO-PÉREZ'), 'Ángela Ñahui D\'Angelo-Pérez');
});

test('El nombre de usuario propuesto no pasa de 120 caracteres', () => {
  assert.equal(suggestUserName('A'.repeat(200)).length, 120);
});
