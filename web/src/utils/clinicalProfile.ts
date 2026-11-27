import { CATEGORY_CODES, type CategoryCode, type HealthEntry, type Page } from '../types'

/** El perfil incluye todas las categorías, también los resultados de exámenes. */
export const PROFILE_CATEGORIES = CATEGORY_CODES

export const profileHistoryLabels: Record<CategoryCode, string> = {
  ALLERGY: 'Ver todas las alergias',
  CONDITION: 'Ver todas las condiciones',
  MEDICATION: 'Ver todas las medicaciones',
  IMMUNIZATION: 'Ver todas las vacunas',
  EPISODE: 'Ver todos los episodios',
  EXAM_RESULT: 'Ver todos los exámenes',
}

/** La API ordena por creación y devuelve sólo una fila; el total corresponde a toda la categoría. */
export function clinicalCategoryOverview(page: Page<HealthEntry>) {
  return { latest: page.content[0] ?? null, total: page.totalElements }
}
