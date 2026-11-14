import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationTarget } from '../src/utils/notificationTarget.ts';

const subjects = [
  { id: 1, name: 'Rosa', myRole: 'PRINCIPAL' as const },
  { id: 2, name: 'Pedro', myRole: 'CAREGIVER' as const },
];
const pending = new Set([3]);

test('notificationTarget follows the same rules as the web', () => {
  // Invitación pendiente: al inicio, donde se acepta
  assert.deepEqual(notificationTarget({ type: 'INVITATION', careSubjectId: 3 }, pending, subjects), { screen: 'Home' });
  // Invitación que ya no está pendiente: no lleva a ningún lado
  assert.equal(notificationTarget({ type: 'INVITATION', careSubjectId: 1 }, pending, subjects), null);
  // Nuevo cuidador: a la lista de cuidadores
  assert.deepEqual(notificationTarget({ type: 'CAREGIVER_JOINED', careSubjectId: 1 }, pending, subjects), {
    screen: 'Caregivers',
    params: { subjectId: 1, isPrincipal: true },
  });
  // Cambio en un registro: al perfil de la persona
  assert.deepEqual(notificationTarget({ type: 'ENTRY_CHANGED', careSubjectId: 2 }, pending, subjects), {
    screen: 'SubjectDetail',
    params: { subjectId: 2, name: 'Pedro' },
  });
});

test('notificationTarget ignores notices without a person or for people without access', () => {
  assert.equal(notificationTarget({ type: 'ENTRY_CHANGED', careSubjectId: null }, pending, subjects), null);
  assert.equal(notificationTarget({ type: 'ENTRY_CHANGED', careSubjectId: 9 }, pending, subjects), null);
});
