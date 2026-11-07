import type { ChangeType, HealthEntryVersion } from '../types'
import { confidenceLabels, formatDate } from './format'

export type VersionField = 'title' | 'details' | 'dose' | 'frequency' | 'occurredOn' | 'confidenceLevel' | 'notes'

export const versionFieldLabels: Record<VersionField, string> = {
  title: 'Título',
  details: 'Detalles',
  dose: 'Dosis',
  frequency: 'Frecuencia',
  occurredOn: 'Fecha',
  confidenceLevel: 'Certeza',
  notes: 'Notas',
}

export const changeTypeLabels: Record<ChangeType, string> = {
  CREATED: 'Creado',
  UPDATED: 'Editado',
  DELETED: 'Eliminado',
}

export function displayField(field: VersionField, version: HealthEntryVersion): string {
  const value = version[field]
  if (!value) return '—'
  if (field === 'confidenceLevel') return confidenceLabels[version.confidenceLevel]
  if (field === 'occurredOn') return formatDate(value)
  return value
}

/** Campos que cambiaron respecto de la versión anterior. */
export function changedFields(current: HealthEntryVersion, previous: HealthEntryVersion): VersionField[] {
  return (Object.keys(versionFieldLabels) as VersionField[]).filter(
    (field) => (current[field] ?? null) !== (previous[field] ?? null),
  )
}
