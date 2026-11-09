import type { CategoryCode } from '../types'

export interface OcrSuggestion {
  title?: string
  categoryCode?: CategoryCode
  /** yyyy-mm-dd */
  occurredOn?: string
  /** Líneas originales del texto que justifican cada sugerencia. */
  evidence: { title?: string; categoryCode?: string; occurredOn?: string }
}

const DATE_PATTERN = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g
const MAX_LABEL_DISTANCE = 2
const ATTENTION_LABELS = ['fecha de atencion', 'fecha de emision', 'fecha de expedicion', 'fecha de la consulta']
// OCR separa "Fecha / Hora" y "de Atención:" en líneas distintas; "de atencion" solo vale al inicio de línea
const ATTENTION_PREFIXES = ['de atencion']
const EXCLUDING_LABELS = [
  'vigencia',
  'valido hasta',
  'vence',
  'vencimiento',
  'nacimiento',
  'f. nac',
  'caduca',
  'proxima cita',
  'proximo control',
  'proxima consulta',
  'retorno',
]

const HEADERS: { prefixes: string[]; title: string; categoryCode: CategoryCode }[] = [
  { prefixes: ['receta'], title: 'Receta médica', categoryCode: 'MEDICATION' },
  {
    prefixes: ['carnet de vacunacion', 'carne de vacunacion', 'tarjeta de vacunacion'],
    title: 'Carné de vacunación',
    categoryCode: 'IMMUNIZATION',
  },
]

/** Minúsculas, sin tildes y con espacios colapsados. Solo para comparar: el texto original no se toca. */
export function normalizeLine(line: string): string {
  return line
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fecha real del calendario (sin 31/02, con bisiestos), año entre 1900 y 2100. */
export function isValidDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Año de 2 dígitos: 2000+yy si yy <= (año actual % 100) + 1, si no 1900+yy. */
export function expandYear(year: string, currentYear: number): number {
  if (year.length === 4) return Number(year)
  const yy = Number(year)
  return yy <= (currentYear % 100) + 1 ? 2000 + yy : 1900 + yy
}

/** Fechas dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy o con año de 2 dígitos válidas de una línea, como yyyy-mm-dd. */
export function findDates(line: string, currentYear = new Date().getFullYear()): string[] {
  const found: string[] = []
  for (const match of line.matchAll(DATE_PATTERN)) {
    const [day, month, year] = [Number(match[1]), Number(match[2]), expandYear(match[3], currentYear)]
    if (isValidDate(day, month, year)) {
      found.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
  }
  return found
}

type LabelKind = 'attention' | 'excluding'

/** "Fecha" genérica: sin fechas ni separadores solo queda "fecha" o "fecha hora". */
function isGenericDateLabel(normalized: string): boolean {
  const rest = normalized
    .replace(new RegExp(DATE_PATTERN.source, 'g'), ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm|a\.?m\.?|p\.?m\.?))?/g, ' ')
    .replace(/[:/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return rest === 'fecha' || rest === 'fecha hora'
}

/** Una línea es encabezado si empieza con el prefijo (sin letra después) y no tiene ':'. */
function matchesHeader(normalized: string, prefix: string): boolean {
  return normalized.startsWith(prefix) && !/\p{L}/u.test(normalized.charAt(prefix.length)) && !normalized.includes(':')
}

function labelKind(normalized: string): LabelKind | null {
  if (EXCLUDING_LABELS.some((word) => normalized.includes(word))) return 'excluding'
  if (ATTENTION_LABELS.some((word) => normalized.includes(word))) return 'attention'
  if (ATTENTION_PREFIXES.some((word) => normalized.startsWith(word))) return 'attention'
  if (isGenericDateLabel(normalized)) return 'attention'
  return null
}

function isPrescriptionMarker(normalized: string): boolean {
  return /^rp[.:]?$/.test(normalized.replace(/\s/g, ''))
}

export function suggestEntryFromOcr(text: string, currentYear = new Date().getFullYear()): OcrSuggestion {
  const lines = text.split(/\r\n|\r|\n/)
  const normalized = lines.map(normalizeLine)
  const suggestion: OcrSuggestion = { evidence: {} }

  for (let i = 0; i < lines.length; i++) {
    const header = isPrescriptionMarker(normalized[i])
      ? HEADERS[0]
      : HEADERS.find((h) => h.prefixes.some((prefix) => matchesHeader(normalized[i], prefix)))
    if (!header) continue
    suggestion.title = header.title
    suggestion.categoryCode = header.categoryCode
    suggestion.evidence.title = lines[i].trim()
    suggestion.evidence.categoryCode = lines[i].trim()
    break
  }

  const dates = lines.map((line) => findDates(line, currentYear))
  // Las líneas sin letras ni números (por ejemplo "/ /") no cuentan para la distancia
  const meaningful = lines.map((_, i) => i).filter((i) => /[\p{L}\p{N}]/u.test(lines[i]))
  const candidates: { date: string; evidence: string }[] = []

  for (let pos = 0; pos < meaningful.length; pos++) {
    const i = meaningful[pos]
    if (!dates[i].length) continue
    const own = labelKind(normalized[i])
    if (own === 'excluding') continue
    if (own === 'attention') {
      for (const date of dates[i]) candidates.push({ date, evidence: lines[i].trim() })
      continue
    }
    for (let distance = 1; distance <= MAX_LABEL_DISTANCE; distance++) {
      const found = [pos - distance, pos + distance]
        .filter((at) => at >= 0 && at < meaningful.length && !dates[meaningful[at]].length)
        .map((at) => ({ line: meaningful[at], kind: labelKind(normalized[meaningful[at]]) }))
        .find((neighbor) => neighbor.kind)
      if (!found) continue
      if (found.kind === 'attention') {
        for (const date of dates[i]) {
          candidates.push({ date, evidence: `${lines[found.line].trim()} / ${lines[i].trim()}` })
        }
      }
      break
    }
  }

  if (candidates.length && candidates.every((c) => c.date === candidates[0].date)) {
    suggestion.occurredOn = candidates[0].date
    suggestion.evidence.occurredOn = candidates[0].evidence
  }
  return suggestion
}
