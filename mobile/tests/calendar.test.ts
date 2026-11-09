import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCalendarUrl, parseTime, savedTime, timePartsOf, toApiTime } from '../src/utils/calendar.ts';

const cita = { date: '2026-11-20', reason: 'Control & presión', notes: null };
const datesOf = (url: string) => decodeURIComponent(new URL(url).searchParams.get('dates') ?? '');

test('una cita con hora dura una hora', () => {
  assert.equal(datesOf(googleCalendarUrl(cita, 'Rosa', { hour: 15, minute: 30 })), '20261120T153000/20261120T163000');
});

test('una cita cerca de medianoche termina al día siguiente', () => {
  assert.equal(datesOf(googleCalendarUrl(cita, 'Rosa', { hour: 23, minute: 30 })), '20261120T233000/20261121T003000');
});

test('sin hora sigue siendo un evento de todo el día', () => {
  const url = googleCalendarUrl(cita, 'Rosa');
  assert.equal(datesOf(url), '20261120/20261121');
  assert.equal(new URL(url).searchParams.has('ctz'), false);
});

test('parseTime convierte a 24 horas y rechaza horas que no existen', () => {
  const time = (hour: string, minute: string, period: 'am' | 'pm') => parseTime({ hour, minute, period });
  assert.deepEqual(time('12', '00', 'am'), { hour: 0, minute: 0 });
  assert.deepEqual(time('12', '15', 'pm'), { hour: 12, minute: 15 });
  assert.deepEqual(time('3', '', 'pm'), { hour: 15, minute: 0 });
  assert.equal(time('13', '00', 'pm'), null);
  assert.equal(time('0', '00', 'am'), null);
  assert.equal(time('9', '60', 'am'), null);
  assert.equal(time('', '30', 'am'), null);
});

test('la hora guardada vuelve igual al formulario y al backend', () => {
  assert.deepEqual(timePartsOf('15:30:00'), { hour: '3', minute: '30', period: 'pm' });
  assert.deepEqual(timePartsOf('00:05:00'), { hour: '12', minute: '05', period: 'am' });
  assert.deepEqual(timePartsOf('12:00:00'), { hour: '12', minute: '00', period: 'pm' });
  assert.equal(toApiTime(savedTime('09:05:00')), '09:05');
});
