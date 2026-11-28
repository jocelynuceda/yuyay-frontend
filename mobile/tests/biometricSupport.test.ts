import assert from 'node:assert/strict';
import test from 'node:test';
import { biometricHint, describeBiometrics, type BiometricFacts } from '../src/utils/biometricSupport.ts';

const facts = (extra: Partial<BiometricFacts>): BiometricFacts => ({
  platform: 'ios', hasHardware: true, face: false, fingerprint: false, strong: true, expoGo: false, ...extra,
});

test('iPhone con Face ID: se llama Face ID y usa el ícono de rostro', () => {
  assert.deepEqual(describeBiometrics(facts({ face: true })), { status: 'available', label: 'Face ID', kind: 'face' });
});

test('iPhone con Touch ID: es huella', () => {
  assert.deepEqual(describeBiometrics(facts({ fingerprint: true })), { status: 'available', label: 'Touch ID', kind: 'fingerprint' });
});

test('Face ID dentro de Expo Go: no se ofrece, solo funciona en la app instalada', () => {
  const support = describeBiometrics(facts({ face: true, expoGo: true }));
  assert.equal(support.status, 'needs-app');
  assert.match(biometricHint(support, false), /Expo Go.*Face ID.*instalada/);
});

test('Touch ID dentro de Expo Go sí funciona (no necesita el permiso de Face ID)', () => {
  assert.equal(describeBiometrics(facts({ fingerprint: true, expoGo: true })).status, 'available');
});

test('Android: la huella es la biometría, también en Expo Go', () => {
  const android = { platform: 'android', expoGo: true };
  assert.deepEqual(describeBiometrics(facts({ ...android, fingerprint: true, face: true })), { status: 'available', label: 'tu huella', kind: 'fingerprint' });
  assert.deepEqual(describeBiometrics(facts({ ...android, face: true })), { status: 'available', label: 'tu rostro', kind: 'face' });
});

test('sin huella ni rostro registrado, el texto dice qué configurar', () => {
  const ios = describeBiometrics(facts({ face: true, strong: false }));
  assert.equal(ios.status, 'not-enrolled');
  assert.match(biometricHint(ios, false), /Face ID, pero no está configurado/);
  const android = describeBiometrics(facts({ platform: 'android', fingerprint: true, strong: false }));
  assert.match(biometricHint(android, false), /sensor de huella/);
});

test('activado, el texto nombra lo que se pedirá', () => {
  assert.match(biometricHint(describeBiometrics(facts({ face: true })), true), /se pedirá Face ID/);
});

test('sin sensor o en la web no hay desbloqueo biométrico', () => {
  assert.equal(describeBiometrics(facts({ hasHardware: false })).status, 'unsupported');
  assert.equal(describeBiometrics(facts({ platform: 'web' })).status, 'unsupported');
});
