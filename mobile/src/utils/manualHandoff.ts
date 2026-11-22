import type { HealthEntry, HandoffInput } from '../types';

/** Fija únicamente las versiones que el cuidador pudo revisar antes de guardar. */
export function manualHandoffInput(
  entries: HealthEntry[],
  selected: ReadonlySet<number>,
  reason: string,
  questions: string,
): HandoffInput {
  const chosen = entries.filter((entry) => selected.has(entry.id));
  if (chosen.length !== selected.size) throw new Error('Recarga los registros antes de crear el resumen.');
  return {
    reason: reason.trim(),
    questions: questions.trim(),
    healthEntryIds: chosen.map((entry) => entry.id),
    expectedVersionIds: Object.fromEntries(chosen.map((entry) => [String(entry.id), entry.latestVersion.id])),
  };
}
