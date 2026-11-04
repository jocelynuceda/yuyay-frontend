import type { CategoryCode, ConfidenceLevel } from '../types'

const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Las fechas LocalDate ('2024-05-01') se leen en hora local para no correrse un día. */
function parse(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

export const formatDate = (value?: string | null) => (value ? dateFormatter.format(parse(value)) : '—')

export const formatDateTime = (value?: string | null) => (value ? dateTimeFormatter.format(parse(value)) : '—')

/** Nombres de las categorías del backend (DataSeeder). */
export const categoryLabels: Record<CategoryCode, { name: string; plural: string }> = {
  ALLERGY: { name: 'Alergia', plural: 'Alergias' },
  CONDITION: { name: 'Condición', plural: 'Condiciones' },
  MEDICATION: { name: 'Medicación', plural: 'Medicación' },
  IMMUNIZATION: { name: 'Vacuna', plural: 'Vacunas' },
  EPISODE: { name: 'Episodio', plural: 'Episodios' },
}

export const confidenceLabels: Record<ConfidenceLevel, string> = {
  CONFIRMED: 'Confirmado',
  UNCERTAIN: 'Por confirmar',
}
