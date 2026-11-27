import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/services/client.ts';
import {
  classifyGoogleError,
  GOOGLE_INVALID_TOKEN,
  GOOGLE_PASSWORD_ACCOUNT,
  GOOGLE_SIGN_IN_FAILED,
  GOOGLE_UNAVAILABLE,
} from '../src/utils/googleAuth.ts';

test('Una cuenta nueva (428 con código de términos) pide aceptar los términos', () => {
  assert.deepEqual(classifyGoogleError(new ApiError(428, 'Acepta', {}, 'TERMS_ACCEPTANCE_REQUIRED')), { kind: 'terms' });
  assert.deepEqual(classifyGoogleError(new ApiError(428, 'Cambió', {}, 'TERMS_VERSION_OUTDATED')), { kind: 'terms' });
});

test('Cada error de /auth/google tiene un mensaje claro', () => {
  // El backend explica con qué método ingresar si el correo ya existe
  const conflict = new ApiError(409, 'El correo ya está registrado. Ingresa con tu correo y contraseña.', {}, 'GOOGLE_EMAIL_CONFLICT');
  assert.deepEqual(classifyGoogleError(conflict), { kind: 'error', message: conflict.message });
  assert.deepEqual(classifyGoogleError(new ApiError(409, 'x')), { kind: 'error', message: GOOGLE_PASSWORD_ACCOUNT });
  assert.deepEqual(classifyGoogleError(new ApiError(401, 'x', {}, 'GOOGLE_TOKEN_INVALID')), { kind: 'error', message: GOOGLE_INVALID_TOKEN });
  assert.deepEqual(classifyGoogleError(new ApiError(503, 'x', {}, 'GOOGLE_AUTH_UNAVAILABLE')), { kind: 'error', message: GOOGLE_UNAVAILABLE });
  assert.deepEqual(classifyGoogleError(new ApiError(404, 'x')), { kind: 'error', message: GOOGLE_UNAVAILABLE });
  // Sin conexión se conserva el mensaje de red
  assert.deepEqual(classifyGoogleError(new ApiError(0, 'Sin conexión')), { kind: 'error', message: 'Sin conexión' });
  assert.deepEqual(classifyGoogleError(new Error('raro')), { kind: 'error', message: GOOGLE_SIGN_IN_FAILED });
});

test('Solo el 428 de datos de alta solicita los datos de identidad', () => {
  assert.deepEqual(classifyGoogleError(new ApiError(428, 'Completa los datos', {}, 'REGISTRATION_DETAILS_REQUIRED')), { kind: 'details' });
  assert.deepEqual(classifyGoogleError(new ApiError(428, 'Otro requisito')), { kind: 'error', message: 'Otro requisito' });
});

test('el alta pendiente conserva la credencial ante errores corregibles y la descarta si venció', () => {
  for (const status of [0, 400, 429, 503]) {
    const fields: Record<string, string> = status === 400 ? { dni: 'Revisa el documento' } : {};
    const failure = new ApiError(status, 'Vuelve a intentarlo', fields);
    assert.deepEqual(classifyGoogleError(failure, true), { kind: 'retry', message: failure.message, fieldErrors: fields });
  }
  assert.deepEqual(classifyGoogleError(new ApiError(401, 'Vencido'), true), { kind: 'error', message: GOOGLE_INVALID_TOKEN });
});
