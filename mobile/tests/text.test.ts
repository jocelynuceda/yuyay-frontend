import assert from 'node:assert/strict';
import test from 'node:test';
import { isLongText } from '../src/utils/text.ts';

test('un texto corto no es largo', () => {
  assert.equal(isLongText('Tomar con alimentos'), false);
});

test('cuatro líneas cortas superan el máximo de tres', () => {
  assert.equal(isLongText('a\nb\nc\nd'), true);
});

test('tres líneas cortas caben', () => {
  assert.equal(isLongText('a\nb\nc'), false);
});

test('una sola línea de 200 caracteres ocupa más de tres líneas', () => {
  assert.equal(isLongText('x'.repeat(200)), true);
});
