import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planReconcile,
  reminderDataOf,
  reminderFireDate,
  reminderId,
  type ReminderCitation,
  type ScheduledReminder,
} from '../src/utils/reminders.ts';

const now = new Date(2026, 10, 20, 10, 0);
const cita = (over: Partial<ReminderCitation> = {}): ReminderCitation => ({
  id: 7,
  careSubjectId: 3,
  date: '2026-11-21',
  time: '15:30:00',
  ...over,
});
const scheduled = (c: ReminderCitation, userId = 1): ScheduledReminder => ({
  identifier: reminderId(userId, c.id),
  data: reminderDataOf(userId, c),
});

test('el aviso suena una hora antes, en la hora local del teléfono', () => {
  assert.deepEqual(reminderFireDate(cita(), now), new Date(2026, 10, 21, 14, 30));
});

test('una cita a medianoche avisa la noche anterior', () => {
  assert.deepEqual(reminderFireDate(cita({ time: '00:15:00' }), now), new Date(2026, 10, 20, 23, 15));
});

test('sin hora, ya pasada o a menos de una hora no hay aviso', () => {
  assert.equal(reminderFireDate(cita({ time: null }), now), null);
  assert.equal(reminderFireDate(cita({ date: '2026-11-19' }), now), null);
  assert.equal(reminderFireDate(cita({ date: '2026-11-20', time: '10:45' }), now), null);
});

test('el identificador es fijo por cuenta y cita, para no duplicar', () => {
  assert.equal(reminderId(1, 7), reminderId(1, 7));
  assert.notEqual(reminderId(1, 7), reminderId(2, 7));
});

test('una cita sin cambios no se toca', () => {
  const c = cita();
  const plan = planReconcile([scheduled(c)], new Map([[3, [{ ...c, time: '15:30' }]]]), 1, { now });
  assert.deepEqual(plan, { cancel: [], reschedule: [] });
});

test('una cita reprogramada en otro cliente se vuelve a programar', () => {
  const moved = cita({ date: '2026-11-25', time: '09:00:00' });
  const plan = planReconcile([scheduled(cita())], new Map([[3, [moved]]]), 1, { now });
  assert.deepEqual(plan, { cancel: [], reschedule: [moved] });
});

test('se cancela si la borraron, le quitaron la hora o ya pasó', () => {
  const s = scheduled(cita());
  assert.deepEqual(planReconcile([s], new Map([[3, []]]), 1, { now }).cancel, [s.identifier]);
  assert.deepEqual(planReconcile([s], new Map([[3, [cita({ time: null })]]]), 1, { now }).cancel, [s.identifier]);
  assert.deepEqual(planReconcile([s], new Map([[3, [cita({ date: '2026-11-01' })]]]), 1, { now }).cancel, [
    s.identifier,
  ]);
});

test('los avisos de otra cuenta se cancelan', () => {
  const s = scheduled(cita(), 2);
  assert.deepEqual(planReconcile([s], new Map(), 1, { now }).cancel, [s.identifier]);
});

test('una lista que no se pudo leer no cancela sus avisos', () => {
  const s = scheduled(cita());
  assert.deepEqual(planReconcile([s], new Map([[9, []]]), 1, { now }), { cancel: [], reschedule: [] });
});

test('si la persona ya no está en la lista completa, su aviso se cancela', () => {
  const s = scheduled(cita());
  const plan = planReconcile([s], new Map(), 1, { now, knownSubjects: new Set([9]) });
  assert.deepEqual(plan.cancel, [s.identifier]);
});
