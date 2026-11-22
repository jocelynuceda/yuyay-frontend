import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Pagination } from '../../components/ui/Pagination'
import { useFetch } from '../../hooks/useFetch'
import { listHandoffs } from '../../services/api/handoffs'
import { formatDate } from '../../utils/format'
import { linkButtonClass, linkClass } from '../../utils/styles'

const PAGE_SIZE = 10

export function HandoffsPanel({
  subjectId,
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
      <HandoffHistory key={subjectId} subjectId={subjectId} />
    </section>
  )
}

function HandoffHistory({ subjectId }: { subjectId: number }) {
  const [page, setPage] = useState(0)
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
            return (
              <li key={item.id} className="rounded-2xl bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold wrap-break-word">{item.reason}</h3>
                    <time dateTime={item.createdAt} className="text-sm text-muted">{formatDate(item.createdAt)}</time>
                  </div>
                  <Link to={`/people/${subjectId}/handoffs/${item.id}`} className={linkClass}
                    aria-label={`Ver resumen de ${item.reason}`}>
                    Ver resumen
                  </Link>
                </div>
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
          onPageChange={(next) => setPage(next - 1)}
        />
      ) : null}
    </>
  )
}
