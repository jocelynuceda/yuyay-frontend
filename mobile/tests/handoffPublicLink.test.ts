import assert from 'node:assert/strict';
import test from 'node:test';
import { handoffPublicLink, handoffPublicOrigin } from '../src/utils/handoffPublicLink.ts';

test('el enlace usa la web pública oficial y nunca la API ni un código corto', () => {
  const origin = handoffPublicOrigin();
  assert.equal(origin, 'https://yuyay-frontend.vercel.app');
  assert.equal(handoffPublicLink(origin, 'token/largo?privado'), 'https://yuyay-frontend.vercel.app/handoff/token%2Flargo%3Fprivado');
});

test('permite configurar otra web HTTPS y localhost sólo en desarrollo', () => {
  assert.equal(handoffPublicOrigin('https://salud.example/'), 'https://salud.example');
  assert.equal(handoffPublicOrigin('http://localhost:5173', true), 'http://localhost:5173');
  assert.equal(handoffPublicOrigin('http://192.168.1.5:5173', true), 'http://192.168.1.5:5173');
  assert.throws(() => handoffPublicOrigin('http://192.168.1.5:5173'), /enlace público/);
  assert.throws(() => handoffPublicOrigin('http://salud.example', true), /enlace público/);
  for (const url of ['http://localhost:5173', 'http://salud.example', 'javascript:alert(1)', 'https://user:pass@salud.example', 'https://salud.example/api', 'https://salud.example/?token=123', 'https://salud.example/#secret']) {
    assert.throws(() => handoffPublicOrigin(url), /enlace público/);
  }
});
