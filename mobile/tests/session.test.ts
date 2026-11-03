import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, NoSessionError } from '../src/services/session.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const state = { token: 'refresh-old' as string | null, expired: 0, recoveries: 0, calls: 0, revoked: [] as string[] };
  const tokens = { accessToken: 'access-new', refreshToken: 'refresh-new' };
  let renew = async (_token: string) => tokens;
  const options = {
    storage: {
      get: async () => state.token,
      set: async (token: string) => { state.token = token; },
      remove: async () => { state.token = null; },
    },
    renew: async (token: string) => { state.calls++; return renew(token); },
    revoke: async (token: string) => { state.revoked.push(token); },
    isRejected: (error: unknown) => (error as { status?: number }).status === 401,
    onExpired: () => { state.expired++; },
    onRecovery: () => { state.recoveries++; },
  };
  return { state, tokens, options, session: createSession(options), setRenew: (next: typeof renew) => { renew = next; } };
}

for (const status of [0, 500, 502]) {
  test(`refresh failure ${status} preserves stored credentials and can retry`, async () => {
    const f = fixture();
    f.setRenew(async () => { throw { status }; });
    await assert.rejects(f.session.refresh());
    assert.equal(f.state.token, 'refresh-old');
    assert.equal(f.state.expired, 0);
    assert.equal(f.state.recoveries, 1);
    f.setRenew(async () => f.tokens);
    await f.session.refresh();
    assert.equal(f.state.token, 'refresh-new');
    assert.equal(f.session.accessToken, 'access-new');
  });
}

test('expired or revoked refresh is deleted once and becomes anonymous', async () => {
  const f = fixture();
  f.setRenew(async () => { throw { status: 401 }; });
  await assert.rejects(f.session.refresh());
  assert.equal(f.state.token, null);
  assert.equal(f.state.expired, 1);
  await assert.rejects(f.session.refresh(), NoSessionError);
  assert.equal(f.state.calls, 1);
});

test('concurrent refresh calls share one request and rotated credentials survive relaunch', async () => {
  const f = fixture();
  const pending = deferred<typeof f.tokens>();
  f.setRenew(() => pending.promise);
  const results = [f.session.refresh(), f.session.refresh(), f.session.refresh()];
  pending.resolve(f.tokens);
  await Promise.all(results);
  assert.equal(f.state.calls, 1);
  const relaunched = createSession(f.options);
  await relaunched.refresh();
  assert.equal(relaunched.accessToken, 'access-new');
  assert.equal(f.state.calls, 2);
});

test('logout during refresh cannot restore credentials and revokes the late replacement', async () => {
  const f = fixture();
  const pending = deferred<typeof f.tokens>();
  const started = deferred<void>();
  f.setRenew(() => { started.resolve(); return pending.promise; });
  const result = f.session.refresh();
  await started.promise;
  await f.session.logout();
  pending.resolve(f.tokens);
  await assert.rejects(result, NoSessionError);
  assert.equal(f.session.accessToken, null);
  assert.equal(f.state.token, null);
  assert.deepEqual(f.state.revoked, ['refresh-old', 'refresh-new']);
});

test('late refresh failure after logout cannot show a recovery prompt', async () => {
  const f = fixture();
  const pending = deferred<typeof f.tokens>();
  const started = deferred<void>();
  f.setRenew(() => { started.resolve(); return pending.promise; });
  const result = f.session.refresh();
  await started.promise;
  await f.session.logout();
  pending.reject({ status: 500 });
  await assert.rejects(result);
  assert.equal(f.state.recoveries, 0);
  assert.equal(f.state.expired, 0);
});

test('a failed storage write retains the rotated token for a safe retry', async () => {
  const f = fixture();
  let writeFails = true;
  const originalSet = f.options.storage.set;
  f.options.storage.set = async (token) => {
    if (writeFails) throw new Error('Storage temporarily unavailable');
    await originalSet(token);
  };
  const session = createSession(f.options);
  await assert.rejects(session.refresh());
  writeFails = false;
  let usedToken = '';
  f.setRenew(async (token) => { usedToken = token; return f.tokens; });
  await session.refresh();
  assert.equal(usedToken, 'refresh-new');
  assert.equal(f.state.token, 'refresh-new');
});

test('logout while replacement storage is pending cannot resurrect that session', async () => {
  const f = fixture();
  const pending = deferred<void>();
  const started = deferred<void>();
  f.options.storage.set = async (token) => {
    started.resolve();
    await pending.promise;
    f.state.token = token;
  };
  const session = createSession(f.options);
  const saving = session.replace(f.tokens);
  await started.promise;
  const logout = session.logout();
  pending.resolve();
  await assert.rejects(saving, NoSessionError);
  await logout;
  assert.equal(f.state.token, null);
  assert.equal(session.accessToken, null);
});
