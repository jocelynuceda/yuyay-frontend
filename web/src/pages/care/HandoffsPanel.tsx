import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useFetch } from '../../hooks/useFetch'
import { getHandoff, listHandoffs } from '../../services/api/handoffs'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { linkButtonClass } from '../../utils/styles'

const PAGE_SIZE = 10

export function HandoffsPanel({ subjectId }: { subjectId: number }) {
  return (
    <section aria-labelledby="handoffs-title" className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="handoffs-title" className="text-2xl font-semibold">Resúmenes para el médico</h2>
          <p className="text-sm text-muted">Revisa los resúmenes preparados para una consulta o urgencia.</p>
        </div>
        <Link to={`/personas/${subjectId}/traspaso/nuevo`} className={linkButtonClass}>Nuevo resumen</Link>
      </div>
      <HandoffHistory key={subjectId} subjectId={subjectId} />
    </section>
  )
}

function HandoffHistory({ subjectId }: { subjectId: number }) {
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
                {expanded ? <HandoffDetails handoffId={item.id} /> : null}
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

function HandoffDetails({ handoffId }: { handoffId: number }) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => getHandoff(handoffId, signal), [handoffId])

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
    </div>
  )
}
