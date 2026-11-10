import assert from 'node:assert/strict';
import test from 'node:test';
import { createDelegateStore, delegateSessionKey, LEGACY_DELEGATE_KEY } from '../src/utils/delegateStore.ts';
import type { DelegateSession } from '../src/types/index.ts';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const ANA = 7;
const BRUNO = 8;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => {
      data.set(key, value);
    },
    remove: async (key: string) => {
      data.delete(key);
    },
  };
}

function pass(expiresAt: string, careSubjectName = 'Rosa'): DelegateSession {
  return {
    accessToken: 'jwt',
    expiresAt,
    careSubjectName,
    granteeName: 'Invitada',
    categoryCodes: ['MEDICATION'],
    includeConsultations: false,
    sourceToken: 'codigo',
  } as DelegateSession;
}

const vigente = pass('2026-11-12T04:59:59Z');

test('cada dueño tiene su propia clave', () => {
  assert.equal(delegateSessionKey(null), 'yuyay.delegateSession.guest');
  assert.equal(delegateSessionKey(ANA), 'yuyay.delegateSession.user.7');
  assert.notEqual(delegateSessionKey(ANA), delegateSessionKey(BRUNO));
});

test('Ana recupera su pase al volver a iniciar sesión, mientras no venza', async () => {
  const store = createDelegateStore(memoryStorage(), () => NOW);
  await store.save(ANA, vigente);
  // cerrar sesión no toca el almacenamiento; al volver, Ana lo encuentra
  assert.deepEqual(await store.load(ANA), vigente);
});

test('Bruno, en el mismo teléfono, no ve el pase de Ana ni el del invitado', async () => {
  const store = createDelegateStore(memoryStorage(), () => NOW);
  await store.save(ANA, vigente);
  await store.save(null, pass('2026-11-12T04:59:59Z', 'Jorge'));
  assert.equal(await store.load(BRUNO), null);
});

test('el pase del invitado lo ve quien use la app sin sesión, y no una cuenta', async () => {
  const store = createDelegateStore(memoryStorage(), () => NOW);
  await store.save(null, vigente);
  assert.deepEqual(await store.load(null), vigente);
  assert.equal(await store.load(ANA), null);
});

test('un pase vencido se descarta y se borra', async () => {
  const storage = memoryStorage();
  const store = createDelegateStore(storage, () => NOW);
  await store.save(ANA, pass('2026-11-10T11:59:59Z'));
  assert.equal(await store.load(ANA), null);
  assert.equal(storage.data.has(delegateSessionKey(ANA)), false);
});

test('Salir del acceso borra solo el pase de esa persona', async () => {
  const storage = memoryStorage();
  const store = createDelegateStore(storage, () => NOW);
  await store.save(ANA, vigente);
  await store.save(BRUNO, vigente);
  await store.clear(ANA);
  assert.equal(await store.load(ANA), null);
  assert.deepEqual(await store.load(BRUNO), vigente);
});

test('un pase guardado sin dueño por versiones anteriores se descarta', async () => {
  const storage = memoryStorage();
  storage.data.set(LEGACY_DELEGATE_KEY, JSON.stringify(vigente));
  const store = createDelegateStore(storage, () => NOW);
  assert.equal(await store.load(null), null);
  assert.equal(storage.data.has(LEGACY_DELEGATE_KEY), false);
});

test('un pase dañado se trata como vencido', async () => {
  const storage = memoryStorage();
  storage.data.set(delegateSessionKey(ANA), '{no es json');
  const store = createDelegateStore(storage, () => NOW);
  assert.equal(await store.load(ANA), null);
  assert.equal(storage.data.has(delegateSessionKey(ANA)), false);
});
