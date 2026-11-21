import assert from 'node:assert/strict';
import test from 'node:test';
import type { Consultation } from '../src/types/index.ts';
import {
  LOCAL_REMINDER_BODY,
  reconcileSubject,
  reminderTriggerDate,
  remindersWithoutAccess,
  type StoredReminder,
} from '../src/utils/localReminders.ts';

const now = new Date(2031, 2, 14, 9, 0); // 14 mar 2031, 09:00 hora local del celular
const cita = (id: number, date: string, time: string | null, careSubjectId = 4): Consultation => ({
  id, careSubjectId, createdByUserId: 1, date, time, reason: 'Control', notes: null, createdAt: '2031-03-01T00:00:00Z',
});
const stored = (consultationId: number, triggerAt: Date, subjectId = 4): StoredReminder => ({
  consultationId, subjectId, notificationId: `n-${consultationId}`, triggerAt: triggerAt.toISOString(),
});

test('El aviso suena 1 hora antes, en hora local, solo para citas futuras con hora', () => {
  assert.deepEqual(reminderTriggerDate(cita(1, '2031-03-14', '15:30:00'), now), new Date(2031, 2, 14, 14, 30));
  // Cita a las 00:30: el aviso es el día anterior a las 23:30
  assert.deepEqual(reminderTriggerDate(cita(1, '2031-03-15', '00:30:00'), now), new Date(2031, 2, 14, 23, 30));
  assert.equal(reminderTriggerDate(cita(1, '2031-03-14', null), now), null, 'sin hora no hay aviso');
  assert.equal(reminderTriggerDate(cita(1, '2031-03-14', '09:45:00'), now), null, 'faltan menos de 60 min');
  assert.equal(reminderTriggerDate(cita(1, '2031-03-13', '18:00:00'), now), null, 'ya pasó');
  // El texto de la pantalla bloqueada no lleva nombre ni motivo
  assert.doesNotMatch(LOCAL_REMINDER_BODY, /Control/);
});

test('Sincronizar cancela citas borradas o pasadas y reprograma las que cambiaron, sin duplicar', () => {
  const sameTime = cita(1, '2031-03-20', '10:00:00');
  const moved = cita(2, '2031-03-21', '11:00:00');
  const noLongerTimed = cita(3, '2031-03-22', null);
  const list = [
    stored(1, new Date(2031, 2, 20, 9, 0)),
    stored(2, new Date(2031, 2, 21, 9, 0)), // antes era a las 10:00
    stored(3, new Date(2031, 2, 22, 9, 0)),
    stored(4, new Date(2031, 2, 23, 9, 0)), // la cita se borró
    stored(9, new Date(2031, 2, 24, 9, 0), 7), // otra persona: no se toca aquí
  ];
  const actions = reconcileSubject(list, 4, [sameTime, moved, noLongerTimed], now);
  assert.deepEqual(actions.map((a) => [a.kind, a.reminder.consultationId]), [
    ['reschedule', 2],
    ['cancel', 3],
    ['cancel', 4],
  ]);
  const reschedule = actions[0];
  assert.ok(reschedule.kind === 'reschedule');
  assert.deepEqual(reschedule.trigger, new Date(2031, 2, 21, 10, 0));
});

test('Los avisos de personas sin acceso se identifican para cancelarlos', () => {
  const list = [stored(1, now, 4), stored(2, now, 5), stored(3, now, 6)];
  assert.deepEqual(remindersWithoutAccess(list, [4, 6]).map((r) => r.consultationId), [2]);
  assert.deepEqual(remindersWithoutAccess(list, []).map((r) => r.consultationId), [1, 2, 3]);
});
