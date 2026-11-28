import assert from 'node:assert/strict';
import test from 'node:test';
import { biometricHint, biometricLogoutMessage, biometricToggleTitle, describeBiometrics, type BiometricFacts } from '../src/utils/biometricSupport.ts';

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

test('activado, el texto nombra lo que se pedirá y aclara que no reemplaza la contraseña', () => {
  const hint = biometricHint(describeBiometrics(facts({ face: true })), true);
  assert.match(hint, /se pedirá Face ID/);
  assert.match(hint, /si cierras sesión, se desactiva/);
});

test('el interruptor dice que la biometría se pide al abrir Yuyay, no que inicia sesión', () => {
  assert.equal(biometricToggleTitle(describeBiometrics(facts({ platform: 'android', fingerprint: true }))), 'Pedir tu huella al abrir Yuyay');
  assert.equal(biometricToggleTitle(describeBiometrics(facts({ face: true }))), 'Pedir Face ID al abrir Yuyay');
  assert.equal(biometricToggleTitle({ status: 'unsupported' }), 'Pedir biometría al abrir Yuyay');
});

test('al cerrar sesión se avisa que se desactiva y que hará falta la cuenta', () => {
  const message = biometricLogoutMessage(describeBiometrics(facts({ platform: 'android', fingerprint: true })));
  assert.match(message, /desactivará el desbloqueo con tu huella/);
  assert.match(message, /necesitarás tu cuenta/);
});

test('sin sensor o en la web no hay desbloqueo biométrico', () => {
  assert.equal(describeBiometrics(facts({ hasHardware: false })).status, 'unsupported');
  assert.equal(describeBiometrics(facts({ platform: 'web' })).status, 'unsupported');
});

test('Android con huella o rostro de seguridad débil: lo dice en vez de pedir registrar una huella', () => {
  const weak = describeBiometrics(facts({ platform: 'android', face: true, strong: false, enrolled: true }));
  assert.deepEqual(weak, { status: 'weak', label: 'tu rostro', kind: 'face' });
  assert.match(biometricHint(weak, false), /Android no lo considera seguro/);
  assert.doesNotMatch(biometricHint(weak, false), /no hay ninguna huella registrada/);
  // Sin nada registrado sigue pidiendo registrarlo
  assert.equal(describeBiometrics(facts({ platform: 'android', fingerprint: true, strong: false, enrolled: false })).status, 'not-enrolled');
});
