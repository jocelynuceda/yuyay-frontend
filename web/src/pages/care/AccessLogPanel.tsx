import { useState } from 'react'
import { listAccessLogs } from '../../services/api/careSubjects'
import { listCaregivers } from '../../services/api/caregivers'
import { listDelegations } from '../../services/api/delegations'
import type { AccessAction, AccessLog } from '../../types'
import { formatDateTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { useLoad } from './useLoad'

const PAGE_SIZE = 20

const actionLabels: Record<AccessAction, string> = {
  VIEW: 'vio',
  CREATE: 'creó',
  UPDATE: 'editó',
  DELETE: 'borró',
  OPEN_HANDOFF_LINK: 'abrió',
  EXCHANGE_DELEGATION: 'abrió',
}

const targetLabels: Record<string, string> = {
  HEALTH_ENTRY: 'un registro',
  HANDOFF: 'el resumen para el médico',
  DELEGATION: 'el acceso delegado',
}

/** Nombres de cuidadores y delegados, porque la bitácora solo trae sus ids. */
async function loadNames(subjectId: number) {
  const [caregivers, delegations] = await Promise.all([listCaregivers(subjectId), listDelegations(subjectId)])
  return {
    users: new Map(caregivers.map((r) => [r.user.id, r.user.name])),
    delegations: new Map(delegations.map((d) => [d.id, d.granteeName])),
  }
}

type Names = Awaited<ReturnType<typeof loadNames>>

function whoDidIt(log: AccessLog, names: Names | null) {
  if (log.visitorName) return { who: log.visitorName, detail: log.visitorRole ? `visitante, ${log.visitorRole}` : 'visitante' }
  if (log.delegationId !== null) {
    return { who: names?.delegations.get(log.delegationId) ?? `Acceso delegado #${log.delegationId}`, detail: 'acceso delegado' }
  }
  if (log.userId !== null) return { who: names?.users.get(log.userId) ?? `Usuario #${log.userId}`, detail: 'cuidador/a' }
  return { who: 'Alguien', detail: '' }
}

/**
 * Pestaña "Bitácora" (solo principal): quién vio o abrió la información y cuándo.
 * Paginada en el backend, de 20 en 20, la más reciente primero.
 */
export function AccessLogPanel({ subjectId }: { subjectId: number }) {
  const [page, setPage] = useState(1)
  const log = useLoad(() => listAccessLogs(subjectId, { page: page - 1, size: PAGE_SIZE }), `${subjectId}|${page}`)
  const names = useLoad(() => loadNames(subjectId), subjectId)
  const nameMap = names.state.status === 'ready' ? names.state.data : null

  const result = log.state.status === 'ready' ? log.state.data : null
  const button = `rounded-xl border border-line bg-white px-4 py-2 font-semibold disabled:opacity-40 ${focusRing}`

  return (
    <section aria-labelledby="log-title" className="grid gap-4">
      <div>
        <h2 id="log-title" className="text-2xl font-semibold">
          Bitácora de accesos
        </h2>
        <p className="text-sm text-muted">Quién vio o abrió la información de esta persona. Solo la ve el cuidador principal.</p>
      </div>

      {log.state.status === 'loading' ? <p className="text-muted">Cargando bitácora…</p> : null}
      {log.state.status === 'error' ? (
        <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">
          {log.state.message}
        </p>
      ) : null}

      {result ? (
        result.content.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-muted">Aún no hay accesos registrados.</p>
        ) : (
          <ol className="grid gap-2">
            {result.content.map((entry) => {
              const { who, detail } = whoDidIt(entry, nameMap)
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-white px-4 py-3">
                  <p>
                    <span className="font-semibold">{who}</span>
                    {detail ? <span className="text-sm text-muted"> ({detail})</span> : null}{' '}
                    {actionLabels[entry.action] ?? 'accedió a'} {targetLabels[entry.targetType] ?? entry.targetType.toLowerCase()}
                    {entry.targetType === 'HEALTH_ENTRY' && entry.targetId ? ` #${entry.targetId}` : ''}
                  </p>
                  <time dateTime={entry.occurredAt} className="text-sm text-muted">
                    {formatDateTime(entry.occurredAt)}
                  </time>
                </li>
              )
            })}
          </ol>
        )
      ) : null}

      {result && result.totalPages > 1 ? (
        <nav aria-label="Paginación de la bitácora" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            Página {page} de {result.totalPages} · {result.totalElements} accesos
          </p>
          <div className="flex gap-2">
            <button type="button" className={button} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Más recientes
            </button>
            <button type="button" className={button} disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>
              Anteriores →
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  )
}
