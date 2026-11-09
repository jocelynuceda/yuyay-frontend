import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  applyAcceptedMatches,
  createMedicalTermMatcher,
  type MedicalTermsData,
  type TermMatch,
} from '../src/utils/medicalTermMatcher'
import { RECETA_UNICA_MINSA } from './fixtures/ocr-recetas'

const data = JSON.parse(
  readFileSync(new URL('../src/data/medicalTerms.json', import.meta.url), 'utf8'),
) as MedicalTermsData
const matcher = createMedicalTermMatcher(data)

const suggestion = (word: string) => {
  const result = matcher.matchWord(word)
  return result?.kind === 'suggestion' ? result.term : null
}

test('diccionario: trae las cuatro fuentes y cada una con contenido', () => {
  assert.ok(data.es.length > 400, 'PNUME')
  assert.ok(data.dispositivos.length > 40, 'PNUDME')
  assert.ok(data.rxIngredientes.length > 2000, 'RxNorm')
  for (const name of ['ranitidina', 'prednisona', 'prednisolona', 'clorfenamina', 'ibuprofeno']) {
    assert.ok(data.es.includes(name), name)
  }
  assert.ok(data.comunes.includes('hioscina'))
  assert.ok(data.dispositivos.includes('jeringa'))
  assert.equal(data.equivalencias.ibuprofen, 'ibuprofeno')
})

test('matchWord: corrige errores de OCR de la receta real del MINSA', () => {
  assert.equal(suggestion('Panitidina'), 'Ranitidina')
  assert.equal(suggestion('Hiosina'), 'Hioscina')
  assert.equal(suggestion('Joringa'), 'Jeringa')
  assert.equal(suggestion('Azitromisina'), 'Azitromicina')
  assert.equal(suggestion('Omeprasol'), 'Omeprazol')
})

test('matchWord: palabras sin un fármaco claro no reciben sugerencia', () => {
  for (const word of [
    'Dimininitrato',
    'Paracetamd',
    'Cantidad',
    'Consulta',
    'Lucia',
    'Pediatría',
    'Medicina',
    'Tabletas',
  ]) {
    assert.equal(matcher.matchWord(word), null, word)
  }
})

test('matchWord: nombres parecidos (prednisona / prednisolona) no se confunden', () => {
  assert.equal(matcher.matchWord('Prednisolona')?.kind, 'known')
  assert.equal(matcher.matchWord('Prednisona')?.kind, 'known')
  // a la misma distancia de ambos: no se arriesga
  assert.equal(matcher.matchWord('Prednisolna'), null)
  assert.equal(suggestion('Prednisna'), 'Prednisona')
})

test('matchWord: un nombre en inglés válido se reconoce y no compite con su par en español', () => {
  assert.equal(matcher.matchWord('Ibuprofen')?.kind, 'known')
  assert.equal(matcher.matchWord('IBUPROFENO')?.kind, 'known')
  assert.equal(matcher.matchWord('Losartan')?.kind, 'known', 'sin tilde también')
})

test('matchWord: palabras cortas no se comparan', () => {
  assert.equal(matcher.matchWord('Amp.'), null)
  assert.equal(matcher.matchWord('Tab'), null)
})

test('findInText: solo mira la zona de la receta y una coincidencia por línea', () => {
  const matches = matcher.findInText(RECETA_UNICA_MINSA)
  const summary = matches.map((m) => `${m.kind}:${m.original}->${m.term}`)
  assert.deepEqual(summary, [
    'suggestion:Hiosina->Hioscina',
    'suggestion:Panitidina->Ranitidina',
    'suggestion:Joringa->Jeringa',
  ])
  const lines = RECETA_UNICA_MINSA.split('\n')
  for (const m of matches) assert.ok(lines[m.lineIndex].includes(m.original))
})

test('findInText: sin "Rp." usa las líneas con dosis y la anterior si la dosis va sola', () => {
  const text = [
    'Paciente: Lucia Prueba Ramos',
    'Amoxicilna',
    '500 mg cada 8 horas',
    'Clorfenamna 4mg',
    'Consulta externa',
  ].join('\n')
  const summary = matcher.findInText(text).map((m) => `${m.lineIndex}:${m.term}`)
  assert.deepEqual(summary, ['1:Amoxicilina', '3:Clorfenamina'])
})

test('findInText: reconoce nombres de varias palabras y salta un número inicial', () => {
  const text = ['Rp.', '1. Acido acetilsalicilico 100 mg', 'Sulfato ferroso 300mg', 'Firma y sello'].join('\n')
  const matches = matcher.findInText(text)
  assert.deepEqual(
    matches.map((m) => [m.kind, m.original, m.term]),
    [
      ['known', 'Acido acetilsalicilico', 'Ácido acetilsalicílico'],
      ['known', 'Sulfato ferroso', 'Sulfato ferroso'],
    ],
  )
})

test('findInText: se detiene en la firma o la fecha de atención', () => {
  const text = ['Rp: Panitidina 150 mg', 'Fecha de atención', 'Omeprasol 20 mg'].join('\n')
  const matches = matcher.findInText(text)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].term, 'Ranitidina')
  assert.equal(matches[0].lineIndex, 0)
})

test('applyAcceptedMatches: solo cambia las sugerencias aceptadas en su línea', () => {
  const text = 'Rp.\nPanitidina 10mg\nHiosina 20mg\nNota: Panitidina'
  const matches = matcher.findInText(text)
  const ranitidina = matches.find((m) => m.term === 'Ranitidina')!
  const known: TermMatch = { kind: 'known', lineIndex: 2, original: 'Hiosina', term: 'Hioscina', source: 'COMUN' }
  assert.equal(applyAcceptedMatches(text, [ranitidina, known]), 'Rp.\nRanitidina 10mg\nHiosina 20mg\nNota: Panitidina')
  assert.equal(applyAcceptedMatches(text, []), text)
})
