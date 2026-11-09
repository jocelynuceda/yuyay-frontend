export type MedicalTermsData = {
  version: number
  generatedAt: string
  sources: { PNUME: string; PNUDME: string; COMUN: string; RXNORM: string }
  es: string[]
  comunes: string[]
  dispositivos: string[]
  rxIngredientes: string[]
  rxMarcas: string[]
  equivalencias: Record<string, string>
}

export type TermSource = 'PNUME' | 'PNUDME' | 'COMUN' | 'RXNORM'

export type TermMatchResult = {
  kind: 'known' | 'suggestion'
  term: string
  source: TermSource
  similarity: number
  margin: number
}

export type TermMatch =
  | {
      kind: 'known'
      lineIndex: number
      original: string
      term: string
      source: TermSource
    }
  | {
      kind: 'suggestion'
      lineIndex: number
      original: string
      term: string
      source: TermSource
      similarity: number
      margin: number
    }

export type MedicalTermMatcher = {
  matchWord(text: string): TermMatchResult | null
  findInText(ocrText: string): TermMatch[]
}

export type MatcherOptions = {
  minLetters: number
  minSimilarity: number
  minMargin: number
  minJaccard: number
  maxWords: number
}

export const DEFAULT_MATCHER_OPTIONS: MatcherOptions = {
  minLetters: 5,
  minSimilarity: 0.85,
  minMargin: 0.08,
  minJaccard: 0.25,
  maxWords: 3,
}

type Entry = {
  key: string
  group: string
  name: string
  source: TermSource
  brand: boolean
  rank: number
  trigramCount: number
}

const SOURCE_RANK: Record<TermSource, number> = {
  PNUME: 0,
  COMUN: 1,
  PNUDME: 2,
  RXNORM: 3,
}
const START_MARKER = /^(rp|r\/p|rx)\s*[.:]?(\s|$)/i
const END_MARKER = /(firma|sello|fecha de atenci[oó]n|v[aá]lido hasta|indicaciones)/i
const DOSE = /\d+(?:[.,]\d+)?\s*(mg|mcg|ug|g|ml|cc|ui|%)(?![\p{L}\d])/iu
const WORD = /^([^\p{L}]*)(\p{L}+(?:-\p{L}+)*)[^\p{L}]*$/u

/** Minúsculas, sin tildes y solo letras a-z separadas por un espacio. Solo para comparar. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

function trigrams(key: string): Set<string> {
  const padded = `  ${key} `
  const result = new Set<string>()
  for (let i = 0; i + 3 <= padded.length; i++) result.add(padded.slice(i, i + 3))
  return result
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  let curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function displayName(entry: Entry): string {
  if (entry.brand) return entry.name
  return entry.name.charAt(0).toUpperCase() + entry.name.slice(1)
}

type Word = { text: string; start: number; end: number }

/** Palabras iniciales de una línea, hasta el primer token con números (un primer token numérico se ignora). */
function leadingWords(line: string): Word[] {
  const words: Word[] = []
  const tokens = line.matchAll(/\S+/g)
  let first = true
  for (const token of tokens) {
    const raw = token[0]
    if (/\d/.test(raw)) {
      if (first && !words.length) {
        first = false
        continue
      }
      break
    }
    first = false
    const parsed = WORD.exec(raw)
    if (!parsed) break
    const start = token.index + parsed[1].length
    words.push({ text: parsed[2], start, end: start + parsed[2].length })
  }
  return words
}

type Segment = { lineIndex: number; text: string }

function prescriptionZone(lines: string[]): Segment[] {
  const startIndex = lines.findIndex((line) => START_MARKER.test(line.trim()))
  if (startIndex >= 0) {
    const segments: Segment[] = []
    const marker = START_MARKER.exec(lines[startIndex].trim())
    const trimmed = lines[startIndex].trim()
    const remainder = marker ? trimmed.slice(marker[0].length) : ''
    if (remainder.trim()) segments.push({ lineIndex: startIndex, text: remainder })
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (END_MARKER.test(lines[i])) break
      segments.push({ lineIndex: i, text: lines[i] })
    }
    return segments
  }
  const included = new Set<number>()
  lines.forEach((line, i) => {
    if (!DOSE.test(line)) return
    included.add(i)
    if (i > 0 && /^\d/.test(line.trim())) included.add(i - 1)
  })
  return [...included].sort((a, b) => a - b).map((i) => ({ lineIndex: i, text: lines[i] }))
}

