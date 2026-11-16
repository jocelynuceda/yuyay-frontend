import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIENT_HEADER, clientHeaderValue } from '../src/utils/clientHeader.ts';

test('the suffix tells APK code, OTA updates and development builds apart', () => {
  assert.equal(CLIENT_HEADER, 'X-Yuyay-Client');
  const id = '0f3a9c12-aaaa-bbbb-cccc-dddddddddddd';
  assert.equal(clientHeaderValue('android', '1.0.0', id, true), 'android/1.0.0+e0f3a9c12');
  assert.equal(clientHeaderValue('android', '1.0.0', id, false), 'android/1.0.0+u0f3a9c12');
  assert.equal(clientHeaderValue('android', '1.0.0', id, null), 'android/1.0.0+u0f3a9c12');
  assert.equal(clientHeaderValue('ios', undefined, null), 'ios/unknown+dev');
  assert.equal(clientHeaderValue('web', '', '', true), 'web/unknown+dev');
  assert.equal(clientHeaderValue('android', '1.0.0', '---', true), 'android/1.0.0+dev');
});

test('the value only keeps the characters the backend accepts and fits in 64', () => {
  const backendRule = /^[A-Za-z0-9._/+-]{1,64}$/;
  const samples = [
    clientHeaderValue('android', '1.0.0 beta\n', '{0f-3a}9c12', false),
    clientHeaderValue('a'.repeat(80), '1.0.0', null),
    clientHeaderValue('ios', 'ñ1.0', 'ÁÉ123456789', true),
  ];
  for (const value of samples) assert.match(value, backendRule, value);
  assert.equal(samples[0], 'android/1.0.0beta+u0f3a9c12');
  assert.equal(samples[1].length, 64);
  assert.equal(samples[2], 'ios/1.0+e12345678');
});
