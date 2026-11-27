import { subjectDataIsCurrent, type SubjectAccessSnapshot } from '../services/subjectAccess.ts';

type AccessSource = {
  getSnapshot: () => SubjectAccessSnapshot;
  subscribe: (listener: () => void) => () => void;
};

/** Pasa un borrador editable entre pantallas mediante un identificador de un solo uso. */
export function createSubjectDrafts<T>(access: AccessSource) {
  let next = 0;
  let draft: { key: number; subjectId: number; access: SubjectAccessSnapshot; value: T } | undefined;
  access.subscribe(() => {
    if (draft && !subjectDataIsCurrent(access.getSnapshot(), draft.access, draft.subjectId)) draft = undefined;
  });
  return {
    save(subjectId: number, value: T) {
      draft = { key: ++next, subjectId, access: access.getSnapshot(), value };
      return draft.key;
    },
    read(subjectId: number, key: number) {
      if (draft?.key !== key || draft.subjectId !== subjectId) return;
      if (!subjectDataIsCurrent(access.getSnapshot(), draft.access, subjectId)) return;
      return draft.value;
    },
    discard(key: number) {
      if (draft?.key === key) draft = undefined;
    },
  };
}
