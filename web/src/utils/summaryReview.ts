import type { ConsultationPreparation, ConfirmPreparation } from '../types/consultationPreparation'
import type { HandoffDetail } from '../types'
import { isAccessLost } from './accessStatus'

export interface SummaryReviewState {
  phase: 'loading' | 'editing' | 'review' | 'saving' | 'uncertain' | 'error' | 'saved'
  preparation: ConsultationPreparation | null
  selected: number[]
  reason: string
  questions: string
  message: string | null
  saved: HandoffDetail | null
}

interface Dependencies {
  prepare: () => Promise<ConsultationPreparation>
  confirm: (body: ConfirmPreparation) => Promise<HandoffDetail>
  newId: () => string
  status: (error: unknown) => number | undefined
  errorMessage: (error: unknown) => string
}

/** Conserva el cuerpo de una escritura incierta. Sólo una revisión nueva crea otra clave. */
export function createSummaryReview(deps: Dependencies) {
  const initialState: SummaryReviewState = {
    phase: 'loading', preparation: null, selected: [], reason: '', questions: '', message: null, saved: null,
  }
  let state = initialState
  let pending: ConfirmPreparation | null = null
  let generation = 0
  let preserveDraft = false
  const listeners = new Set<() => void>()
  const update = (patch: Partial<SummaryReviewState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  async function load(conflict = preserveDraft) {
    if (pending || state.phase === 'saved') return
    const current = ++generation
    update({ phase: 'loading' })
    try {
      const preparation = await deps.prepare()
      if (current !== generation) return
      const ids = preparation.categories.flatMap((group) => group.entries.map((entry) => entry.entryId))
      update({
        phase: 'editing', preparation,
        selected: conflict ? state.selected.filter((id) => ids.includes(id)) : ids,
        reason: conflict ? state.reason : preparation.reason,
        message: conflict ? 'La información cambió. Revisa los registros actualizados antes de validar y guardar.' : null,
      })
    } catch (error) {
      if (current !== generation) return
      const status = deps.status(error)
      const denied = status === 401 || isAccessLost(status)
      update({
        phase: 'error', preparation: null,
        ...(denied ? { reason: '', questions: '', selected: [] } : {}),
        message: deps.errorMessage(error),
      })
    }
  }

  function edit(patch: Partial<Pick<SummaryReviewState, 'reason' | 'questions' | 'selected'>>) {
    if (state.phase !== 'editing') return
    update({ ...patch, message: null })
  }

  function review() {
    if (state.phase !== 'editing' || !state.preparation) return
    if (!state.reason.trim() || state.reason.length > 10000 || state.questions.length > 10000) {
      update({ message: 'Escribe el motivo y usa como máximo 10000 caracteres en cada campo.' })
      return
    }
    if (state.selected.length > 500) {
      update({ message: 'Selecciona como máximo 500 registros.' })
      return
    }
    update({ phase: 'review', message: null })
  }

  async function save() {
    if ((state.phase !== 'review' && state.phase !== 'uncertain') || !state.preparation) return
    if (!pending) {
      pending = {
        requestId: deps.newId(), preparationToken: state.preparation.preparationToken,
        reason: state.reason, questions: state.questions || null,
        entries: state.preparation.categories.flatMap((group) => group.entries)
          .filter((entry) => state.selected.includes(entry.entryId))
          .map(({ entryId, versionId }) => ({ entryId, versionId })),
      }
    }
    const current = generation
    update({ phase: 'saving', message: null })
    try {
      const saved = await deps.confirm(pending)
      if (current !== generation) return
      pending = null
      update({ phase: 'saved', saved })
    } catch (error) {
      if (current !== generation) return
      const status = deps.status(error)
      if (status === 409) {
        pending = null
        preserveDraft = true
        await load(true)
      } else if (status === 401 || isAccessLost(status)) {
        pending = null
        update({ phase: 'error', preparation: null, selected: [], reason: '', questions: '', message: deps.errorMessage(error) })
      } else if (status === 400) {
        pending = null
        update({ phase: 'editing', message: deps.errorMessage(error) })
      } else {
        update({ phase: 'uncertain', message: 'No sabemos si se guardó. Reintenta para recuperar el mismo resumen. ' + deps.errorMessage(error) })
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    load, edit, review, save,
    back: () => { if (state.phase === 'review') update({ phase: 'editing' }) },
    cancel: () => {
      if (state.phase === 'saving' || state.phase === 'uncertain') return false
      generation++
      pending = null
      update({ preparation: null, selected: [], reason: '', questions: '', phase: 'error' })
      return true
    },
    dispose: () => {
      generation++
      pending = null
      preserveDraft = false
      state = initialState
    },
  }
}
