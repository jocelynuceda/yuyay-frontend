import { EXAM_RESULT } from '../schemas/healthEntry'
import { CATEGORY_CODES, type CategoryCode, type HealthEntry } from '../types'

/** Categorías del perfil clínico, igual que en la app móvil: los exámenes tienen su propio filtro. */
export const PROFILE_CATEGORIES = CATEGORY_CODES.filter((code) => code !== EXAM_RESULT)

/** Agrupa los registros vigentes por categoría del perfil, en el orden en que llegan. */
export function groupByCategory(entries: readonly HealthEntry[]) {
  const groups = new Map<CategoryCode, HealthEntry[]>(PROFILE_CATEGORIES.map((code) => [code, []]))
  for (const entry of entries) {
    if (entry.deletedAt) continue
    groups.get(entry.categoryCode)?.push(entry)
  }
  return groups
}
