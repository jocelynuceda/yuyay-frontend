import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Pagination } from '../../components/ui/Pagination'
import { useFetch } from '../../hooks/useFetch'
import { useSuccessNotice } from '../../hooks/useSuccessNotice'
import { deleteHandoff, getHandoff, listHandoffSessions, listHandoffs, revokeHandoffSession } from '../../services/api/handoffs'
import type { HandoffSession } from '../../types'
import { categoryLabels, confidenceLabels, formatDate, formatDateTime } from '../../utils/format'
import { canManageHandoffLinks, handoffLinkState } from '../../utils/handoffLinks'
import { CreateHandoffLink } from '../handoff/HandoffLinkStep'
import { linkButtonClass } from '../../utils/styles'

const PAGE_SIZE = 10

export function HandoffsPanel({
  subjectId,
  isPrincipal,
  userId,
}: {
  subjectId: number
  isPrincipal: boolean
  /** Usuario con sesión: puede manejar los enlaces de los resúmenes que creó. */
  userId: number | undefined
}) {
  return (
    <section aria-labelledby="handoffs-title" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="handoffs-title" className="text-2xl font-semibold">Resúmenes para el médico</h2>
          <p className="text-sm text-muted">Revisa los resúmenes preparados para una consulta o urgencia.</p>
        </div>
        <Link to={`/people/${subjectId}/handoff/new`} className={linkButtonClass}>Nuevo resumen</Link>
      </div>
      <HandoffHistory key={subjectId} subjectId={subjectId} isPrincipal={isPrincipal} userId={userId} />
    </section>
  )
}

