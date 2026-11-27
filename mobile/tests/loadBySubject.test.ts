import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBySubject } from '../src/utils/loadBySubject.ts';
import { upcomingAgendaState } from '../src/utils/upcomingAgendaState.ts';

test('keeps the lists that loaded and counts the ones that failed', async () => {
  const { loaded, failed } = await loadBySubject([1, 2], async (id) => {
    if (id === 2) throw new Error('offline');
    return ['a'];
  });
  assert.deepEqual([...loaded], [[1, ['a']]]);
  assert.equal(failed, 1);
  assert.deepEqual(upcomingAgendaState({ data: { failed }, loading: false, error: null }, 1),
    { warning: 'No pudimos cargar todas las citas.', showEmpty: false });
});

test('reports every failure so an empty result is not taken as no data', async () => {
  const { loaded, failed } = await loadBySubject([1, 2], async () => { throw new Error('offline'); });
  assert.equal(loaded.size, 0);
  assert.equal(failed, 2);
  assert.deepEqual(upcomingAgendaState({ data: { failed }, loading: false, error: null }, 0),
    { warning: 'No pudimos cargar todas las citas.', showEmpty: false });
});

test('el reintento oculta el vacío anterior hasta completar todas las lecturas', async () => {
  const data = await loadBySubject([1, 2], async () => []);
  assert.deepEqual(upcomingAgendaState({ data, loading: true, error: null }, 0), { warning: null, showEmpty: false });
  assert.deepEqual(upcomingAgendaState({ data, loading: false, error: 'Sin conexión' }, 0),
    { warning: 'Sin conexión', showEmpty: false });
  assert.deepEqual(upcomingAgendaState({ data, loading: false, error: null }, 0), { warning: null, showEmpty: true });
});
