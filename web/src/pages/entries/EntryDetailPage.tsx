import { useEffect, useState } from 'react'
import { deleteHealthEntry, getHealthEntry, listHealthEntryVersions } from '../../services/api/healthEntries'
import type { HealthEntry, HealthEntryVersion } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { confidenceLabels, formatDate, formatDateTime } from '../../utils/format'
import { changedFields, changeTypeLabels, displayField, versionFieldLabels } from '../../utils/versions'
import { focusRing } from '../../utils/styles'
import { ConfirmDialog } from './ConfirmDialog'
import { HealthEntryForm } from '../forms/HealthEntryForm'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entry: HealthEntry; versions: HealthEntryVersion[] }

/**
 * Detalle de registro (/personas/:id/registros/:entryId): versión actual, historial
 * con quién y cuándo, edición y borrado con confirmación.
 */
export function EntryDetailPage({
  subjectId,
  entryId,
  onDeleted,
}: {
  subjectId: number
  entryId: number
  /** Al borrar: normalmente volver a la lista de registros de la persona. */
  onDeleted?: () => void
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getHealthEntry(subjectId, entryId), listHealthEntryVersions(subjectId, entryId)])
      .then(([entry, versions]) => active && setState({ status: 'ready', entry, versions }))
      .catch((error) => active && setState({ status: 'error', message: getErrorMessage(error) }))
    return () => {
      active = false
    }
  }, [subjectId, entryId, version])

  if (state.status === 'loading') return <p className="p-6 text-muted">Cargando registro…</p>
  if (state.status === 'error') {
    return (
      <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">
        {state.message}
      </p>
    )
  }

  const { entry, versions } = state
  const current = entry.latestVersion
  const deleted = !!entry.deletedAt
  const facts = [current.dose, current.frequency].filter(Boolean).join(' · ')

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{entry.categoryName}</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{current.title}</h1>
          <p className="mt-2 text-muted">
            Registrado por {entry.createdBy.name} el {formatDate(entry.createdAt)}
          </p>
        </div>
        {!deleted && !editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setNotice(null)
                setEditing(true)
              }}
              className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className={`rounded-xl border border-danger px-5 py-2.5 font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
            >
              Borrar
            </button>
          </div>
        ) : null}
      </header>

      {notice ? (
        <p role="status" className="rounded-xl bg-accent-tint p-4 font-semibold text-accent-text">
          {notice}
        </p>
      ) : null}
      {deleted ? (
        <p role="status" className="rounded-xl bg-danger-bg p-4 text-danger">
          Este registro fue eliminado el {formatDate(entry.deletedAt)}. Se conserva su historial.
        </p>
      ) : null}

      {editing ? (
        <HealthEntryForm
          subjectId={subjectId}
          entry={entry}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false)
            setNotice(saved ? 'Cambios guardados. Se creó una versión nueva.' : 'No había cambios que guardar.')
            if (saved) setVersion((v) => v + 1)
          }}
        />
      ) : (
        <section aria-labelledby="current-version" className="rounded-3xl bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="current-version" className="text-xl font-semibold">
              Versión actual · v{current.versionNumber}
            </h2>
            <ConfidenceBadge version={current} />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {facts ? <Detail label="Dosis y frecuencia" value={facts} /> : null}
            <Detail label="Fecha" value={formatDate(current.occurredOn)} />
            <Detail label="Detalles" value={current.details ?? '—'} wide />
            <Detail label="Notas" value={current.notes ?? '—'} wide />
          </dl>
          <p className="mt-4 text-sm text-muted">
            Última actualización: {current.declaredBy.name}, {formatDateTime(current.declaredAt)}
          </p>
        </section>
      )}

      <section aria-labelledby="history">
        <h2 id="history" className="text-2xl font-semibold">
          Historial
        </h2>
        <ol className="mt-4 grid gap-3">
          {versions.map((v, index) => (
            <VersionItem key={v.id} version={v} previous={versions[index + 1]} isCurrent={index === 0} />
          ))}
        </ol>
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        title="¿Borrar este registro?"
        message={`"${current.title}" dejará de aparecer en el perfil. El historial se conserva y queda registrado quién lo borró.`}
        confirmLabel="Borrar registro"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          await deleteHealthEntry(subjectId, entryId)
          setConfirmingDelete(false)
          setNotice(null)
          if (onDeleted) onDeleted()
          else setVersion((v) => v + 1)
        }}
      />
    </div>
  )
}

function VersionItem({
  version,
  previous,
  isCurrent,
}: {
  version: HealthEntryVersion
  previous?: HealthEntryVersion
  isCurrent: boolean
}) {
  const fields = previous && version.changeType === 'UPDATED' ? changedFields(version, previous) : []
  return (
    <li className="rounded-2xl bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          Versión {version.versionNumber} · {changeTypeLabels[version.changeType]}
        </p>
        {isCurrent ? <span className="text-sm font-semibold text-primary">Actual</span> : null}
      </div>
      <p className="text-sm text-muted">
        {version.declaredBy.name} · <time dateTime={version.declaredAt}>{formatDateTime(version.declaredAt)}</time>
      </p>
      {version.changeType === 'CREATED' ? <p className="mt-2">{version.title}</p> : null}
      {fields.length > 0 && previous ? (
        <ul className="mt-2 grid gap-1">
          {fields.map((field) => (
            <li key={field}>
              <span className="font-semibold">{versionFieldLabels[field]}: </span>
              <del className="text-muted">{displayField(field, previous)}</del>
              <span aria-hidden> → </span>
              <ins className="no-underline">{displayField(field, version)}</ins>
            </li>
          ))}
        </ul>
      ) : null}
      {version.changeType === 'UPDATED' && previous && fields.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Se guardó sin cambios en los campos.</p>
      ) : null}
    </li>
  )
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line">{value}</dd>
    </div>
  )
}

function ConfidenceBadge({ version }: { version: HealthEntryVersion }) {
  const confirmed = version.confidenceLevel === 'CONFIRMED'
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${
        confirmed ? 'bg-accent-tint text-accent-text' : 'bg-soft text-soft-text'
      }`}
    >
      {confidenceLabels[version.confidenceLevel]}
    </span>
  )
}
