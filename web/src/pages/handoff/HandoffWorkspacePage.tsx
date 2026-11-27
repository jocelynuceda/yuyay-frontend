import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { HandoffAccessCode } from '../../components/security/HandoffAccessCode'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Pagination } from '../../components/ui/Pagination'
import { useFetch } from '../../hooks/useFetch'
import { deleteHandoff, getHandoff, listHandoffSessions, revokeHandoffSession } from '../../services/api/handoffs'
import type { HandoffDetail, HandoffSession } from '../../types'
import { categoryLabels, confidenceLabels, formatDate, formatDateTime } from '../../utils/format'
import { canManageHandoffLinks, handoffLinkState } from '../../utils/handoffLinks'
import { linkButtonClass, linkClass, linkSecondaryClass } from '../../utils/styles'
import { CreateHandoffLink } from './HandoffLinkStep'

export type HandoffWorkspaceMode = 'detail' | 'share' | 'code'
type WorkspaceProps = {
  subjectId: number
  subjectName?: string
  handoffId: number
  isPrincipal: boolean
  userId: number | undefined
  mode: HandoffWorkspaceMode
  sessionId?: number
  showBack?: boolean
}

const detailPath = (subjectId: number, handoffId: number) => `/people/${subjectId}/handoffs/${handoffId}`

export function HandoffWorkspacePage({ showBack = true, ...props }: WorkspaceProps) {
  const back = props.mode === 'detail' ? `/people/${props.subjectId}?tab=handoffs` : detailPath(props.subjectId, props.handoffId)
  return (
    <div className="grid min-w-0 gap-6">
      {showBack ? <Link to={back} className={`justify-self-start ${linkSecondaryClass}`}><span aria-hidden="true">←</span>Regresar {props.mode === 'detail' ? 'a resúmenes' : 'al resumen'}</Link> : null}
      <WorkspaceContent key={`${props.subjectId}:${props.handoffId}:${props.mode}:${props.sessionId ?? ''}`} {...props} />
    </div>
  )
}

function WorkspaceContent({ subjectId, subjectName, handoffId, isPrincipal, userId, mode, sessionId }: WorkspaceProps) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => getHandoff(handoffId, signal, subjectId), [handoffId, subjectId])
  if (loading) return <p role="status" className="text-muted">Cargando resumen…</p>
  if (error) return <LoadError message={error} status={errorStatus} onRetry={reload} />
  if (!data || data.id !== handoffId || data.careSubjectId !== subjectId) {
    return <LoadError message="Este resumen no pertenece a la persona seleccionada." status={404} onRetry={reload} />
  }
  const canManage = canManageHandoffLinks(data.createdByUserId, userId, isPrincipal)
  if (mode !== 'detail' && !canManage) {
    return <LoadError message="Solo quien creó este resumen o el cuidador principal puede manejar sus enlaces." status={403} onRetry={reload} />
  }
  if (mode === 'share') return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <CreateHandoffLink handoffId={handoffId} subjectId={subjectId} subjectName={subjectName} />
    </div>
  )
  if (mode === 'code') return <ExistingCodePage subjectId={subjectId} handoff={data} sessionId={sessionId} />
  return <HandoffDetails subjectId={subjectId} handoff={data} canManage={canManage} />
}

function HandoffDetails({ subjectId, handoff, canManage }: { subjectId: number; handoff: HandoffDetail; canManage: boolean }) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold">Resumen para el médico</h1>
        <p className="text-xl font-semibold [overflow-wrap:anywhere]">{handoff.reason}</p>
        <p className="text-sm text-muted">Preparado el {formatDateTime(handoff.createdAt)}</p>
        {canManage ? <Link to={`${detailPath(subjectId, handoff.id)}/share`} className={`justify-self-start ${linkButtonClass}`}>Generar enlace y código</Link> : null}
      </header>
      {handoff.questions ? (
        <section className="rounded-2xl bg-card p-5"><h2 className="text-xl font-semibold">Preguntas para el médico</h2>
          <p className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{handoff.questions}</p></section>
      ) : null}
      <section className="grid min-w-0 gap-3" aria-label="Registros incluidos">
        <h2 className="text-xl font-semibold">Registros incluidos</h2>
        {handoff.items.length === 0 ? <p className="text-muted">Este resumen no incluye registros.</p> : (
          <ul className="grid min-w-0 gap-3">{handoff.items.map((item) => (
            <li key={item.healthEntryVersionId} className="min-w-0 rounded-2xl bg-card p-5">
              <p className="text-sm text-muted">{categoryLabels[item.categoryCode].name} · {confidenceLabels[item.confidenceLevel]}</p>
              <h3 className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{item.title}</h3>
              {item.occurredOn ? <p className="text-sm text-muted">{formatDate(item.occurredOn)}</p> : null}
              {item.dose || item.frequency ? <p className="mt-2">{[item.dose, item.frequency].filter(Boolean).join(' · ')}</p> : null}
              {item.details ? <p className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.details}</p> : null}
              {item.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-muted [overflow-wrap:anywhere]">{item.notes}</p> : null}
            </li>
          ))}</ul>
        )}
      </section>
      <section className="grid gap-3" aria-label="Enlaces para el médico">
        <h2 className="text-xl font-semibold">Enlaces para el médico</h2>
        {canManage ? <SessionHistory subjectId={subjectId} handoffId={handoff.id} /> : (
          <p className="text-sm text-muted">Solo quien creó este resumen o el cuidador principal puede compartirlo.</p>
        )}
      </section>
      <div><Button variant="secondary" className="text-danger" onClick={() => setDeleting(true)}>Borrar resumen</Button></div>
      <ConfirmDialog open={deleting} title="¿Borrar este resumen?" message={`"${handoff.reason}". Los enlaces que compartiste dejarán de funcionar.`}
        confirmLabel="Borrar resumen" cancelLabel="Volver" onCancel={() => setDeleting(false)}
        onConfirm={async () => { await deleteHandoff(handoff.id, subjectId); void navigate(`/people/${subjectId}?tab=handoffs`, { replace: true }) }} />
    </div>
  )
}

