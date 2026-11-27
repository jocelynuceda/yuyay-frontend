import axios from 'axios'
import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../../contexts/auth-context'
import { acquireSummaryAttempt, releaseSummaryAttempt, summarySession, requiresSummaryHistoryCheck, acknowledgeSummaryHistory } from '../../utils/summaryAttempts'
import { Button } from '../../components/ui/Button'
import { prepareConsultation, confirmConsultation } from '../../services/api/consultations'
import { getErrorMessage } from '../../utils/apiErrors'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { createSummaryReview } from '../../utils/summaryReview'
import { parseRouteId } from '../../utils/urlParams'
import { inputClass } from '../forms/fieldProps'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { linkButtonClass, linkSecondaryClass } from '../../utils/styles'

export default function ConsultationSummaryRoute() {
  const { id, consultationId: param } = useParams()
  const subjectId = parseRouteId(id)
  const consultationId = parseRouteId(param)
  if (subjectId === null || consultationId === null) return <NotFoundPage />
  return (
    <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Preparar resumen">
      {() => <ConsultationSummaryPage key={consultationId} subjectId={subjectId} consultationId={consultationId} />}
    </PersonRouteFrame>
  )
}

export function ConsultationSummaryPage({ subjectId, consultationId }: { subjectId: number; consultationId: number }) {
  const navigate = useNavigate()
  const user = useContext(AuthContext)?.user
  const [standaloneSession] = useState(() => ({}))
  const session = user ? summarySession(user.id) : standaloneSession
  const key = `${subjectId}/${consultationId}`
  const [historyRequired, setHistoryRequired] = useState(requiresSummaryHistoryCheck)
  const model = useMemo(() => acquireSummaryAttempt(session, key, () => createSummaryReview({
    prepare: async () => {
      const data = await prepareConsultation(consultationId)
      if (data.careSubjectId !== subjectId) throw new Error('La cita no pertenece a esta persona.')
      return data
    },
    confirm: (body) => confirmConsultation(consultationId, body),
    newId: () => crypto.randomUUID(),
    status: (error) => axios.isAxiosError(error) ? error.response?.status : undefined,
    errorMessage: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 403) return 'No tienes autorización para esta cita.'
      if (axios.isAxiosError(error) && error.response?.status === 404) return 'La cita ya no existe.'
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const fields = error.response.data?.fieldErrors as { message: string }[] | undefined
        if (fields?.length) return fields.map((field) => field.message).join(' ')
      }
      return getErrorMessage(error)
    },
  })), [session, key, subjectId, consultationId])
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot)
  useEffect(() => {
    acquireSummaryAttempt(session, key, () => model)
    if (!historyRequired && model.getSnapshot().phase === 'loading') void model.load()
    const warnOnClose = (event: BeforeUnloadEvent) => {
      const phase = model.getSnapshot().phase
      if (phase === 'saving' || phase === 'uncertain') {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnOnClose)
    return () => {
      window.removeEventListener('beforeunload', warnOnClose)
      releaseSummaryAttempt(session, key, model)
    }
  }, [model, session, key, historyRequired])

  const returnTo = `/people/${subjectId}?tab=appointments`
  if (historyRequired) {
    return (
      <section className="grid gap-4 rounded-3xl bg-card p-6">
        <h1 className="text-2xl font-semibold">Comprueba los resúmenes guardados</h1>
        <p role="alert">Una confirmación anterior puede haberse guardado. Tras recargar o cerrar la página no podemos recuperar su solicitud con seguridad. Comprueba el historial antes de iniciar otro resumen.</p>
        <Link to={`/people/${subjectId}?tab=handoffs`} className="text-primary-fg underline">Consultar el historial</Link>
        <Button onClick={() => { acknowledgeSummaryHistory(); setHistoryRequired(false) }}>Ya comprobé el historial; iniciar una revisión nueva</Button>
      </section>
    )
  }
  if (state.phase === 'saved' && state.saved) {
    return (
      <section className="grid gap-5">
        <h1 className="text-2xl font-semibold">Resumen guardado</h1>
        <p className="whitespace-pre-wrap">{state.saved.reason}</p>
        <p className="whitespace-pre-wrap">{state.saved.questions || 'Sin preguntas.'}</p>
        {state.saved.items.map((item) => <VersionContent key={item.healthEntryVersionId} version={item} />)}
        <div className="flex flex-wrap gap-3">
          <Link to={`/people/${subjectId}/handoffs/${state.saved.id}`} className={linkSecondaryClass}>Ver resumen</Link>
          <Link to={`/people/${subjectId}/handoffs/${state.saved.id}/share`} className={linkButtonClass}>Generar enlace y código</Link>
          <Link to={`/people/${subjectId}?tab=handoffs`} className={linkSecondaryClass}>Regresar</Link>
        </div>
      </section>
    )
  }
  const editing = state.phase === 'editing'
  const busy = state.phase === 'saving' || state.phase === 'loading'
  const uncertain = state.phase === 'uncertain'
  return (
    <section className="grid gap-5 rounded-3xl bg-card p-5 sm:p-8">
      <h1 className="text-2xl font-semibold">Preparar resumen de la cita</h1>
      {(state.phase === 'saving' || uncertain) && <p role="status">El guardado puede haberse realizado. Si sales con Atrás o un enlace, al volver recuperarás este mismo intento. Evita recargar o cerrar la página y usa el reintento para comprobar el resultado.</p>}
      {state.message && <p role="alert" className="rounded-xl bg-danger-bg p-4 text-danger">{state.message}</p>}
      {state.phase === 'loading' && <p role="status">Cargando propuesta…</p>}
      {state.preparation && (
        <>
          {editing ? (
            <>
              <label className="grid gap-2">Motivo
                <textarea aria-label="Motivo" className={inputClass(false)} maxLength={10000} value={state.reason} onChange={(event) => model.edit({ reason: event.target.value })} />
              </label>
              <label className="grid gap-2">Preguntas para el médico
                <textarea aria-label="Preguntas para el médico" className={inputClass(false)} maxLength={10000} value={state.questions} onChange={(event) => model.edit({ questions: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">Revisión final</h2>
              <p className="whitespace-pre-wrap">{state.reason}</p>
              <p className="whitespace-pre-wrap">{state.questions || 'Sin preguntas.'}</p>
            </>
          )}
          {state.preparation.categories.length === 0 && <p>No hay registros vigentes. Puedes guardar el motivo y las preguntas.</p>}
          {state.preparation.categories.map((group) => (
            <fieldset key={group.categoryCode} className="grid gap-3 rounded-xl border border-line p-4">
              <legend className="font-semibold">{categoryLabels[group.categoryCode]?.plural ?? group.categoryCode}</legend>
              {group.entries.filter((entry) => editing || state.selected.includes(entry.entryId)).map((entry) => (
                <div key={entry.entryId} className="grid gap-2">
                  {editing && (
                    <label className="flex gap-3">
                      <input type="checkbox" checked={state.selected.includes(entry.entryId)}
                        onChange={(event) => model.edit({ selected: event.target.checked
                          ? [...state.selected, entry.entryId] : state.selected.filter((id) => id !== entry.entryId) })} />
                      Incluir {entry.version.title}
                    </label>
                  )}
                  <VersionContent version={entry.version} />
                </div>
              ))}
            </fieldset>
          ))}
          <p>{state.selected.length} registros seleccionados.</p>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        {editing && <Button onClick={model.review}>Revisar resumen</Button>}
        {state.phase === 'review' && <Button variant="secondary" onClick={model.back}>Modificar</Button>}
        {(state.phase === 'review' || uncertain || state.phase === 'saving') && (
          <Button loading={state.phase === 'saving'} onClick={() => void model.save()}>
            {uncertain ? 'Reintentar el mismo guardado' : 'Validar y guardar'}
          </Button>
        )}
        {state.phase === 'error' && <Button onClick={() => void model.load()}>Reintentar preparación</Button>}
        <Button variant="ghost" disabled={busy || uncertain} onClick={() => {
          if (model.cancel()) void navigate(returnTo)
        }}>Cancelar</Button>
      </div>
    </section>
  )
}

function VersionContent({ version }: { version: {
  title: string; details: string | null; dose: string | null; frequency: string | null
  occurredOn: string | null; confidenceLevel: 'CONFIRMED' | 'UNCERTAIN'; notes: string | null
} }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <h3 className="font-semibold">{version.title}</h3>
      <p className="text-sm text-muted">{confidenceLabels[version.confidenceLevel]}</p>
      {version.occurredOn && <p>{formatDate(version.occurredOn)}</p>}
      {[version.details, version.dose, version.frequency, version.notes].filter(Boolean).map((text, index) => (
        <p key={index} className="whitespace-pre-wrap">{text}</p>
      ))}
    </div>
  )
}
