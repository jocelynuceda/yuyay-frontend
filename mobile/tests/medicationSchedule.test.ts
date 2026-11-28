import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDays,
  createSyncGuard,
  describeDays,
  doseReminderContent,
  doseReminderId,
  doseState,
  peopleIn,
  matchesWho,
  limaInstant,
  planDoseReminders,
  remindersUntil,
  staleSnoozed,
  startOfWeek,
  takenStatusFor,
  todayInLima,
  type DoseReminderData,
} from '../src/utils/medicationSchedule.ts';
import type { AgendaDose } from '../src/types/index.ts';

const dose = (date: string, time: string, extra: Partial<AgendaDose> = {}): AgendaDose => ({
  scheduleId: 1, healthEntryId: 1, careSubjectId: 1, careSubjectName: 'Rosa', mine: false, medication: 'Losartán',
  dose: '50 mg', date, time, status: null, markedByName: null, markedAt: null, ...extra,
});
/** Un instante en hora de Lima ('HH:mm' o 'HH:mm:ss'), sin depender de la zona de quien corre la prueba. */
const at = (date: string, time: string) => new Date(limaInstant(date, time.slice(0, 5)) + Number(time.slice(6, 8) || 0) * 1000);

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
  assert.equal(doseState(d, at('2026-11-27', '08:30:00')), 'due');
  assert.equal(doseState(d, at('2026-11-27', '08:30:01')), 'missed', 'un segundo después ya es tarde, como en el servidor');
  assert.equal(takenStatusFor(d, at('2026-11-27', '08:30:01')), 'LATE');
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

test('en hora de Lima aunque el teléfono esté en otra zona', () => {
  assert.equal(todayInLima(new Date('2026-11-28T03:00:00Z')), '2026-11-27', '22:00 del 27 en Lima');
  // La toma de las 8:00 de Lima suena a las 13:00 UTC en cualquier teléfono
  const plan = planDoseReminders(7, [dose('2026-11-27', '08:00:00')], new Date('2026-11-27T10:00:00Z'));
  assert.equal(plan[0].fire.toISOString(), '2026-11-27T13:00:00.000Z');
});

test('planDoseReminders: solo tomas sin marcar y futuras, en orden', () => {
  const now = at('2026-11-27', '09:00');
  const plan = planDoseReminders(7, [
    dose('2026-11-27', '20:00:00'),
    dose('2026-11-27', '08:00:00'),
    dose('2026-11-27', '13:00:00', { status: 'TAKEN' }),
    dose('2026-11-28', '08:00:00', { mine: true }),
  ], now);
  assert.deepEqual(plan.map((p) => p.identifier), ['toma-7-1-2026-11-27-2000', 'toma-7-1-2026-11-28-0800']);
  assert.equal(plan[1].data.mine, true);
  assert.equal(doseReminderId(7, 1, '2026-11-27', '20:00:00'), plan[0].identifier);
});

test('planDoseReminders: un tratamiento de varios días sigue avisando más allá de 48 h', () => {
  const now = at('2026-11-27', '00:00');
  // Cinco tomas diarias durante 14 días: 70 tomas, el límite es 40 avisos (iOS admite 64 por app)
  const doses = Array.from({ length: 14 }, (_, day) => addDays('2026-11-27', day)).flatMap((date) =>
    ['06:00:00', '10:00:00', '14:00:00', '18:00:00', '22:00:00'].map((time) => dose(date, time)));
  const plan = planDoseReminders(7, doses, now);
  assert.equal(plan.length, 40);
  assert.equal(plan[39].data.date, '2026-12-04', 'ocho días de avisos, no solo dos');
  assert.equal(remindersUntil(plan)?.toISOString(), at('2026-12-04', '22:00').toISOString());
  // Dos tomas diarias: alcanzan los 14 días completos, y nada más allá
  const twice = Array.from({ length: 20 }, (_, day) => addDays('2026-11-27', day)).flatMap((date) =>
    ['08:00:00', '20:00:00'].map((time) => dose(date, time)));
  const plan2 = planDoseReminders(7, twice, now);
  assert.equal(plan2.length, 28);
  assert.equal(plan2[27].data.date, '2026-12-10');
  assert.equal(remindersUntil([]), null);
});

test('staleSnoozed: un aviso pospuesto se va si otro cuidador ya marcó la toma o ya no está en la agenda', () => {
  const data = (time: string): DoseReminderData => ({ kind: 'dose-reminder', userId: 7, scheduleId: 1, date: '2026-11-27', time, mine: false });
  const snoozed = [
    { identifier: 'pospuesto-0800', data: data('08:00') },
    { identifier: 'pospuesto-1300', data: data('13:00') },
    { identifier: 'pospuesto-2000', data: data('20:00') },
  ];
  const agenda = [
    dose('2026-11-27', '08:00:00', { status: 'TAKEN', markedByName: 'Bruno Torres' }),
    dose('2026-11-27', '13:00:00'),
    // La de las 20:00 ya no está: se quitó el horario o el acceso a la persona
  ];
  assert.deepEqual(staleSnoozed(snoozed, agenda).map((n) => n.identifier), ['pospuesto-0800', 'pospuesto-2000']);
});

test('createSyncGuard: una sincronización que empezó antes de cerrar sesión ya no programa avisos', () => {
  const guard = createSyncGuard();
  const started = guard.start();
  // Mientras se espera la agenda, la persona cierra sesión
  guard.invalidate();
  assert.equal(guard.isCurrent(started), false, 'la respuesta lenta se descarta');
  const next = guard.start();
  assert.equal(guard.isCurrent(next), true, 'la siguiente sesión sincroniza normalmente');
});

test('el texto del aviso no dice el medicamento ni la persona', () => {
  const content = doseReminderContent({ mine: false });
  assert.doesNotMatch(`${content.title} ${content.body}`, /Losartán|Rosa/);
  assert.match(doseReminderContent({ mine: true }).body, /tu medicamento/);
});
