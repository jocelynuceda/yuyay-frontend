import axios from 'axios'
import type { HealthEntry, HealthEntryVersion } from '../types'

/**
 * El GET del registro excluye los eliminados (404), pero /versions conserva su auditoría.
 * Si el registro fue eliminado devuelve entry: null junto con su historial.
 */
export async function loadEntryHistory(
  getEntry: () => Promise<HealthEntry>,
  getVersions: () => Promise<HealthEntryVersion[]>,
) {
  const [entry, versions] = await Promise.allSettled([getEntry(), getVersions()])
  if (versions.status === 'rejected') throw versions.reason

  const deleted = versions.value[0]?.changeType === 'DELETED'
  if (entry.status === 'fulfilled') return { entry: deleted ? null : entry.value, versions: versions.value }

  const notFound = axios.isAxiosError(entry.reason) && entry.reason.response?.status === 404
  if (notFound && deleted) return { entry: null, versions: versions.value }
  throw entry.reason
}
