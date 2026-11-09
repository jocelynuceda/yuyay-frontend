// Sugerencias de campos a partir del texto OCR (reglas conservadoras, sin IA).
import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidDate, suggestEntryFromOcr } from '../src/utils/ocrSuggestions'
import { RECETA_DIGEMID, RECETA_HOSPITAL, RECETA_PARTICULAR, RECETA_UNICA_MINSA } from './fixtures/ocr-recetas'

const fields = (s: ReturnType<typeof suggestEntryFromOcr>) => ({ title: s.title, categoryCode: s.categoryCode, occurredOn: s.occurredOn })

test('A. Receta única del MINSA (orden real de Textract, datos inventados): receta, medicación y fecha de atención', () => {
  const s = suggestEntryFromOcr(RECETA_UNICA_MINSA, 2026)
  assert.deepEqual(fields(s), { title: 'Receta médica', categoryCode: 'MEDICATION', occurredOn: '2024-08-02' })
  assert.match(s.evidence.title ?? '', /RECETA ÚNICA ESTANDARIZADA/)
  assert.match(s.evidence.occurredOn ?? '', /Fecha de atención/)
  assert.match(s.evidence.occurredOn ?? '', /02\/08\/2024/)
})

test('B. Receta de hospital: la fecha de vigencia no se confunde con la de atención', () => {
  const s = suggestEntryFromOcr(RECETA_HOSPITAL, 2026)
  assert.deepEqual(fields(s), { title: 'Receta médica', categoryCode: 'MEDICATION', occurredOn: '2023-07-05' })
  assert.doesNotMatch(s.evidence.occurredOn ?? '', /15\/07/)
})

test('C. Receta especial DIGEMID: fecha de expedición; RUC, DNI, H.C. y colegiatura no son fechas', () => {
  const s = suggestEntryFromOcr(RECETA_DIGEMID, 2026)
  assert.deepEqual(fields(s), { title: 'Receta médica', categoryCode: 'MEDICATION', occurredOn: '2025-01-09' })
})

test('D. Receta particular sin la palabra "receta": la marca Rp. la identifica; año de 2 dígitos', () => {
  const s = suggestEntryFromOcr(RECETA_PARTICULAR, 2026)
  assert.deepEqual(fields(s), { title: 'Receta médica', categoryCode: 'MEDICATION', occurredOn: '2020-01-03' })
  assert.equal(s.evidence.title?.trim(), 'Rp.')
})

test('Las sugerencias nunca tocan medicamentos, dosis ni diagnósticos', () => {
  for (const text of [RECETA_UNICA_MINSA, RECETA_HOSPITAL, RECETA_DIGEMID, RECETA_PARTICULAR]) {
    const s = suggestEntryFromOcr(text, 2026)
    assert.deepEqual(Object.keys(s).filter((k) => k !== 'evidence').sort(), ['categoryCode', 'occurredOn', 'title'])
  }
})

test('Documento sin encabezado claro: no inventa categoría ni título', () => {
  const s = suggestEntryFromOcr('Resultados\nAlergias:\nNinguna\nDiagnóstico\nControl anual\nPaciente: Rosa', 2026)
  assert.equal(s.title, undefined)
  assert.equal(s.categoryCode, undefined)
  assert.deepEqual(s.evidence, {})
})

test('Palabras sueltas de la plantilla ("Alergias:", "Epilepsia") no clasifican', () => {
  const s = suggestEntryFromOcr('Hospital\nAlergias: penicilina\nEpilepsia\nFecha de atención: 10/10/2024', 2026)
  assert.equal(s.categoryCode, undefined)
  assert.equal(s.occurredOn, '2024-10-10', 'la fecha sí puede sugerirse aunque no haya categoría')
})

test('"Código de Atención del SIS" no es una etiqueta de fecha', () => {
  const s = suggestEntryFromOcr(
    'Receta\nCódigo de Atención del SIS\n01/03/2024\nPaciente\nEdad\nDiagnóstico\nFecha de atención\n05/03/2024',
    2026,
  )
  assert.equal(s.occurredOn, '2024-03-05')
  const solo = suggestEntryFromOcr('Receta\nCódigo de Atención del SIS\n01/03/2024', 2026)
  assert.equal(solo.occurredOn, undefined)
})

test('Dos fechas de atención distintas: no sugiere ninguna', () => {
  const s = suggestEntryFromOcr('RECETA MÉDICA\nFecha de atención: 01/02/2024\nFecha de atención: 03/02/2024', 2026)
  assert.equal(s.occurredOn, undefined)
})

test('Fecha imposible o sin etiqueta: no sugiere', () => {
  assert.equal(suggestEntryFromOcr('RECETA\nFecha de atención: 31/02/2024', 2026).occurredOn, undefined)
  assert.equal(suggestEntryFromOcr('RECETA\nTotal 12/03/2024\nGracias', 2026).occurredOn, undefined)
})

test('Fecha de nacimiento o de vencimiento junto a la de atención: solo usa la de atención', () => {
  const s = suggestEntryFromOcr('RECETA\nF. Nac.: 12/03/1950\nVálido hasta: 20/07/2023\nFecha de atención\n05/07/2023', 2026)
  assert.equal(s.occurredOn, '2023-07-05')
  assert.equal(suggestEntryFromOcr('RECETA\nVálido hasta\n20/07/2023', 2026).occurredOn, undefined)
})

test('Carné de vacunación: título y categoría de vacuna', () => {
  const s = suggestEntryFromOcr('CARNÉ DE VACUNACIÓN\nNombre: Lucía', 2026)
  assert.equal(s.title, 'Carné de vacunación')
  assert.equal(s.categoryCode, 'IMMUNIZATION')
})

test('isValidDate: calendario real y años bisiestos', () => {
  assert.equal(isValidDate(29, 2, 2024), true)
  assert.equal(isValidDate(29, 2, 2023), false)
  assert.equal(isValidDate(31, 4, 2024), false)
  assert.equal(isValidDate(0, 1, 2024), false)
})

test('No modifica el texto original', () => {
  const text = RECETA_UNICA_MINSA
  suggestEntryFromOcr(text, 2026)
  assert.equal(text, RECETA_UNICA_MINSA)
})
