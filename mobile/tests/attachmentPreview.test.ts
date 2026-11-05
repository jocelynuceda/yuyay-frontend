import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttachmentPreview, type AttachmentPreview } from '../src/services/attachmentPreview.ts';
import type { Attachment, AttachmentAccess } from '../src/types';

const document = { id: 7, careSubjectId: 3, contentType: 'image/png' } as Attachment;
const access = (version = 1): AttachmentAccess => ({
  url: `https://files.example.test/image-${version}.png`, expiresAt: new Date(Date.now() + 300000).toISOString(),
});

function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(getAccess: () => Promise<AttachmentAccess>) {
  let active = true;
  let generation = 1;
  let state: AttachmentPreview | null = null;
  const changes: (AttachmentPreview | null)[] = [];
  const errors: unknown[] = [];
  const controller = createAttachmentPreview({
    getAccess,
    isActive: () => active,
    sessionGeneration: () => generation,
    onChange: (next) => { state = next; changes.push(next); },
    onError: (error) => errors.push(error),
  });
  return {
    controller, changes, errors,
    state: () => state,
    setActive: (value: boolean) => { active = value; controller.setActive(value); },
    logout: () => { generation++; },
  };
}

test('image loading renews once even for an identical signed URL, then ends with manual recovery', async () => {
  let calls = 0;
  const h = setup(async () => { calls++; return access(); });
  await h.controller.open(document);
  const original = h.state()!;
  await h.controller.imageFailed(original.requestId);
  const renewed = h.state()!;
  assert.equal(calls, 2);
  assert.notEqual(original.requestId, renewed.requestId);
  assert.equal(renewed.url, original.url);
  await h.controller.imageFailed(original.requestId); // Evento tardío de la imagen anterior.
  assert.equal(h.state(), renewed);
  await h.controller.imageFailed(renewed.requestId);
  assert.equal(h.state(), null);
  assert.equal(calls, 2);
  assert.equal(h.errors.length, 1);
  await h.controller.imageFailed(renewed.requestId);
  assert.equal(calls, 2);
  await h.controller.open(document); // Otra acción explícita del usuario permite un nuevo intento.
  await h.controller.imageFailed(h.state()!.requestId);
  assert.equal(calls, 4);
});

test('duplicate image errors share the single renewal and discard the old URL while loading', async () => {
  const renewal = deferred<AttachmentAccess>();
  let calls = 0;
  const h = setup(async () => ++calls === 1 ? access() : renewal.promise);
  await h.controller.open(document);
  const id = h.state()!.requestId;
  const pending = h.controller.imageFailed(id);
  assert.equal(h.state()!.renewing, true);
  assert.equal(h.state()!.url, '');
  await h.controller.imageFailed(id);
  await h.controller.imageFailed(h.state()!.requestId);
  assert.equal(calls, 2);
  renewal.resolve(access(2));
  await pending;
  assert.equal(h.state()!.renewing, false);
  assert.equal(h.errors.length, 0);
});

for (const phase of ['open', 'renewal'] as const) {
  for (const reason of ['close', 'blur', 'background', 'logout'] as const) {
    test(`${reason} invalidates an in-flight ${phase}, even if the screen becomes active again`, async () => {
      const pending = deferred<AttachmentAccess>();
      let calls = 0;
      const h = setup(async () => ++calls === 1 && phase === 'renewal' ? access() : pending.promise);
      let operation = h.controller.open(document);
      if (phase === 'renewal') {
        await operation;
        operation = h.controller.imageFailed(h.state()!.requestId);
      }
      if (reason === 'logout') h.logout();
      else if (reason === 'close') h.controller.close();
      else {
        h.setActive(false);
        h.setActive(true);
      }
      const count = h.changes.length;
      pending.resolve(access(2));
      await operation;
      assert.equal(h.changes.length, count);
      assert.equal(h.errors.length, 0);
      if (reason !== 'logout') assert.equal(h.state(), null);
      else if (h.state()) assert.equal(h.controller.isCurrent(h.state()!.requestId), false);
    });
  }
}

test('a rejected renewal closes the view once and cannot restart a fetch loop', async () => {
  let calls = 0;
  const problem = new Error('Storage unavailable');
  const h = setup(async () => {
    if (++calls === 1) return access();
    throw problem;
  });
  await h.controller.open(document);
  await h.controller.imageFailed(h.state()!.requestId);
  assert.equal(calls, 2);
  assert.equal(h.state(), null);
  assert.deepEqual(h.errors, [problem]);
});

test('a late failure cannot close a newer preview or show an error after backgrounding', async () => {
  const stale = deferred<AttachmentAccess>();
  let calls = 0;
  const h = setup(async () => ++calls === 1 ? stale.promise : access(2));
  const old = h.controller.open(document);
  h.controller.close();
  await h.controller.open(document);
  const current = h.state();
  stale.reject(new Error('Old request failed'));
  await old;
  assert.equal(h.state(), current);
  assert.equal(h.errors.length, 0);
  h.setActive(false);
  await h.controller.imageFailed(current!.requestId);
  assert.equal(calls, 2);
});

test('expired or non-HTTPS access never opens a preview and does not trigger an automatic retry', async () => {
  for (const invalid of [
    { ...access(), url: 'http://files.example.test/image.png' },
    { ...access(), url: 'javascript:alert(1)' },
    { ...access(), expiresAt: new Date(Date.now() - 1000).toISOString() },
    { ...access(), expiresAt: 'invalid' },
  ]) {
    let calls = 0;
    const h = setup(async () => { calls++; return invalid; });
    await h.controller.open(document);
    assert.equal(h.state(), null);
    assert.equal(calls, 1);
    assert.equal(h.errors.length, 1);
  }
});