function HandoffHistory({ subjectId, isPrincipal, userId }: { subjectId: number; isPrincipal: boolean; userId: number | undefined }) {
  const [page, setPage] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { data, error, loading, reload } = useFetch(async (signal) => {
    const result = await listHandoffs(subjectId, { page, size: PAGE_SIZE }, signal)
    if (Array.isArray(result)) {
      const items = [...result].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
      return { page, items, pagination: null }
    }
    const { content: items, ...pagination } = result
    return { page, items, pagination }
  }, [subjectId, page])
  const pending = loading || (!error && data?.page !== page)
  const items = pending || error ? null : data?.items
  const pagination = data?.pagination

  return (
    <>
      {pending ? <p role="status" className="text-muted">Cargando resúmenes…</p> : null}
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {items?.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted">
          {page === 0 ? 'Aún no hay resúmenes.' : 'No hay resúmenes en esta página.'}
        </p>
      ) : null}
      {items?.length ? (
        <ol className="grid gap-3">
          {items.map((item) => {
            const expanded = item.id === expandedId
            return (
              <li key={item.id} className="rounded-2xl bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold wrap-break-word">{item.reason}</h3>
                    <time dateTime={item.createdAt} className="text-sm text-muted">{formatDate(item.createdAt)}</time>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Ocultar' : 'Ver'} resumen de ${item.reason}`}
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                  >
                    {expanded ? 'Ocultar resumen' : 'Ver resumen'}
                  </Button>
                </div>
                {expanded ? (
                  <HandoffDetails
                    handoffId={item.id}
                    reason={item.reason}
                    canManageLinks={canManageHandoffLinks(item.createdByUserId, userId, isPrincipal)}
                    onDeleted={() => {
                      setExpandedId(null)
                      reload()
                    }}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
      {pagination && (pagination.totalPages > 1 || page > 0) ? (
        <Pagination
          page={page + 1}
          totalPages={pagination.totalPages}
          totalElements={pagination.totalElements}
          size={pagination.size}
          onPageChange={(next) => {
            setExpandedId(null)
            setPage(next - 1)
          }}
        />
      ) : null}
    </>
  )
}

function HandoffDetails({
  handoffId,
  reason,
  canManageLinks,
  onDeleted,
}: {
  handoffId: number
  reason: string
  canManageLinks: boolean
  onDeleted: () => void
}) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => getHandoff(handoffId, signal), [handoffId])
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="mt-3 grid gap-3 border-t border-line pt-3">
      {loading ? <p role="status" className="text-muted">Cargando resumen…</p> : null}
      {error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : null}
      {data?.questions ? (
        <div>
          <h4 className="font-semibold">Preguntas para el médico</h4>
          <p className="whitespace-pre-line">{data.questions}</p>
        </div>
      ) : null}
      {data ? (
        <div>
          <h4 className="font-semibold">Registros incluidos</h4>
          {data.items.length === 0 ? <p className="text-muted">Este resumen no incluye registros.</p> : (
            <ul className="mt-2 grid gap-2">
              {data.items.map((item) => {
                const facts = [item.dose, item.frequency].filter(Boolean).join(' · ')
                return (
                  <li key={item.healthEntryVersionId} className="rounded-xl bg-surface px-3 py-2">
                    <p className="text-sm text-muted">{categoryLabels[item.categoryCode].name} · {confidenceLabels[item.confidenceLevel]}</p>
                    <p className="font-semibold">{item.title}</p>
                    {item.occurredOn ? <p className="text-sm text-muted">{formatDate(item.occurredOn)}</p> : null}
                    {facts ? <p>{facts}</p> : null}
                    {item.details ? <p className="whitespace-pre-line">{item.details}</p> : null}
                    {item.notes ? <p className="whitespace-pre-line text-sm text-muted">{item.notes}</p> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid gap-2">
        <h4 className="font-semibold">Enlaces para el médico</h4>
        {canManageLinks ? (
          <HandoffLinks handoffId={handoffId} />
        ) : (
          <p className="text-sm text-muted">Solo quien creó este resumen o el cuidador principal puede compartirlo.</p>
        )}
        <div>
          <Button variant="secondary" size="sm" className="text-danger" onClick={() => setDeleting(true)}>
            Borrar resumen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        title="¿Borrar este resumen?"
        message={`"${reason}". Los enlaces que compartiste dejarán de funcionar.`}
        confirmLabel="Borrar resumen"
        cancelLabel="Volver"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await deleteHandoff(handoffId)
          setDeleting(false)
          onDeleted()
        }}
      />
    </div>
  )
}

/** Enlaces del resumen: solo se cargan si la persona puede manejarlos (el backend responde 403 si no). */
function HandoffLinks({ handoffId }: { handoffId: number }) {
  const sessions = useFetch((signal) => listHandoffSessions(handoffId, signal), [handoffId])
  const [creatingLink, setCreatingLink] = useState(false)
  const [revoking, setRevoking] = useState<HandoffSession | null>(null)
  const { notify, anchorProps } = useSuccessNotice()

  return (
    <>
      <span {...anchorProps} />
      {sessions.error ? <LoadError message={sessions.error} onRetry={sessions.reload} /> : null}
      {sessions.data?.length === 0 ? <p className="text-muted">Aún no se compartió este resumen.</p> : null}
      {sessions.data?.length ? (
        <ul className="grid gap-2">
          {sessions.data.map((session) => {
            const state = handoffLinkState(session)
            return (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                <span className="text-sm">
                  <span className="font-semibold">{state}</span> · creado el {formatDateTime(session.createdAt)} · vence el{' '}
                  {formatDateTime(session.expiresAt)}
                </span>
                {state === 'Sin abrir' || state === 'Abierto' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Revocar el enlace creado el ${formatDateTime(session.createdAt)}`}
                    onClick={() => setRevoking(session)}
                  >
                    Revocar
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {creatingLink ? (
        <CreateHandoffLink handoffId={handoffId} onCreated={sessions.reload} />
      ) : (
        <div>
          <Button size="sm" onClick={() => setCreatingLink(true)}>
            Compartir con el médico
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!revoking}
        title="¿Revocar este enlace?"
        message="Quien tenga el enlace ya no podrá abrir el resumen."
        confirmLabel="Revocar enlace"
        workingLabel="Revocando…"
        cancelLabel="Volver"
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return
          await revokeHandoffSession(revoking.id)
          setRevoking(null)
          notify('Enlace revocado.')
          sessions.reload()
        }}
      />
    </>
  )
}
