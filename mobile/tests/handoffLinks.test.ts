import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageHandoffLinks, handoffLinkState } from '../src/utils/handoffLinks.ts';

const now = new Date('2026-11-13T12:00:00Z');
const base = { expiresAt: '2026-11-14T12:00:00Z', sessionWindowMinutes: 30, firstOpenedAt: null, revokedAt: null };

test('handoffLinkState follows the backend expiry rule', () => {
  assert.equal(handoffLinkState(base, now), 'Sin abrir');
  assert.equal(handoffLinkState({ ...base, revokedAt: '2026-11-13T11:00:00Z' }, now), 'Revocado');
  assert.equal(handoffLinkState({ ...base, expiresAt: '2026-11-13T11:59:00Z' }, now), 'Vencido');
  // Abierto hace 10 minutos con ventana de 30: sigue abierto
  assert.equal(handoffLinkState({ ...base, firstOpenedAt: '2026-11-13T11:50:00Z' }, now), 'Abierto');
  // Abierto hace 31 minutos: la ventana ya pasó aunque expiresAt no haya llegado
  assert.equal(handoffLinkState({ ...base, firstOpenedAt: '2026-11-13T11:29:00Z' }, now), 'Vencido');
});

test('canManageHandoffLinks allows only the creator or the principal', () => {
  assert.equal(canManageHandoffLinks(7, 7, false), true);
  assert.equal(canManageHandoffLinks(7, 8, true), true);
  assert.equal(canManageHandoffLinks(7, 8, false), false);
  assert.equal(canManageHandoffLinks(7, undefined, false), false);
});
