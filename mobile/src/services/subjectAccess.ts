import { ApiError, isAccessLost } from './client.ts';

type Access = { revision: number; denied: boolean };
export type SubjectAccessSnapshot = { generation: number; subjects: ReadonlyMap<number, Access> };
type RequestKind = 'identity' | 'read' | 'restricted';

const initialAccess: Access = { revision: 0, denied: false };
const deniedError = () => new ApiError(403, 'Ya no tienes acceso a esta persona.');

export function accessFor(snapshot: SubjectAccessSnapshot, id: number) {
  return snapshot.subjects.get(id) ?? initialAccess;
}

/** Solo puede mostrar datos de la misma sesión y revisión del permiso. */
export function subjectDataIsCurrent(current: SubjectAccessSnapshot, loaded: SubjectAccessSnapshot, id: number) {
  return current.generation === loaded.generation && !accessFor(current, id).denied &&
    accessFor(current, id) === accessFor(loaded, id);
}

export function createSubjectAccess(generation: () => number) {
  let snapshot: SubjectAccessSnapshot = { generation: generation(), subjects: new Map() };
  const listeners = new Set<() => void>();
  const lastRead = new Map<number, number>();
  let sequence = 0;
  let lastList: { request: number; ids: Set<number> } | undefined;

  function getSnapshot() {
    const current = generation();
    if (current !== snapshot.generation) {
      snapshot = { generation: current, subjects: new Map() };
      lastRead.clear();
      lastList = undefined;
      sequence = 0;
    }
    return snapshot;
  }

  function change(id: number, denied: boolean) {
    const current = getSnapshot();
    const previous = accessFor(current, id);
    if (previous.denied === denied) return;
    const subjects = new Map(current.subjects);
    subjects.set(id, { revision: previous.revision + 1, denied });
    snapshot = { ...current, subjects };
    listeners.forEach((listener) => listener());
  }

  async function request<T>(
    id: number,
    kind: RequestKind,
    load: () => Promise<T>,
    verify?: () => Promise<unknown>,
  ): Promise<{ data: T; access: SubjectAccessSnapshot }> {
    const started = getSnapshot();
    const access = accessFor(started, id);
    if (access.denied && kind !== 'identity') throw deniedError();
    const order = ++sequence;

    function assertCurrent() {
      const current = getSnapshot();
      if (started.generation !== current.generation) throw new ApiError(401, 'La sesión cambió.');
      if (access !== accessFor(current, id)) throw deniedError();
    }

    let value: T;
    try {
      value = await load();
    } catch (error) {
      assertCurrent();
      const forbidden = error instanceof ApiError && error.status === 403;
      if ((kind === 'identity' && isAccessLost(error)) || (kind === 'read' && forbidden)) {
        change(id, true);
      } else if (kind === 'restricted' && forbidden && verify) {
        // Un rol insuficiente para esta acción puede devolver 403 aunque la lectura siga permitida.
        await verify().catch(() => {});
        assertCurrent();
      }
      throw error;
    }
    assertCurrent();
    // Una respuesta anterior a una lista completa no puede volver a mostrar una persona ausente.
    if (lastList && lastList.request > order && !lastList.ids.has(id)) throw deniedError();
    lastRead.set(id, Math.max(lastRead.get(id) ?? 0, order));
    if (kind === 'identity' && access.denied) change(id, false);
    return { data: value, access: getSnapshot() };
  }

  /** La lista completa confirma las relaciones activas y detecta las que desaparecieron. */
  async function people<T extends { id: number }>(load: () => Promise<T[]>) {
    const started = getSnapshot();
    const order = ++sequence;
    const rows = await load();
    const current = getSnapshot();
    if (started.generation !== current.generation) throw new ApiError(401, 'La sesión cambió.');
    const unchanged = (id: number) => accessFor(started, id) === accessFor(current, id);
    if (lastList && lastList.request > order) {
      const { request, ids } = lastList;
      const data = rows.filter(({ id }) => subjectDataIsCurrent(current, started, id) &&
        (ids.has(id) || (lastRead.get(id) ?? 0) > request));
      return { data, access: current };
    }

    const ids = new Set(rows.map(({ id }) => id));
    lastList = { request: order, ids };
    for (const [id, readOrder] of lastRead) {
      if (readOrder <= order && !ids.has(id) && unchanged(id)) change(id, true);
    }
    const data = rows.filter(({ id }) => unchanged(id));
    for (const { id } of data) {
      lastRead.set(id, Math.max(lastRead.get(id) ?? 0, order));
      change(id, false);
    }
    return { data, access: getSnapshot() };
  }

  return {
    identity: <T>(id: number, load: () => Promise<T>) => request(id, 'identity', load),
    request: <T>(id: number, kind: Exclude<RequestKind, 'identity'>, load: () => Promise<T>, verify?: () => Promise<unknown>) =>
      request(id, kind, load, verify).then(({ data }) => data),
    people,
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
