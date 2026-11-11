import { useState } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { Pagination } from '../../components/ui/Pagination'
import { useFetch } from '../../hooks/useFetch'
import { listAccessLogs } from '../../services/api/careSubjects'
import { listCaregivers } from '../../services/api/caregivers'
import { listDelegations } from '../../services/api/delegations'
import type { AccessAction, AccessLog } from '../../types'
import { formatDateTime } from '../../utils/format'

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
async function loadNames(subjectId: number, signal: AbortSignal) {
  const [caregivers, delegations] = await Promise.all([listCaregivers(subjectId, signal), listDelegations(subjectId, signal)])
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
  const log = useFetch((signal) => listAccessLogs(subjectId, { page: page - 1, size: PAGE_SIZE }, signal), [subjectId, page])
  const names = useFetch((signal) => loadNames(subjectId, signal), [subjectId])
  const result = log.data

  return (
    <section aria-labelledby="log-title" className="grid gap-4">
      <div>
        <h2 id="log-title" className="text-2xl font-semibold">
          Bitácora de accesos
        </h2>
        <p className="text-sm text-muted">Quién vio o abrió la información de esta persona. Solo la ve el cuidador principal.</p>
      </div>

      {log.loading && !result ? <p className="text-muted">Cargando bitácora…</p> : null}
      {log.error ? <LoadError message={log.error} status={log.errorStatus} onRetry={log.reload} /> : null}

      {result ? (
        result.content.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-muted">Aún no hay accesos registrados.</p>
        ) : (
          <ol className="grid gap-2">
            {result.content.map((entry) => {
              const { who, detail } = whoDidIt(entry, names.data)
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl bg-card px-4 py-3">
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
        <Pagination
          page={page}
          totalPages={result.totalPages}
          totalElements={result.totalElements}
          size={PAGE_SIZE}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  )
}
