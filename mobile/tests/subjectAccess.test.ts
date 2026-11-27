import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/services/client.ts';
import { accessFor, createSubjectAccess, subjectDataIsCurrent } from '../src/services/subjectAccess.ts';
import { createSubjectDrafts } from '../src/utils/subjectDrafts.ts';

const forbidden = new ApiError(403, 'Sin permiso');
const offline = new ApiError(0, 'Sin conexión');
const fail = (error: ApiError) => () => Promise.reject(error);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const result = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, result };
}

test('a read denial hides previously loaded data across routes and discards a late success', async () => {
  const access = createSubjectAccess(() => 0);
  const dashboard = await access.people(async () => [{ id: 1, name: 'Rosa' }, { id: 2, name: 'Pedro' }]);
  const profile = await access.identity(1, async () => ({ name: 'Rosa' }));
  const drafts = createSubjectDrafts<string>(access);
  const routeParams = { subjectId: 1, ocrDraftId: drafts.save(1, 'Texto clínico') };
  const late = deferred<string[]>();
  const reading = access.request(1, 'read', () => late.result);
  const lateAssertion = assert.rejects(reading, { status: 403 });
  const lateDenial = deferred<string[]>();
  const denial = access.request(1, 'read', () => lateDenial.result);
  const lateDenialAssertion = assert.rejects(denial, { status: 403 });

  const render = () => {
    const current = access.getSnapshot();
    return {
      people: dashboard.data.filter(({ id }) => subjectDataIsCurrent(current, dashboard.access, id)).map(({ name }) => name),
      profile: subjectDataIsCurrent(current, profile.access, 1) ? profile.data.name : undefined,
      form: drafts.read(routeParams.subjectId, routeParams.ocrDraftId),
    };
  };
  const renders = [render()];
  const unsubscribe = access.subscribe(() => renders.push(render()));
  assert.deepEqual(renders[0], { people: ['Rosa', 'Pedro'], profile: 'Rosa', form: 'Texto clínico' });

  await assert.rejects(access.request(1, 'read', fail(forbidden)), { status: 403 });
  const revoked = { people: ['Pedro'], profile: undefined, form: undefined };
  assert.deepEqual(renders[1], revoked);
  let reissued = false;
  await assert.rejects(access.request(1, 'read', async () => { reissued = true; }), { status: 403 });
  assert.equal(reissued, false);
  await assert.rejects(access.identity(1, fail(offline)), { status: 0 });
  assert.deepEqual(render(), revoked);

  const restored = await access.identity(1, async () => ({ name: 'Rosa actualizada' }));
  assert.equal(subjectDataIsCurrent(access.getSnapshot(), restored.access, 1), true);
  late.resolve(['Resultado anterior']);
  lateDenial.reject(forbidden);
  await Promise.all([lateAssertion, lateDenialAssertion]);
  assert.equal(subjectDataIsCurrent(access.getSnapshot(), restored.access, 1), true);
  assert.deepEqual(render(), revoked);
  unsubscribe();
});

test('a 403 for a restricted action checks read permission before hiding other screens', async () => {
  const access = createSubjectAccess(() => 0);
  const clinical = await access.identity(3, async () => ({ notes: 'Información cargada' }));
  const visible = () => subjectDataIsCurrent(access.getSnapshot(), clinical.access, 3);
  const identity = (error: ApiError) => () => access.identity(3, fail(error));

  await assert.rejects(access.request(3, 'restricted', fail(forbidden), async () => access.identity(3, async () => ({}))), {
    message: 'Sin permiso', status: 403,
  });
  assert.equal(visible(), true);
  await assert.rejects(access.request(3, 'restricted', fail(forbidden), identity(offline)), { status: 403 });
  await assert.rejects(access.request(3, 'read', fail(offline)), { status: 0 });
  await assert.rejects(access.request(3, 'read', fail(new ApiError(404, 'Documento inexistente'))), { status: 404 });
  assert.equal(visible(), true);
  await assert.rejects(access.request(3, 'restricted', fail(forbidden), identity(forbidden)), { status: 403 });
  assert.equal(visible(), false);
});

test('a stale people list cannot restore access and a fresh active relationship can', async () => {
  const access = createSubjectAccess(() => 0);
  const late = deferred<{ id: number }[]>();
  const oldList = access.people(() => late.result);
  await assert.rejects(access.identity(8, fail(forbidden)), { status: 403 });
  late.resolve([{ id: 8 }, { id: 9 }]);
  assert.deepEqual((await oldList).data, [{ id: 9 }]);
  assert.equal(accessFor(access.getSnapshot(), 8).denied, true);

  const freshList = await access.people(async () => [{ id: 8 }, { id: 9 }]);
  assert.deepEqual(freshList.data, [{ id: 8 }, { id: 9 }]);
  assert.equal(subjectDataIsCurrent(access.getSnapshot(), freshList.access, 8), true);
});

test('a fresh people list removes omitted subjects without a 403 and rejects older responses', async () => {
  const access = createSubjectAccess(() => 0);
  const saved = await access.people(async () => [{ id: 10 }, { id: 11 }]);
  const lateList = deferred<{ id: number }[]>();
  const older = access.people(() => lateList.result);
  const lateAppointment = deferred<string>();
  const appointment = access.request(10, 'read', () => lateAppointment.result);
  const lateAssertion = assert.rejects(appointment, { status: 403 });

  const refreshed = await access.people(async () => [{ id: 11 }]);
  assert.deepEqual(refreshed.data, [{ id: 11 }]);
  const visible = () => saved.data.filter(({ id }) => subjectDataIsCurrent(access.getSnapshot(), saved.access, id));
  assert.deepEqual(visible(), [{ id: 11 }]);
  assert.equal(accessFor(access.getSnapshot(), 10).denied, true);

  lateAppointment.resolve('Cita que ya no se puede ver');
  lateList.resolve([{ id: 10 }, { id: 11 }]);
  await lateAssertion;
  assert.deepEqual((await older).data, [{ id: 11 }]);

  const oldOmission = deferred<{ id: number }[]>();
  const pendingOmission = access.people(() => oldOmission.result);
  const restored = await access.people(async () => [{ id: 10 }, { id: 11 }]);
  oldOmission.resolve([{ id: 11 }]);
  await pendingOmission;
  assert.equal(subjectDataIsCurrent(access.getSnapshot(), restored.access, 10), true);
  assert.deepEqual(visible(), [{ id: 11 }]);
});

test('responding from an old login cannot affect the same person in a new session', async () => {
  let generation = 0;
  const access = createSubjectAccess(() => generation);
  const drafts = createSubjectDrafts<string>(access);
  const draftId = drafts.save(1, 'Información privada de la primera sesión');
  const pending = deferred<number>();
  const oldRequest = access.request(1, 'read', () => pending.result);
  const assertion = assert.rejects(oldRequest, { status: 401 });

  generation++;
  const current = await access.identity(1, async () => ({ name: 'Persona actual' }));
  pending.reject(forbidden);
  await assertion;
  assert.equal(subjectDataIsCurrent(access.getSnapshot(), current.access, 1), true);
  assert.equal(drafts.read(1, draftId), undefined);
});
