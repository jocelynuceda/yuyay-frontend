import assert from 'node:assert/strict';
import test from 'node:test';
import type { CareAuthorizationPolicy } from '../src/types/index.ts';
import {
  buildDeclaration,
  CHOOSE_AUTHORIZATION,
  CONFIRM_AUTHORIZATION,
  createRequestIdTracker,
  declarationLabel,
  newRequestId,
  splitAuthorizationOptions,
} from '../src/utils/authorization.ts';

const confirm = 'Confirmo que esta declaración es verdadera.';
const policy: CareAuthorizationPolicy = {
  textVersion: '1',
  thirdPartyQuestion: '¿Cómo estás autorizado para usar sus datos en Yuyay?',
  options: [
    { type: 'SELF', label: 'Este perfil es para mí.', description: 'Mis datos.', scope: 'OWN_DATA', confirmationText: 'Es mío.' },
    { type: 'FICTITIOUS', label: 'Este perfil es ficticio.', description: 'Datos inventados.', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Son ficticios.' },
    { type: 'HOLDER_PERMISSION', label: 'Esta persona me dio permiso.', description: 'Me autorizó.', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: confirm },
    { type: 'LEGAL_REPRESENTATION', label: 'Actúo como su representante legal.', description: 'Facultades.', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: confirm },
    { type: 'PENDING', label: 'Todavía no tengo autorización o no estoy seguro.', description: 'Puedes continuar cuando cuentes con la autorización correspondiente', scope: null, confirmationText: null },
  ],
};

test('La declaración sigue las mismas reglas que la web', () => {
  const { ownOptions, thirdPartyOptions } = splitAuthorizationOptions(policy);
  assert.deepEqual(ownOptions.map((o) => o.type), ['SELF', 'FICTITIOUS']);
  assert.deepEqual(thirdPartyOptions.map((o) => o.type), ['HOLDER_PERMISSION', 'LEGAL_REPRESENTATION', 'PENDING']);

  assert.deepEqual(buildDeclaration(policy, { type: null, confirmed: false }), { ok: false, error: CHOOSE_AUTHORIZATION });
  assert.deepEqual(buildDeclaration(policy, { type: 'LEGAL_REPRESENTATION', confirmed: false }), { ok: false, error: CONFIRM_AUTHORIZATION });
  // Pendiente nunca se envía, aunque llegue marcada la confirmación
  assert.equal(buildDeclaration(policy, { type: 'PENDING', confirmed: true }).ok, false);
  assert.deepEqual(buildDeclaration(policy, { type: 'SELF', confirmed: true }), {
    ok: true, declaration: { type: 'SELF', textVersion: '1', confirmed: true },
  });
});

test('El alta reintenta con la misma clave y cambia de clave si cambian los datos', () => {
  let n = 0;
  const requestIdFor = createRequestIdTracker(() => `id-${++n}`);
  assert.equal(requestIdFor({ name: 'Ana' }), 'id-1');
  assert.equal(requestIdFor({ name: 'Ana' }), 'id-1');
  assert.equal(requestIdFor({ name: 'Rosa' }), 'id-2');
  assert.match(newRequestId(), /^[A-Za-z0-9_-]{1,64}$/);
});

test('La ficha muestra la opción declarada sin la pregunta del tercero', () => {
  assert.equal(declarationLabel('¿Cómo estás autorizado?\nEsta persona me dio permiso.\nMe autorizó.\nConfirmo.'), 'Esta persona me dio permiso.');
  assert.equal(declarationLabel('Este perfil es ficticio.\nDatos inventados.'), 'Este perfil es ficticio.');
});
