import assert from 'node:assert/strict';
import test from 'node:test';
import type { HealthEntry } from '../src/types/index.ts';
import { manualHandoffInput } from '../src/utils/manualHandoff.ts';

function entry(id: number, versionId: number): HealthEntry {
  return {
    id, careSubjectId: 4, categoryCode: 'ALLERGY', categoryName: 'Alergias', createdAt: '2026-11-21T00:00:00Z',
    latestVersion: {
      id: versionId, versionNumber: 2, changeType: 'UPDATED', title: 'Registro revisado',
      details: 'Texto revisado completo', dose: null, frequency: null, occurredOn: null,
      confidenceLevel: 'UNCERTAIN', notes: null, sourceAttachmentId: 77,
      declaredBy: { id: 1, name: 'Cuidador' }, declaredAt: '2026-11-21T00:00:00Z',
    },
  };
}

test('el resumen manual fija exactamente las versiones seleccionadas y omite las desmarcadas', () => {
  const body = manualHandoffInput([entry(1, 11), entry(2, 22), entry(3, 33)], new Set([3, 1]), ' Motivo ', ' Preguntas ');
  assert.deepEqual(body, {
    reason: 'Motivo', questions: 'Preguntas', healthEntryIds: [1, 3], expectedVersionIds: { '1': 11, '3': 33 },
  });
});

test('una versión actualizada requiere una nueva lectura para construir otra solicitud', () => {
  const before = manualHandoffInput([entry(1, 11)], new Set([1]), 'Motivo', '');
  const after = manualHandoffInput([entry(1, 12)], new Set([1]), 'Motivo', '');
  assert.deepEqual(before.expectedVersionIds, { '1': 11 });
  assert.deepEqual(after.expectedVersionIds, { '1': 12 });
  assert.throws(() => manualHandoffInput([], new Set([1]), 'Motivo', ''), /Recarga/);
});
