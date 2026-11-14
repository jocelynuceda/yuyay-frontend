// Las reglas de los formularios de la web son las mismas que las de la app móvil (mobile/src/utils/dates.ts y sus pantallas).
import assert from 'node:assert/strict'
import test from 'node:test'
import { careSubjectSchema } from '../src/schemas/careSubject'
import { maxYear, todayIso } from '../src/schemas/common'
import { consultationSchema } from '../src/schemas/consultation'
import { delegationSchema } from '../src/schemas/delegation'
import { handoffSchema } from '../src/schemas/handoff'
import { healthEntrySchema } from '../src/schemas/healthEntry'
import { validateEntryAttachment } from '../src/utils/attachments'
import { canManageHandoffLinks, handoffLinkState } from '../src/utils/handoffLinks'

const shift = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const message = (result: { error?: { issues: { message: string }[] } }) => result.error?.issues[0].message

const entry = { categoryCode: 'ALLERGY', title: 'Penicilina', details: '', dose: '', frequency: '', occurredOn: '', confidenceLevel: 'CONFIRMED', notes: '' }

test('Fecha de un registro: hoy o antes, desde 1900', () => {
  assert.equal(healthEntrySchema.safeParse({ ...entry, occurredOn: todayIso() }).success, true)
  assert.equal(message(healthEntrySchema.safeParse({ ...entry, occurredOn: shift(1) })), 'La fecha no puede ser futura.')
  assert.equal(message(healthEntrySchema.safeParse({ ...entry, occurredOn: '1899-12-31' })), 'El año debe ser 1900 o posterior.')
})

test('Límites de texto de la app móvil: detalles 2000, notas 500', () => {
  assert.equal(healthEntrySchema.safeParse({ ...entry, details: 'x'.repeat(2000), notes: 'x'.repeat(500) }).success, true)
  assert.equal(message(healthEntrySchema.safeParse({ ...entry, details: 'x'.repeat(2001) })), 'Máximo 2000 caracteres.')
  assert.equal(message(healthEntrySchema.safeParse({ ...entry, notes: 'x'.repeat(501) })), 'Máximo 500 caracteres.')
})

test('Persona: nacimiento anterior a hoy y notas de hasta 500 caracteres', () => {
  const person = { name: 'Rosa', birthDate: '', notes: '' }
  assert.equal(message(careSubjectSchema.safeParse({ ...person, birthDate: todayIso() })), 'La fecha debe ser anterior a hoy.')
  assert.equal(message(careSubjectSchema.safeParse({ ...person, birthDate: '1899-01-01' })), 'El año debe ser 1900 o posterior.')
  assert.equal(message(careSubjectSchema.safeParse({ ...person, notes: 'x'.repeat(501) })), 'Máximo 500 caracteres.')
})

test('Cita: puede ser pasada o futura, hasta dentro de 2 años', () => {
  const c = { time: '', reason: 'Control', notes: '' }
  assert.equal(consultationSchema.safeParse({ ...c, date: shift(-30) }).success, true)
  assert.equal(consultationSchema.safeParse({ ...c, date: `${maxYear(2)}-12-31` }).success, true)
  assert.equal(message(consultationSchema.safeParse({ ...c, date: `${maxYear(3)}-01-01` })), `El año debe ser ${maxYear(2)} o anterior.`)
})

test('Delegación: se elige el día, desde hoy hasta el año próximo, y vence al final de ese día', () => {
  const d = { granteeName: 'Luz', granteeEmail: 'luz@example.test', categoryCodes: ['ALLERGY'], includeConsultations: false }
  const today = delegationSchema.parse({ ...d, validUntil: todayIso() })
  const end = new Date(today.validUntil)
  assert.equal(end.getHours(), 23)
  assert.equal(end.getMinutes(), 59)
  assert.equal(message(delegationSchema.safeParse({ ...d, validUntil: shift(-1) })), 'La fecha no puede ser anterior a hoy.')
  assert.equal(message(delegationSchema.safeParse({ ...d, validUntil: `${maxYear(2)}-01-01` })), `El año debe ser ${maxYear(1)} o anterior.`)
})

test('Resumen: motivo de hasta 200 caracteres y preguntas de hasta 500', () => {
  const h = { healthEntryIds: [1], reason: 'Control', questions: '' }
  assert.equal(message(handoffSchema.safeParse({ ...h, reason: 'x'.repeat(201) })), 'Máximo 200 caracteres.')
  assert.equal(message(handoffSchema.safeParse({ ...h, questions: 'x'.repeat(501) })), 'Máximo 500 caracteres.')
})

test('Adjunto de un registro: foto, PDF o audio de hasta 10 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'application/pdf', 'audio/mp4', 'audio/x-m4a', 'audio/webm;codecs=opus']) {
    assert.equal(validateEntryAttachment({ type, size: 1 }), null, type)
  }
  assert.match(validateEntryAttachment({ type: 'image/heic', size: 1 })!, /Formato no permitido/)
  assert.match(validateEntryAttachment({ type: 'audio/mp4', size: 10 * 1024 * 1024 + 1 })!, /10 MB/)
})

test('el estado del enlace de un resumen sigue la regla del backend', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  const base = { expiresAt: '2026-11-14T12:00:00Z', sessionWindowMinutes: 30, firstOpenedAt: null, revokedAt: null }
  assert.equal(handoffLinkState(base, now), 'Sin abrir')
  assert.equal(handoffLinkState({ ...base, revokedAt: '2026-11-13T11:00:00Z' }, now), 'Revocado')
  assert.equal(handoffLinkState({ ...base, expiresAt: '2026-11-13T11:59:00Z' }, now), 'Vencido')
  assert.equal(handoffLinkState({ ...base, firstOpenedAt: '2026-11-13T11:50:00Z' }, now), 'Abierto')
  // La ventana de 30 minutos desde la primera apertura ya pasó, aunque expiresAt no haya llegado
  assert.equal(handoffLinkState({ ...base, firstOpenedAt: '2026-11-13T11:29:00Z' }, now), 'Vencido')
})

test('solo quien creó el resumen o el cuidador principal maneja sus enlaces', () => {
  assert.equal(canManageHandoffLinks(7, 7, false), true)
  assert.equal(canManageHandoffLinks(7, 8, true), true)
  assert.equal(canManageHandoffLinks(7, 8, false), false)
  assert.equal(canManageHandoffLinks(7, undefined, false), false)
})
