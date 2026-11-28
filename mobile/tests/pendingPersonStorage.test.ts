import assert from 'node:assert/strict';
import test from 'node:test';
import { createPendingPersonStorage, pendingPersonKey } from '../src/services/pendingPersonStorage.ts';

const first = pendingPersonKey('https://example.test', 1);
const second = pendingPersonKey('https://example.test', 2);

function fixture() {
  const values = new Map<string, string>([['appearance', 'dark']]);
  const storage = {
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: string) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
  };
  return { values, storage };
}

test('descartar elimina la clave y salir borra los borradores incluso tras reiniciar la app', async () => {
  const { values, storage } = fixture();
  const drafts = createPendingPersonStorage(storage);
  drafts.write(first, 'nombre y notas');
  await drafts.remove(first);
  assert.equal(values.has(first), false);
  drafts.write(first, 'otro borrador');
  values.set(second, 'anterior al índice');
  assert.equal(drafts.read(second), 'anterior al índice');
  await createPendingPersonStorage(storage).clear();
  assert.deepEqual([...values], [['appearance', 'dark']]);
});

test('salir elimina también la clave antigua de la cuenta aunque no se abra el formulario', async () => {
  const { values, storage } = fixture();
  values.set(first, 'borrador antiguo');
  await createPendingPersonStorage(storage).clear(first);
  assert.deepEqual([...values], [['appearance', 'dark']]);
});

test('si falla el borrado nativo, el índice permite reintentarlo', async () => {
  const { values, storage } = fixture();
  const drafts = createPendingPersonStorage(storage);
  drafts.write(first, 'pendiente');
  const faulty = createPendingPersonStorage({ ...storage, remove: async () => { throw Error('ocupado'); } });
  await assert.rejects(faulty.clear(), /ocupado/);
  await createPendingPersonStorage(storage).clear();
  assert.deepEqual([...values], [['appearance', 'dark']]);
});

test('Expo web elimina todas las claves de borrador sin tocar las preferencias', async () => {
  const { values, storage } = fixture();
  values.set(first, 'borrador anterior');
  values.set(second, 'otro borrador');
  await createPendingPersonStorage(storage, () => [...values.keys()]).clear();
  assert.deepEqual([...values], [['appearance', 'dark']]);
});
