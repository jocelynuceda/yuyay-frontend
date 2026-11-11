import type { DocumentScopeLabel } from '../types'

export type ScopeTone = 'positive' | 'neutral' | 'danger'

const badges: Record<DocumentScopeLabel, { text: string; tone: ScopeTone }> = {
  MEDICAL: { text: 'Uso adecuado', tone: 'positive' },
  REVIEW: { text: 'No seguro', tone: 'neutral' },
  NONMEDICAL: { text: 'Posible uso ajeno', tone: 'danger' },
}

const help: Record<DocumentScopeLabel, string> = {
  MEDICAL: 'El texto parece de un documento de salud.',
  REVIEW: 'No pudimos determinar si es un documento de salud.',
  NONMEDICAL: 'El texto no parece de un documento de salud. Si es un error, avisa al equipo.',
}

function isScopeLabel(label: unknown): label is DocumentScopeLabel {
  return typeof label === 'string' && Object.prototype.hasOwnProperty.call(badges, label)
}

/** Texto y tono de la etiqueta de uso; null si no hay clasificación o es desconocida. */
export function scopeBadge(label: DocumentScopeLabel | null | undefined): { text: string; tone: ScopeTone } | null {
  return isScopeLabel(label) ? { ...badges[label] } : null
}

/** Frase corta que explica la etiqueta; null si no hay clasificación o es desconocida. */
export function scopeHelp(label: DocumentScopeLabel | null | undefined): string | null {
  return isScopeLabel(label) ? help[label] : null
}
