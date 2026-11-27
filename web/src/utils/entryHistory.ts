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
  const [result, versions] = await Promise.all([
    getEntry().then((entry) => ({ entry })).catch((error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return { missing: error }
      throw error
    }),
    getVersions(),
  ])
  if (versions[0]?.changeType === 'DELETED') return { entry: null, versions }
  if ('missing' in result) throw result.missing
  return { entry: result.entry, versions }
}
