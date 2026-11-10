import assert from 'node:assert/strict';
import test from 'node:test';
import { datePartsOf, liveDateError, parseDateParts } from '../src/utils/dates.ts';

// Día fijo para que las pruebas no dependan de cuándo se ejecutan
const today = new Date(2026, 10, 9);
const parts = (day: string, month: string, year: string) => ({ day, month, year });
const cita = { allowFuture: true, maxYearsAhead: 2, today };
const acceso = { allowFuture: true, maxYearsAhead: 1, notBefore: '2026-11-09', today };

test('una fecha válida se devuelve como AAAA-MM-DD', () => {
  assert.deepEqual(parseDateParts(parts('5', '3', '1950'), { today }), { iso: '1950-03-05' });
  assert.deepEqual(parseDateParts(parts('', '', ''), { today }), { iso: '' });
});

test('mes 56 o día 45 se rechazan con un mensaje claro', () => {
  assert.equal(parseDateParts(parts('31', '56', '2026'), cita).error, 'El mes va del 1 al 12.');
  assert.equal(parseDateParts(parts('45', '12', '2026'), cita).error, 'El día va del 1 al 31.');
  assert.equal(parseDateParts(parts('00', '12', '2026'), cita).error, 'El día va del 1 al 31.');
});

test('una fecha que no existe en el calendario se rechaza', () => {
  assert.equal(parseDateParts(parts('31', '02', '2026'), cita).error, 'Esa fecha no existe.');
  assert.equal(parseDateParts(parts('29', '02', '2027'), cita).error, 'Esa fecha no existe.');
  assert.equal(parseDateParts(parts('29', '02', '2028'), cita).iso, '2028-02-29');
});

test('una cita no puede estar a miles de años: el límite es el año actual + 2', () => {
  assert.equal(parseDateParts(parts('31', '12', '5556'), cita).error, 'El año debe ser 2028 o anterior.');
  assert.equal(parseDateParts(parts('31', '12', '2028'), cita).iso, '2028-12-31');
  assert.equal(parseDateParts(parts('01', '01', '1899'), cita).error, 'El año debe ser 1900 o posterior.');
});

test('nacimiento y examen no pueden ser futuros', () => {
  assert.equal(parseDateParts(parts('10', '11', '2026'), { today }).error, 'La fecha no puede ser futura.');
  assert.equal(parseDateParts(parts('09', '11', '2026'), { today }).iso, '2026-11-09', 'hoy sí vale');
});

test('el acceso temporal va de hoy a un año adelante', () => {
  assert.equal(parseDateParts(parts('08', '11', '2026'), acceso).error, 'La fecha no puede ser anterior a hoy.');
  assert.equal(parseDateParts(parts('09', '11', '2026'), acceso).iso, '2026-11-09');
  assert.equal(parseDateParts(parts('01', '01', '2028'), acceso).error, 'El año debe ser 2027 o anterior.');
});

test('mientras se escribe avisa del mes o el día imposible sin esperar a guardar', () => {
  assert.equal(liveDateError(parts('', '56', ''), cita), 'El mes va del 1 al 12.');
  assert.equal(liveDateError(parts('45', '', ''), cita), 'El día va del 1 al 31.');
  assert.equal(liveDateError(parts('', '0', ''), cita), 'El mes va del 1 al 12.');
  assert.equal(liveDateError(parts('31', '12', '5556'), cita), 'El año debe ser 2028 o anterior.');
});

test('mientras se escribe no molesta con lo que aún está incompleto', () => {
  assert.equal(liveDateError(parts('3', '', ''), cita), undefined);
  assert.equal(liveDateError(parts('31', '1', ''), cita), undefined);
  assert.equal(liveDateError(parts('31', '12', '20'), cita), undefined);
  assert.equal(liveDateError(parts('', '', ''), cita), undefined);
});

test('datePartsOf separa una fecha guardada en sus casillas', () => {
  assert.deepEqual(datePartsOf('2026-12-31'), parts('31', '12', '2026'));
});
