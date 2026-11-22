import assert from 'node:assert/strict';
import { randomBytes as nodeRandom } from 'node:crypto';
import test from 'node:test';
import { createVault, seal, unseal, VaultLockedError } from '../src/utils/biometricVault.ts';
import { createSession } from '../src/services/session.ts';

const randomBytes = (count: number) => new Uint8Array(nodeRandom(count));

function fixture() {
  const data = { plain: 'refresh-1' as string | null, sealed: null as string | null, key: null as string | null };
  const control = { cancel: false, keyReads: 0, keyWrites: 0 };
  const store = {
    getPlain: async () => data.plain,
    setPlain: async (token: string) => { data.plain = token; },
    removePlain: async () => { data.plain = null; },
    getSealed: async () => data.sealed,
    setSealed: async (value: string) => { data.sealed = value; },
    removeSealed: async () => { data.sealed = null; },
    readKey: async () => {
      control.keyReads++;
      if (control.cancel) throw new Error('cancelado');
      return data.key;
    },
    writeKey: async (value: string) => {
      control.keyWrites++;
      if (control.cancel) throw new Error('cancelado');
      data.key = value;
    },
    removeKey: async () => { data.key = null; },
  };
  return { data, control, store, vault: createVault(store, randomBytes) };
}

test('seal and unseal round-trip, including non-ASCII text', () => {
  const key = randomBytes(32);
  for (const text of ['abc.def-123_xyz', 'ñandú 🦁']) assert.equal(unseal(key, seal(key, text, randomBytes)), text);
  assert.throws(() => unseal(randomBytes(32), seal(key, 'secreto', randomBytes)));
});

test('enabling encrypts the stored token and removes the plain copy', async () => {
  const f = fixture();
  await f.vault.enable('refresh-1');
  assert.equal(f.data.plain, null);
  assert.ok(f.data.sealed && !f.data.sealed.includes('refresh-1'));
  assert.equal(await f.vault.storage.get(), 'refresh-1');
});

test('a cancelled enable leaves the plain token untouched', async () => {
  const f = fixture();
  f.control.cancel = true;
  await assert.rejects(f.vault.enable('refresh-1'));
  assert.equal(f.data.plain, 'refresh-1');
  assert.equal(f.data.sealed, null);
  assert.equal(await f.vault.isEnabled(), false);
});

test('after a restart the token cannot be read or written until unlocked', async () => {
  const f = fixture();
  await f.vault.enable('refresh-1');
  const restarted = createVault(f.store, randomBytes);
  assert.equal(await restarted.isEnabled(), true);
  assert.equal(await restarted.storage.get(), null);
  await assert.rejects(restarted.storage.set('refresh-2'), VaultLockedError);
  f.control.cancel = true;
  await assert.rejects(restarted.unlock());
  assert.equal(await restarted.storage.get(), null);
  f.control.cancel = false;
  assert.equal(await restarted.unlock(), 'unlocked');
  assert.equal(await restarted.storage.get(), 'refresh-1');
});

test('rotation re-encrypts with the key in memory without asking for biometrics again', async () => {
  const f = fixture();
  await f.vault.enable('refresh-1');
  const reads = f.control.keyReads;
  await f.vault.storage.set('refresh-2');
  await f.vault.storage.set('refresh-3');
  assert.equal(f.control.keyReads, reads);
  assert.equal(f.control.keyWrites, 1);
  assert.equal(await f.vault.storage.get(), 'refresh-3');
});

test('a missing key (biometrics changed) wipes the saved session', async () => {
  const f = fixture();
  await f.vault.enable('refresh-1');
  f.data.key = null;
  const restarted = createVault(f.store, randomBytes);
  assert.equal(await restarted.unlock(), 'invalidated');
  assert.equal(f.data.sealed, null);
  assert.equal(await restarted.isEnabled(), false);
  assert.equal(await restarted.storage.get(), null);
});

test('disabling restores the plain token and removing the session disables biometrics', async () => {
  const f = fixture();
  await f.vault.enable('refresh-1');
  await f.vault.disable('refresh-1');
  assert.deepEqual(f.data, { plain: 'refresh-1', sealed: null, key: null });
  await f.vault.enable('refresh-1');
  await f.vault.storage.remove();
  assert.deepEqual(f.data, { plain: null, sealed: null, key: null });
  assert.equal(await f.vault.isEnabled(), false);
});

test('enabling during a refresh keeps the rotated token sealed', async () => {
  const f = fixture();
  const session = createSession({
    storage: f.vault.storage,
    renew: async () => ({ accessToken: 'a', refreshToken: 'refresh-2' }),
    revoke: async () => {},
    isRejected: () => false,
    onExpired: () => {},
  });
  const refreshing = session.refresh();
  const enabling = session.withToken((token) => f.vault.enable(token!));
  await Promise.all([refreshing, enabling]);
  assert.equal(f.data.plain, null);
  assert.equal(await f.vault.storage.get(), 'refresh-2');
});