export function createMedicalTermMatcher(
  data: MedicalTermsData,
  options: Partial<MatcherOptions> = {},
): MedicalTermMatcher {
  const opts: MatcherOptions = { ...DEFAULT_MATCHER_OPTIONS, ...options }
  const entries: Entry[] = []
  const byKey = new Map<string, Entry>()
  const index = new Map<string, number[]>()

  const lists: [string[], TermSource, boolean][] = [
    [data.es, 'PNUME', false],
    [data.comunes, 'COMUN', false],
    [data.dispositivos, 'PNUDME', false],
    [data.rxIngredientes, 'RXNORM', false],
    [data.rxMarcas, 'RXNORM', true],
  ]
  for (const [names, source, brand] of lists) {
    for (const name of names) {
      const key = normalize(name)
      if (!key || byKey.has(key)) continue
      const grams = trigrams(key)
      const entry: Entry = {
        key,
        group: normalize(data.equivalencias[name] ?? name) || key,
        name,
        source,
        brand,
        rank: SOURCE_RANK[source],
        trigramCount: grams.size,
      }
      const id = entries.length
      entries.push(entry)
      byKey.set(key, entry)
      for (const gram of grams) {
        const ids = index.get(gram)
        if (ids) ids.push(id)
        else index.set(gram, [id])
      }
    }
  }

  function matchWord(text: string): TermMatchResult | null {
    const key = normalize(text)
    if (key.replace(/ /g, '').length < opts.minLetters) return null
    const exact = byKey.get(key)
    if (exact)
      return {
        kind: 'known',
        term: displayName(exact),
        source: exact.source,
        similarity: 1,
        margin: 1,
      }

    const grams = trigrams(key)
    const shared = new Map<number, number>()
    for (const gram of grams) {
      const ids = index.get(gram)
      if (!ids) continue
      for (const id of ids) shared.set(id, (shared.get(id) ?? 0) + 1)
    }

    const candidates: { entry: Entry; jaccard: number; similarity: number }[] = []
    for (const [id, count] of shared) {
      const entry = entries[id]
      const jaccard = count / (grams.size + entry.trigramCount - count)
      if (jaccard < opts.minJaccard) continue
      const similarity = 1 - levenshtein(key, entry.key) / Math.max(key.length, entry.key.length)
      candidates.push({ entry, jaccard, similarity })
    }
    if (!candidates.length) return null

    let best = candidates[0]
    for (const candidate of candidates) {
      if (
        candidate.similarity > best.similarity ||
        (candidate.similarity === best.similarity &&
          (candidate.jaccard > best.jaccard ||
            (candidate.jaccard === best.jaccard && candidate.entry.rank < best.entry.rank)))
      ) {
        best = candidate
      }
    }
    let second = 0
    for (const candidate of candidates) {
      if (candidate.entry.group !== best.entry.group && candidate.similarity > second) second = candidate.similarity
    }
    const margin = best.similarity - second
    if (best.similarity < opts.minSimilarity || margin < opts.minMargin) return null
    return {
      kind: 'suggestion',
      term: displayName(best.entry),
      source: best.entry.source,
      similarity: best.similarity,
      margin,
    }
  }

  function matchLine(segment: Segment): TermMatch | null {
    const words = leadingWords(segment.text)
    for (let from = 0; from <= 1; from++) {
      const available = words.length - from
      for (let size = Math.min(opts.maxWords, available); size >= 1; size--) {
        const window = words.slice(from, from + size)
        const result = matchWord(window.map((w) => w.text).join(' '))
        if (!result) continue
        const original = segment.text.slice(window[0].start, window[size - 1].end)
        if (result.kind === 'known') {
          return {
            kind: 'known',
            lineIndex: segment.lineIndex,
            original,
            term: result.term,
            source: result.source,
          }
        }
        return {
          kind: 'suggestion',
          lineIndex: segment.lineIndex,
          original,
          term: result.term,
          source: result.source,
          similarity: result.similarity,
          margin: result.margin,
        }
      }
    }
    return null
  }

  function findInText(ocrText: string): TermMatch[] {
    const lines = ocrText.split(/\r?\n/)
    const matches: TermMatch[] = []
    for (const segment of prescriptionZone(lines)) {
      const match = matchLine(segment)
      if (match) matches.push(match)
    }
    return matches
  }

  return { matchWord, findInText }
}

/** Aplica solo las sugerencias aceptadas, reemplazando la primera aparición en su línea. */
export function applyAcceptedMatches(ocrText: string, accepted: TermMatch[]): string {
  const lines = ocrText.split(/\r?\n/)
  for (const match of accepted) {
    if (match.kind !== 'suggestion') continue
    const line = lines[match.lineIndex]
    if (line === undefined) continue
    const at = line.indexOf(match.original)
    if (at < 0) continue
    lines[match.lineIndex] = line.slice(0, at) + match.term + line.slice(at + match.original.length)
  }
  return lines.join('\n')
}
