import assert from 'node:assert/strict'
import test from 'node:test'
import { scopeBadge, scopeHelp } from '../src/utils/documentScope'

test('scopeBadge: cada etiqueta del backend tiene su texto y tono', () => {
  assert.deepEqual(scopeBadge('MEDICAL'), { text: 'Uso adecuado', tone: 'positive' })
  assert.deepEqual(scopeBadge('REVIEW'), { text: 'No seguro', tone: 'neutral' })
  assert.deepEqual(scopeBadge('NONMEDICAL'), { text: 'Posible uso ajeno', tone: 'danger' })
})

test('scopeBadge: sin clasificación o con un valor desconocido no hay etiqueta', () => {
  assert.equal(scopeBadge(null), null)
  assert.equal(scopeBadge(undefined), null)
  assert.equal(scopeBadge('OTRA' as never), null)
  assert.equal(scopeBadge('toString' as never), null)
})

test('scopeHelp: explica la etiqueta sin acusar y calla si no hay clasificación', () => {
  assert.match(scopeHelp('NONMEDICAL') ?? '', /Si es un error, avisa al equipo/)
  assert.match(scopeHelp('REVIEW') ?? '', /No pudimos determinar/)
  assert.match(scopeHelp('MEDICAL') ?? '', /documento de salud/)
  assert.equal(scopeHelp(null), null)
  assert.equal(scopeHelp('OTRA' as never), null)
})
