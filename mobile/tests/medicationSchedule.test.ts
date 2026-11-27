import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  describeDays,
  doseReminderContent,
  doseReminderId,
  doseState,
  peopleIn,
  matchesWho,
  planDoseReminders,
  startOfWeek,
  takenStatusFor,
} from '../src/utils/medicationSchedule.ts';
import type { AgendaDose } from '../src/types/index.ts';

const dose = (date: string, time: string, extra: Partial<AgendaDose> = {}): AgendaDose => ({
  scheduleId: 1, healthEntryId: 1, careSubjectId: 1, careSubjectName: 'Rosa', mine: false, medication: 'Losartán',
  dose: '50 mg', date, time, status: null, markedByName: null, markedAt: null, ...extra,
});
const at = (date: string, time: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

test('fechas: suma días y la semana empieza el lunes', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(startOfWeek('2026-11-29'), '2026-11-23');
  assert.equal(describeDays(['THURSDAY', 'MONDAY']), 'Lunes y jueves');
  assert.equal(describeDays([]), 'Todos los días');
});

test('doseState: desde 2 h antes hasta 30 min después; luego no tomada (igual que la web y el backend)', () => {
  const d = dose('2026-11-27', '08:00:00');
  assert.equal(doseState(d, at('2026-11-27', '05:59')), 'upcoming');
  assert.equal(doseState(d, at('2026-11-27', '06:00')), 'due');
  assert.equal(doseState(d, at('2026-11-27', '08:30')), 'due');
  assert.equal(doseState(d, at('2026-11-27', '08:31')), 'missed');
  assert.equal(doseState({ ...d, status: 'LATE' }, at('2026-11-27', '09:00')), 'marked');
  assert.equal(doseState(dose('2026-11-28', '00:30:00'), at('2026-11-27', '23:00')), 'due', 'pasada la medianoche');
  assert.equal(takenStatusFor(d, at('2026-11-27', '08:10')), 'TAKEN');
  assert.equal(takenStatusFor(d, at('2026-11-27', '09:00')), 'LATE', 'desde la notificación, tarde se marca como tarde');
});

test('filtro por persona: Yo primero y luego quienes cuido', () => {
  const doses = [dose('2026-11-27', '08:00:00', { careSubjectId: 3, careSubjectName: 'Pedro' }), dose('2026-11-27', '09:00:00'),
    dose('2026-11-27', '10:00:00', { careSubjectId: 9, careSubjectName: 'Ana', mine: true })];
  assert.deepEqual(peopleIn(doses).map((p) => p.label), ['Yo', 'Pedro', 'Rosa']);
  assert.equal(doses.filter((d) => matchesWho(d, 'me')).length, 1);
  assert.equal(doses.filter((d) => matchesWho(d, 1)).length, 1);
});

test('planDoseReminders: solo tomas sin marcar y futuras dentro de 48 h, en orden', () => {
  const now = at('2026-11-27', '09:00');
  const plan = planDoseReminders(7, [
    dose('2026-11-27', '20:00:00'),
    dose('2026-11-27', '08:00:00'),
    dose('2026-11-27', '13:00:00', { status: 'TAKEN' }),
    dose('2026-11-28', '08:00:00', { mine: true }),
    dose('2026-11-30', '08:00:00'),
  ], now);
  assert.deepEqual(plan.map((p) => p.identifier), ['toma-7-1-2026-11-27-2000', 'toma-7-1-2026-11-28-0800']);
  assert.equal(plan[1].data.mine, true);
  assert.equal(plan[0].fire.getHours(), 20);
  assert.equal(doseReminderId(7, 1, '2026-11-27', '20:00:00'), plan[0].identifier);
});

test('el texto del aviso no dice el medicamento ni la persona', () => {
  const content = doseReminderContent({ mine: false });
  assert.doesNotMatch(`${content.title} ${content.body}`, /Losartán|Rosa/);
  assert.match(doseReminderContent({ mine: true }).body, /tu medicamento/);
});
