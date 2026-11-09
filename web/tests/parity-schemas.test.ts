// Funciones que la app móvil ya tenía: exámenes, hora de las citas y citas compartidas al delegar.
import assert from 'node:assert/strict'
import test from 'node:test'
import { consultationSchema, consultationToForm, toConsultationUpdate } from '../src/schemas/consultation'
import { delegationSchema } from '../src/schemas/delegation'
import { healthEntrySchema } from '../src/schemas/healthEntry'
import { categoryLabels, consultationOrder, formatTime } from '../src/utils/format'

test('La categoría Examen es válida y tiene nombre', () => {
  const values = { categoryCode: 'EXAM_RESULT', title: 'Hemograma', details: '', dose: '', frequency: '', occurredOn: '', confidenceLevel: 'CONFIRMED', notes: '' }
  assert.equal(healthEntrySchema.safeParse(values).success, true)
  assert.deepEqual(categoryLabels.EXAM_RESULT, { name: 'Examen', plural: 'Exámenes' })
})

const delegation = { granteeName: 'Ana', granteeEmail: 'ana@example.test', validUntil: '2099-01-01T10:00' }

test('Una delegación puede compartir solo citas, pero no puede ir vacía', () => {
  assert.equal(delegationSchema.safeParse({ ...delegation, categoryCodes: [], includeConsultations: true }).success, true)
  assert.equal(delegationSchema.safeParse({ ...delegation, categoryCodes: ['ALLERGY'], includeConsultations: false }).success, true)
  const empty = delegationSchema.safeParse({ ...delegation, categoryCodes: [], includeConsultations: false })
  assert.equal(empty.error?.issues[0].message, 'Elige al menos una categoría o las citas.')
})

const consultation = { date: '2026-11-20', reason: 'Control', notes: '' }

test('La hora de la cita es opcional y se valida', () => {
  assert.equal(consultationSchema.parse({ ...consultation, time: '' }).time, null)
  assert.equal(consultationSchema.parse({ ...consultation, time: '15:30' }).time, '15:30')
  assert.equal(consultationSchema.safeParse({ ...consultation, time: '25:00' }).success, false)
})

test('Editar una cita conserva la hora o pide quitarla, y permite vaciar las notas', () => {
  const withTime = consultationSchema.parse({ ...consultation, time: '15:30' })
  assert.deepEqual(toConsultationUpdate(withTime), { date: '2026-11-20', time: '15:30', clearTime: false, reason: 'Control', notes: '' })
  const withoutTime = consultationSchema.parse({ ...consultation, time: '' })
  assert.deepEqual(toConsultationUpdate(withoutTime), { date: '2026-11-20', clearTime: true, reason: 'Control', notes: '' })
})

test('El formulario recibe la hora sin segundos', () => {
  const saved = { id: 1, careSubjectId: 1, createdByUserId: 1, date: '2026-11-20', time: '15:30:00', reason: 'Control', notes: null, createdAt: '' }
  assert.equal(consultationToForm(saved).time, '15:30')
  assert.equal(consultationToForm({ ...saved, time: null }).time, '')
})

test('formatTime usa 12 horas y consultationOrder deja al final las citas sin hora', () => {
  assert.match(formatTime('15:30:00'), /^3:30/)
  const order = [{ date: '2026-11-20', time: null }, { date: '2026-11-20', time: '09:00:00' }, { date: '2026-11-19', time: null }]
    .sort((a, b) => consultationOrder(a).localeCompare(consultationOrder(b)))
    .map((c) => `${c.date} ${c.time}`)
  assert.deepEqual(order, ['2026-11-19 null', '2026-11-20 09:00:00', '2026-11-20 null'])
})
