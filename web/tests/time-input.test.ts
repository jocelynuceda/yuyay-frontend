import assert from 'node:assert/strict'
import test from 'node:test'
import { fromTime, toTime } from '../src/utils/time12'

test('la hora escrita con AM/PM se guarda en formato de 24 horas', () => {
  assert.equal(toTime('9', 'AM'), '09:00')
  assert.equal(toTime('930', 'PM'), '21:30')
  assert.equal(toTime('12:05', 'AM'), '00:05')
  assert.equal(toTime('12', 'PM'), '12:00')
  assert.equal(toTime('  ', 'PM'), '')
})

test('lo que no es una hora queda marcado para que el formulario lo rechace', () => {
  for (const text of ['13:00', '0', '9:75', 'nueve', '9:5']) assert.doesNotMatch(toTime(text, 'AM'), /^\d{2}:\d{2}$/, text)
})

test('una hora guardada se muestra en 12 horas', () => {
  assert.deepEqual(fromTime('15:30:00'), { text: '3:30', period: 'PM' })
  assert.deepEqual(fromTime('00:05'), { text: '12:05', period: 'AM' })
  assert.deepEqual(fromTime(''), { text: '', period: 'AM' })
})
