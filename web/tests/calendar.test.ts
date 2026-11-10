import assert from 'node:assert/strict'
import test from 'node:test'
import { googleCalendarUrl } from '../src/utils/calendar'

process.env.TZ = 'America/New_York'

const consultation = { date: '2026-12-31', reason: 'Control & presión', notes: 'Notas clínicas privadas' }
const calendar = (time: string | null, date = consultation.date) =>
  new URL(googleCalendarUrl({ ...consultation, date, time }, 'María José'))

test('Calendar usa la hora local guardada, conserva el título y omite las notas clínicas', () => {
  const url = calendar('15:30:00')
  assert.equal(`${url.origin}${url.pathname}`, 'https://calendar.google.com/calendar/render')
  assert.equal(url.searchParams.get('action'), 'TEMPLATE')
  assert.equal(url.searchParams.get('text'), 'Cita de María José: Control & presión')
  assert.equal(url.searchParams.get('dates'), '20261231T203000Z/20261231T213000Z')
  assert.equal(url.searchParams.get('ctz'), 'America/New_York')
  assert.equal(url.searchParams.has('details'), false)
  assert.doesNotMatch(url.href, /privadas/)
})

test('Calendar conserva 60 minutos al cruzar medianoche o un cambio de horario', () => {
  assert.equal(calendar('23:30').searchParams.get('dates'), '20270101T043000Z/20270101T053000Z')
  assert.equal(calendar('01:30', '2026-03-08').searchParams.get('dates'), '20260308T063000Z/20260308T073000Z')
})

test('Calendar deja la consulta sin hora en su fecha local con fin exclusivo', () => {
  const url = calendar(null)
  assert.equal(url.searchParams.get('dates'), '20261231/20270101')
  assert.equal(url.searchParams.has('ctz'), false)
})
