import assert from 'node:assert/strict';
import test from 'node:test';
import { createHandoffAccessCode, type HandoffAccessCodeResponse } from '../src/services/security/handoffAccessCode.ts';

const response = (patch: Partial<HandoffAccessCodeResponse> = {}): HandoffAccessCodeResponse => ({
  code: '001234', consumed: false, serverTime: '2035-01-01T00:00:00Z', expiresAt: '2035-01-01T00:00:30Z', periodSeconds: 30, ...patch,
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function clock() {
  let value = 500;
  const tasks = new Set<{ at: number; run: () => void }>();
  return {
    now: () => value,
    schedule: (run: () => void, delay: number) => {
      const task = { at: value + delay, run }; tasks.add(task); return () => { tasks.delete(task); };
    },
    advance: (ms: number) => {
      value += ms;
      for (const task of [...tasks]) if (task.at <= value) { tasks.delete(task); task.run(); }
    },
    timers: () => tasks.size,
  };
}

test('conserva los seis dígitos y usa tiempo del servidor aunque el calendario del dispositivo difiera', async () => {
  const time = clock();
  const model = createHandoffAccessCode(async () => response(), time.now, time.schedule);
  model.setActive(true); await flush();
  assert.equal(model.getSnapshot().code, '001234');
  assert.equal(model.getSnapshot().secondsRemaining, 30);
  time.advance(10_250); model.tick();
  assert.equal(model.getSnapshot().secondsRemaining, 20);
  assert.ok(model.getSnapshot().progress < 0.67);
  model.dispose();
  assert.equal(time.timers(), 0);
});

test('al vencer borra el código antes de esperar la renovación y no depende del intervalo visual', async () => {
  const time = clock();
  let calls = 0;
  let resolveNext!: (value: HandoffAccessCodeResponse) => void;
  const model = createHandoffAccessCode(() => ++calls === 1 ? Promise.resolve(response()) : new Promise((resolve) => { resolveNext = resolve; }), time.now, time.schedule);
  model.setActive(true); await flush();
  time.advance(30_000);
  assert.equal(model.getSnapshot().phase, 'loading');
  assert.equal(model.getSnapshot().code, null);
  resolveNext(response({ code: '009876' })); await flush();
  assert.equal(model.getSnapshot().code, '009876');
  model.dispose();
});

test('background borra y cancela; una respuesta obsoleta no reaparece y foreground pide un código nuevo', async () => {
  const time = clock();
  const requests: { signal: AbortSignal; resolve: (value: HandoffAccessCodeResponse) => void }[] = [];
  const model = createHandoffAccessCode((signal) => new Promise((resolve) => requests.push({ signal, resolve })), time.now, time.schedule);
  model.setActive(true);
  model.setActive(false);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(model.getSnapshot().code, null);
  model.setActive(true);
  requests[1].resolve(response({ code: '222222' })); await flush();
  requests[0].resolve(response({ code: '111111' })); await flush();
  assert.equal(model.getSnapshot().code, '222222');
  model.setActive(false);
  assert.equal(model.getSnapshot().code, null);
  assert.equal(time.timers(), 0);
});

test('código utilizado conserva el contador sin mostrar dígitos y se renueva al siguiente paso', async () => {
  const time = clock();
  let reads = 0;
  const model = createHandoffAccessCode(async () => ++reads === 1 ? response({ code: null, consumed: true }) : response({ code: '012345' }), time.now, time.schedule);
  model.setActive(true); await flush();
  assert.equal(model.getSnapshot().consumed, true);
  assert.equal(model.getSnapshot().code, null);
  assert.equal(model.getSnapshot().secondsRemaining, 30);
  time.advance(30_000); await flush();
  assert.equal(model.getSnapshot().code, '012345');
  assert.equal(model.getSnapshot().consumed, false);
  model.dispose();
});

test('revocación o error ocultan inmediatamente el código anterior', async () => {
  const time = clock();
  let reads = 0;
  const model = createHandoffAccessCode(async () => { if (++reads > 1) throw { status: 410 }; return response(); }, time.now, time.schedule);
  model.setActive(true); await flush();
  const request = model.reload();
  assert.equal(model.getSnapshot().code, null);
  await request;
  assert.equal(model.getSnapshot().phase, 'error');
  assert.equal(model.getSnapshot().code, null);
  assert.equal(time.timers(), 0);
  model.dispose();
});

test('rechaza respuestas inválidas y nunca inventa o completa códigos', async () => {
  for (const patch of [
    { code: '1234' }, { code: 'abcdef' }, { code: null }, { code: '123456', consumed: true },
    { periodSeconds: 60 }, { expiresAt: 'invalid' }, { expiresAt: '2035-01-01T00:00:00Z' },
    { expiresAt: '2035-01-01T00:01:00Z' },
  ]) {
    const time = clock();
    const model = createHandoffAccessCode(async () => response(patch), time.now, time.schedule);
    model.setActive(true); await flush();
    assert.equal(model.getSnapshot().phase, 'error');
    assert.equal(model.getSnapshot().code, null);
    model.dispose();
  }
});

test('la latencia de red se resta y una respuesta ya vencida espera otro código sin mostrarla', async () => {
  const time = clock();
  let resolveRequest!: (value: HandoffAccessCodeResponse) => void;
  const model = createHandoffAccessCode(() => new Promise((resolve) => { resolveRequest = resolve; }), time.now, time.schedule);
  model.setActive(true);
  time.advance(2_000);
  resolveRequest(response({ expiresAt: '2035-01-01T00:00:01Z' })); await flush();
  assert.equal(model.getSnapshot().phase, 'waiting');
  assert.equal(model.getSnapshot().code, null);
  time.advance(250);
  resolveRequest(response()); await flush();
  assert.equal(model.getSnapshot().code, '001234');
  model.dispose();
});

test('limita a dos reintentos automáticos las respuestas que ya llegan vencidas', async () => {
  const time = clock();
  let reads = 0;
  let stale = true;
  const model = createHandoffAccessCode(async () => {
    reads++;
    if (stale) time.advance(2_000);
    return response({ expiresAt: stale ? '2035-01-01T00:00:01Z' : '2035-01-01T00:00:30Z' });
  }, time.now, time.schedule);
  model.setActive(true); await flush();
  time.advance(250); await flush();
  time.advance(250); await flush();
  assert.equal(reads, 3);
  assert.equal(model.getSnapshot().phase, 'error');
  assert.equal(model.getSnapshot().code, null);
  assert.equal(time.timers(), 0);
  time.advance(60_000); model.tick(); await flush();
  assert.equal(reads, 3);
  await model.reload();
  assert.equal(model.getSnapshot().phase, 'waiting');
  stale = false;
  await model.reload();
  assert.equal(model.getSnapshot().phase, 'ready');
  model.dispose();
});
