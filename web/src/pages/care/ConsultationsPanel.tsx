import { useState } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { useFetch } from '../../hooks/useFetch'
import { deleteConsultation, listChangesSinceConsultation, listConsultations } from '../../services/api/consultations'
import type { Consultation, HealthEntryVersion } from '../../types'
import { consultationOrder, formatDate, formatDateTime, formatTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { changeTypeLabels } from '../../utils/versions'
import { todayIso } from '../../schemas/common'
import { ConsultationForm } from '../forms/ConsultationForm'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { AddToCalendar } from './AddToCalendar'
import { useSuccessNotice } from '../../hooks/useSuccessNotice'

interface ConsultationsData {
  upcoming: Consultation[]
  past: Consultation[]
  lastPast: Consultation | null
  changes: HealthEntryVersion[]
}

/** Las de hoy cuentan como próximas. Los cambios se miden desde la consulta pasada más reciente. */
async function loadConsultations(subjectId: number, signal: AbortSignal): Promise<ConsultationsData> {
  const all = await listConsultations(subjectId, signal)
  const today = todayIso()
  const upcoming = all.filter((c) => c.date >= today).sort((a, b) => consultationOrder(a).localeCompare(consultationOrder(b)))
  const past = all.filter((c) => c.date < today).sort((a, b) => consultationOrder(b).localeCompare(consultationOrder(a)))
  const lastPast = past[0] ?? null
  // Sin consultas pasadas no hay desde dónde comparar (el backend respondería 404)
  const changes = lastPast ? await listChangesSinceConsultation(subjectId, lastPast.id, signal) : []
  return { upcoming, past, lastPast, changes }
}

/**
 * Pestaña "Consultas" del detalle de persona: próximas y pasadas, y lo que cambió desde la última.
 * Solo el principal puede registrar, editar y borrar consultas.
 */
export function ConsultationsPanel({ subjectId, subjectName, isPrincipal }: { subjectId: number; subjectName: string; isPrincipal: boolean }) {
  const { data, error, errorStatus, reload } = useFetch((signal) => loadConsultations(subjectId, signal), [subjectId])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Consultation | null>(null)
  const [removing, setRemoving] = useState<Consultation | null>(null)
  const { notify, anchorProps } = useSuccessNotice()

  if (!data) {
    return error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : <p className="p-6 text-muted">Cargando consultas…</p>
  }

  const { upcoming, past, lastPast, changes } = data
  const item = (c: Consultation, isUpcoming: boolean) => editing?.id === c.id ? (
    <li key={c.id}>
      <ConsultationForm
        subjectId={subjectId}
        consultation={c}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          notify('Consulta actualizada.')
          reload()
        }}
      />
    </li>
  ) : (
    <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-card p-4">
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${isUpcoming ? 'text-primary' : 'text-muted'}`}>
          <time dateTime={c.date}>{formatDate(c.date)}</time>
          {c.time ? ` · ${formatTime(c.time)}` : ''}
          {c.date === todayIso() ? ' · Hoy' : ''}
        </p>
        <p className="font-semibold">{c.reason}</p>
        {c.notes ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{c.notes}</p> : null}
        {isUpcoming ? (
          <div className="mt-3">
            <AddToCalendar consultation={c} subjectName={subjectName} />
          </div>
        ) : null}
      </div>
      {isPrincipal ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setEditing(c)
            }}
            aria-label={`Editar la consulta "${c.reason}" del ${formatDate(c.date)}`}
            className={`rounded-xl border border-line px-3 py-1.5 text-sm font-semibold ${focusRing}`}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setRemoving(c)}
            aria-label={`Borrar la consulta "${c.reason}" del ${formatDate(c.date)}`}
            className={`rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
          >
            Borrar
          </button>
        </div>
      ) : null}
    </li>
  )

  return (
    <section aria-labelledby="consultations-title" className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="consultations-title" className="text-2xl font-semibold">
          Consultas
        </h2>
        {isPrincipal && !adding ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setAdding(true)
            }}
            className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
          >
            Nueva consulta
          </button>
        ) : null}
      </div>
      {!isPrincipal ? <p className="-mt-3 text-sm text-muted">Solo el cuidador principal puede registrar consultas.</p> : null}

      <span {...anchorProps} />

      {adding ? (
        <ConsultationForm
          subjectId={subjectId}
          onCancel={() => setAdding(false)}
          onSaved={(c) => {
            setAdding(false)
            notify(`Consulta del ${formatDate(c.date)} guardada.`)
            reload()
          }}
        />
      ) : null}

      <ChangesSinceLast lastPast={lastPast} changes={changes} />

      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">Próximas</h3>
        {upcoming.length === 0 ? (
          <p className="text-muted">No hay consultas programadas.</p>
        ) : (
          <ul className="grid gap-3">{upcoming.map((c) => item(c, true))}</ul>
        )}
      </div>

      <div className="grid gap-3">
        <h3 className="text-lg font-semibold">Pasadas</h3>
        {past.length === 0 ? (
          <p className="text-muted">Aún no hay consultas pasadas.</p>
        ) : (
          <ul className="grid gap-3">{past.map((c) => item(c, false))}</ul>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        title="¿Borrar esta consulta?"
        message={removing ? `"${removing.reason}" del ${formatDate(removing.date)}.` : ''}
        confirmLabel="Borrar consulta"
        cancelLabel="Volver"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await deleteConsultation(removing.id)
          notify('Consulta borrada.')
          setRemoving(null)
          reload()
        }}
      />
    </section>
  )
}

/** Lo que conviene contarle al médico: registros creados, editados o borrados desde la última consulta. */
function ChangesSinceLast({ lastPast, changes }: { lastPast: Consultation | null; changes: HealthEntryVersion[] }) {
  return (
    <section aria-labelledby="changes-title" className="rounded-3xl border-2 border-accent bg-card p-5">
      <h3 id="changes-title" className="text-lg font-semibold">
        Cambios desde la última consulta
      </h3>
      {lastPast ? (
        <>
          <p className="text-sm text-muted">
            Desde el {formatDate(lastPast.date)} · {lastPast.reason}
          </p>
          {changes.length === 0 ? (
            <p className="mt-3 text-muted">Sin registros nuevos ni editados.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {changes.map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.changeType === 'DELETED' ? 'bg-danger-bg text-danger' : 'bg-accent-tint text-accent-text'
                    }`}
                  >
                    {changeTypeLabels[v.changeType]}
                  </span>
                  <span className="font-semibold">{v.title}</span>
                  <span className="text-sm text-muted">
                    {v.declaredBy.name}, {formatDateTime(v.declaredAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-1 text-muted">Cuando haya una consulta pasada, aquí verás lo que cambió desde entonces.</p>
      )}
    </section>
  )
}
