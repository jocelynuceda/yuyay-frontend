import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, describeDays, groupByPartOfDay, doseState, partOfDay, startOfWeek } from '../src/utils/medicationSchedule'
import type { AgendaDose } from '../src/types'

const dose = (time: string, extra: Partial<AgendaDose> = {}): AgendaDose => ({
  scheduleId: 1, healthEntryId: 1, careSubjectId: 1, careSubjectName: 'Rosa', medication: 'Losartán', dose: '50 mg',
  date: '2026-11-27', time, status: null, markedByName: null, markedAt: null, ...extra,
})

test('addDays y startOfWeek: cruzan meses y empiezan el lunes', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(startOfWeek('2026-11-27'), '2026-11-23', 'viernes → lunes')
  assert.equal(startOfWeek('2026-11-29'), '2026-11-23', 'domingo → lunes anterior')
  assert.equal(startOfWeek('2026-11-23'), '2026-11-23')
})

test('partOfDay: la madrugada cuenta como noche', () => {
  assert.equal(partOfDay('08:00:00'), 'morning')
  assert.equal(partOfDay('12:00:00'), 'afternoon')
  assert.equal(partOfDay('19:00:00'), 'night')
  assert.equal(partOfDay('00:00:00'), 'night')
  assert.deepEqual(groupByPartOfDay([dose('08:00:00'), dose('21:00:00')]).map((g) => g.part), ['morning', 'night'])
})

test('describeDays: todos los días o la lista en orden de la semana', () => {
  assert.equal(describeDays([]), 'Todos los días')
  assert.equal(describeDays(['THURSDAY', 'MONDAY']), 'Lunes y jueves')
  assert.equal(describeDays(['FRIDAY', 'MONDAY', 'WEDNESDAY']), 'Lunes, miércoles y viernes')
})

test('doseState: se marca desde 2 h antes hasta 30 min después; luego cuenta como no tomada', () => {
  const today = '2026-11-27'
  assert.equal(doseState(dose('08:00:00'), today, '05:59'), 'upcoming', 'faltan más de 2 h')
  assert.equal(doseState(dose('08:00:00'), today, '06:00'), 'due', 'justo 2 h antes')
  assert.equal(doseState(dose('08:00:00'), today, '08:30'), 'due', '30 min después todavía a tiempo')
  assert.equal(doseState(dose('08:00:00'), today, '08:31'), 'missed')
  assert.equal(doseState(dose('08:00:00', { status: 'LATE' }), today, '09:00'), 'marked')
  assert.equal(doseState(dose('00:30:00', { date: '2026-11-28' }), today, '23:00'), 'due', 'pasada la medianoche')
  assert.equal(doseState(dose('09:00:00', { date: '2026-11-28' }), today, '23:00'), 'upcoming', 'día siguiente')
  assert.equal(doseState(dose('23:50:00', { date: '2026-11-26' }), today, '00:10'), 'due', '20 min después, del día anterior')
  assert.equal(doseState(dose('23:00:00', { date: '2026-11-26' }), today, '00:10'), 'missed')
})
