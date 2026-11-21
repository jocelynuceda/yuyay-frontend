import assert from 'node:assert/strict';
import test from 'node:test';
import { creationOutcomeUncertain, makeCareDeclaration, prepareCareSubjectCreation } from '../src/utils/careAuthorization.ts';
import type { CareAuthorizationPolicy } from '../src/types/careAuthorization.ts';

const policy: CareAuthorizationPolicy = {
  textVersion: '7',
  thirdPartyQuestion: '¿Cómo estás autorizado para usar sus datos en Yuyay?',
  options: [
    { type: 'SELF', label: 'Perfil propio', description: '', scope: 'OWN_DATA', confirmationText: 'Confirmo.' },
    { type: 'FICTITIOUS', label: 'Perfil ficticio', description: '', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Confirmo.' },
    { type: 'HOLDER_PERMISSION', label: 'Permiso', description: '', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: 'Confirmo.' },
    { type: 'LEGAL_REPRESENTATION', label: 'Representación', description: '', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: 'Confirmo.' },
    { type: 'PENDING', label: 'Pendiente', description: '', scope: null, confirmationText: null },
  ],
};

test('exige elección, alcance de catálogo y confirmación de la versión vigente', () => {
  assert.equal(makeCareDeclaration(policy, null, '7'), null);
  assert.equal(makeCareDeclaration(policy, 'PENDING', '7'), null);
  assert.equal(makeCareDeclaration(policy, 'SELF', '6'), null);
  assert.equal(makeCareDeclaration(policy, 'SELF', null), null);
  const wrongScope = { ...policy, options: [{ ...policy.options[0], scope: 'FICTITIOUS_DATA_ONLY' as const }] };
  assert.equal(makeCareDeclaration(wrongScope, 'SELF', '7'), null);
  for (const type of ['SELF', 'FICTITIOUS', 'HOLDER_PERMISSION', 'LEGAL_REPRESENTATION'] as const) {
    assert.deepEqual(makeCareDeclaration(policy, type, '7'), { type, textVersion: '7', confirmed: true });
  }
});

test('repite exactamente la solicitud anterior hasta resolver un guardado incierto', () => {
  const declaration = makeCareDeclaration(policy, 'FICTITIOUS', '7')!;
  const data = { name: 'Perfil original' };
  const first = prepareCareSubjectCreation(null, declaration, data, () => 'first-id');
  const retry = prepareCareSubjectCreation({ request: first, uncertain: true }, declaration, { name: 'Editado' }, () => 'next-id');
  assert.equal(retry, first);
  const rejected = { request: first, uncertain: false };
  assert.equal(prepareCareSubjectCreation(rejected, declaration, { ...data }, () => 'next-id'), first);
  assert.deepEqual(prepareCareSubjectCreation(rejected, declaration, { name: 'Editado' }, () => 'next-id'), {
    requestId: 'next-id', data: { name: 'Editado' }, declaration,
  });
  assert.equal(creationOutcomeUncertain(0), true);
  assert.equal(creationOutcomeUncertain(504), true);
  assert.equal(creationOutcomeUncertain(409), false);
  assert.equal(creationOutcomeUncertain(403, true), true);
  assert.equal(creationOutcomeUncertain(409, true), false);
});
