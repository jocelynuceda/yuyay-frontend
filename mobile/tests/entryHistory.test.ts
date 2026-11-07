import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/services/client.ts';
import { loadEntryHistory } from '../src/services/entryHistory.ts';
import type { HealthEntry, HealthEntryVersion } from '../src/types';

const deleted = { id: 3, changeType: 'DELETED', versionNumber: 2 } as HealthEntryVersion;
const created = { id: 2, changeType: 'CREATED', versionNumber: 1 } as HealthEntryVersion;
const entry = { id: 1, deletedAt: null, latestVersion: created } as HealthEntry;

test('404 entry still loads the preserved deleted history', async () => {
  const result = await loadEntryHistory(async () => { throw new ApiError(404, 'Eliminado'); }, async () => [deleted, created]);
  assert.equal(result.entry, null);
  assert.deepEqual(result.versions, [deleted, created]);
});

test('refresh replaces a previously editable entry after another caregiver deletes it', async () => {
  const initial = await loadEntryHistory(async () => entry, async () => [created]);
  assert.equal(initial.entry?.id, 1);
  const refreshed = await loadEntryHistory(async () => { throw new ApiError(404, 'Eliminado'); }, async () => [deleted, created]);
  assert.equal(refreshed.entry, null);
  const raced = await loadEntryHistory(async () => entry, async () => [deleted, created]);
  assert.equal(raced.entry, null);
});

test('versions do not bypass denied access, transport errors or unrelated 404 responses', async () => {
  for (const status of [0, 403, 404]) {
    await assert.rejects(loadEntryHistory(async () => { throw new ApiError(status, 'Error'); }, async () => [created]), ApiError);
  }
  await assert.rejects(loadEntryHistory(async () => entry, async () => { throw new ApiError(403, 'Sin permiso'); }), ApiError);
});
