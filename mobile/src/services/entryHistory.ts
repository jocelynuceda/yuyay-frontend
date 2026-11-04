import type { HealthEntry, HealthEntryVersion } from '../types';

/** El GET del registro excluye eliminados; /versions conserva su auditoría. */
export async function loadEntryHistory(
  getEntry: () => Promise<HealthEntry>,
  getVersions: () => Promise<HealthEntryVersion[]>,
) {
  const [entry, versions] = await Promise.allSettled([getEntry(), getVersions()]);
  if (versions.status === 'rejected') throw versions.reason;
  if (entry.status === 'fulfilled') {
    return { entry: versions.value[0]?.changeType === 'DELETED' ? null : entry.value, versions: versions.value };
  }
  const status = typeof entry.reason === 'object' && entry.reason !== null ? entry.reason.status : undefined;
  if (status === 404 && versions.value[0]?.changeType === 'DELETED') {
    return { entry: null, versions: versions.value };
  }
  throw entry.reason;
}