function SessionHistory({ subjectId, handoffId }: { subjectId: number; handoffId: number }) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => listHandoffSessions(handoffId, signal, subjectId), [handoffId, subjectId])
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [revoking, setRevoking] = useState<HandoffSession | null>(null)
  const sessions = (data ?? []).filter((session) => session.handoffId === handoffId)
  const size = 5
  const totalPages = Math.max(1, Math.ceil(sessions.length / size))
  const shownPage = Math.min(page, totalPages)
  return (
    <>
      {notice ? <p role="status" className="text-sm text-accent-text">{notice}</p> : null}
      {loading ? <p role="status" className="text-muted">Cargando enlaces…</p> : error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : (
        sessions.length === 0 ? <p className="text-muted">Aún no se compartió este resumen.</p> : (
          <ul className="grid gap-3">{sessions.slice((shownPage - 1) * size, shownPage * size).map((session) => {
            const state = handoffLinkState(session)
            const active = state === 'Sin abrir' || state === 'Abierto'
            return <li key={session.id} className="grid gap-3 rounded-2xl bg-card p-4 sm:flex sm:items-center sm:justify-between">
              <div className="text-sm"><p className="font-semibold">{state}</p><p>Creado el {formatDateTime(session.createdAt)} · vence el {formatDateTime(session.expiresAt)}</p>
                {session.accessCodeRequired !== true ? <p className="mt-1 text-muted">Enlace anterior sin código de acceso adicional.</p> : null}</div>
              <div className="flex flex-wrap items-center gap-3">
                {active && session.accessCodeRequired === true ? <Link to={`${detailPath(subjectId, handoffId)}/sessions/${session.id}`} className={linkClass}>Ver código de acceso</Link> : null}
                {active ? <Button variant="secondary" size="sm" aria-label={`Revocar el enlace creado el ${formatDateTime(session.createdAt)}`} onClick={() => setRevoking(session)}>Revocar</Button> : null}
              </div>
            </li>
          })}</ul>
        )
      )}
      {!loading && !error && totalPages > 1 ? <Pagination page={shownPage} totalPages={totalPages} totalElements={sessions.length} size={size} onPageChange={setPage} /> : null}
      <ConfirmDialog open={!!revoking} title="¿Revocar este enlace?" message="Quien tenga el enlace ya no podrá abrir el resumen."
        confirmLabel="Revocar enlace" workingLabel="Revocando…" cancelLabel="Volver" onCancel={() => setRevoking(null)}
        onConfirm={async () => { if (!revoking) return; await revokeHandoffSession(revoking.id, subjectId); setRevoking(null); setNotice('Enlace revocado.'); reload() }} />
    </>
  )
}

function ExistingCodePage({ subjectId, handoff, sessionId }: { subjectId: number; handoff: HandoffDetail; sessionId?: number }) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => listHandoffSessions(handoff.id, signal, subjectId), [handoff.id, subjectId])
  const [revoking, setRevoking] = useState(false)
  const [revoked, setRevoked] = useState(false)
  const session = data?.find((candidate) => candidate.id === sessionId && candidate.handoffId === handoff.id)
  if (loading) return <p role="status" className="text-muted">Cargando enlace…</p>
  if (error) return <LoadError message={error} status={errorStatus} onRetry={reload} />
  if (!session) return <LoadError message="Este enlace no pertenece al resumen seleccionado." status={404} onRetry={reload} />
  const state = revoked ? 'Revocado' : handoffLinkState(session)
  const active = state === 'Sin abrir' || state === 'Abierto'
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <header><h1 className="text-3xl font-semibold">Código para el médico</h1><p className="mt-2 break-words text-muted">{handoff.reason}</p></header>
      <p className="text-sm text-muted">{state} · vence el {formatDateTime(session.expiresAt)}</p>
      {active && session.accessCodeRequired === true ? <HandoffAccessCode sessionId={session.id} subjectId={subjectId} /> : (
        <p role="status" className="rounded-2xl bg-card p-5">{active ? 'Este enlace anterior no requiere código de acceso adicional.' : 'Este enlace ya no está disponible. Puedes generar uno nuevo.'}</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {active ? <Button variant="secondary" className="text-danger" onClick={() => setRevoking(true)}>Revocar enlace</Button> : null}
        <Link to={`${detailPath(subjectId, handoff.id)}/share`} className={linkClass}>Generar otro enlace y código</Link>
      </div>
      <ConfirmDialog open={revoking} title="¿Revocar este enlace?" message="Quien tenga el enlace ya no podrá abrir el resumen."
        confirmLabel="Revocar enlace" workingLabel="Revocando…" cancelLabel="Volver" onCancel={() => setRevoking(false)}
        onConfirm={async () => { await revokeHandoffSession(session.id, subjectId); setRevoking(false); setRevoked(true) }} />
    </div>
  )
}
