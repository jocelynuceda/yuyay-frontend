import { listHealthEntries } from '../../services/api/healthEntries'
import { CATEGORY_CODES, type CategoryCode, type HealthEntry } from '../../types'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import type { EntriesParams } from '../../utils/urlParams'
import { Pagination } from '../../components/ui/Pagination'
import { useLoad } from '../care/useLoad'

/**
 * Pestaña "Registros" del detalle de persona: listado paginado del backend, con filtro por
 * categoría y tamaño de página en la URL (?categoria=ALLERGY&page=2&size=25).
 * Tabla en escritorio y tarjetas en el celular.
 */
export function EntriesPanel({
  subjectId,
  params,
  onParamsChange,
  onOpenEntry,
  onNewEntry,
}: {
  subjectId: number
  params: EntriesParams
  onParamsChange: (params: EntriesParams) => void
  onOpenEntry: (entry: HealthEntry) => void
  onNewEntry?: (category: CategoryCode | null) => void
}) {
  const { categoria, page, size } = params
  const { state } = useLoad(
    () => listHealthEntries(subjectId, { category: categoria ?? undefined, page: page - 1, size, sort: 'createdAt,desc' }),
    `${subjectId}|${categoria}|${page}|${size}`,
  )
  // Cambiar de filtro o de tamaño vuelve a la primera página
  const setFilter = (changes: Partial<EntriesParams>) => onParamsChange({ ...params, ...changes, page: 1 })

  const result = state.status === 'ready' ? state.data : null
  const totalPages = result?.totalPages ?? 0
  const outOfRange = result !== null && totalPages > 0 && page > totalPages

  return (
    <section aria-labelledby="entries-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="entries-title" className="text-2xl font-semibold">
          Registros
        </h2>
        {onNewEntry ? (
          <button
            type="button"
            onClick={() => onNewEntry(categoria)}
            className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
          >
            Nuevo registro
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
          {([null, ...CATEGORY_CODES] as const).map((code) => {
            const selected = categoria === code
            return (
              <button
                key={code ?? 'ALL'}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter({ categoria: code })}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${focusRing} ${
                  selected ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-primary'
                }`}
              >
                {code ? categoryLabels[code].plural : 'Todas'}
              </button>
            )
          })}
        </nav>
      </div>

      {state.status === 'loading' ? <p className="text-muted">Cargando registros…</p> : null}
      {state.status === 'error' ? (
        <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">
          {state.message}
        </p>
      ) : null}

      {result ? (
        result.content.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-muted">
            {outOfRange ? (
              <>
                Esta página no existe.{' '}
                <button
                  type="button"
                  onClick={() => onParamsChange({ ...params, page: 1 })}
                  className={`font-semibold text-primary underline ${focusRing}`}
                >
                  Ir a la primera página
                </button>
              </>
            ) : categoria ? (
              `No hay registros de ${categoryLabels[categoria].plural.toLowerCase()}.`
            ) : (
              'Aún no hay registros.'
            )}
          </div>
        ) : (
          <>
            <EntriesTable entries={result.content} onOpen={onOpenEntry} />
            <EntriesCards entries={result.content} onOpen={onOpenEntry} />
          </>
        )
      ) : null}

      {result && result.totalElements > 0 && !outOfRange ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalElements={result.totalElements}
          size={size}
          onPageChange={(p) => onParamsChange({ ...params, page: p })}
          onSizeChange={(n) => setFilter({ size: n })}
        />
      ) : null}
    </section>
  )
}

function factsOf(entry: HealthEntry) {
  return [entry.latestVersion.dose, entry.latestVersion.frequency].filter(Boolean).join(' · ')
}

function EntriesTable({ entries, onOpen }: { entries: HealthEntry[]; onOpen: (entry: HealthEntry) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-card md:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Registros de salud</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Registro
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Categoría
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Certeza
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Actualizado
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const v = entry.latestVersion
            const facts = factsOf(entry)
            return (
              <tr key={entry.id} className="border-b border-line last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className={`text-left font-semibold text-ink hover:text-primary hover:underline ${focusRing}`}
                  >
                    {v.title}
                  </button>
                  {facts ? <span className="block text-muted">{facts}</span> : null}
                </td>
                <td className="px-4 py-3">{entry.categoryName}</td>
                <td className="px-4 py-3">
                  <ConfidenceBadge level={v.confidenceLevel} />
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(v.declaredAt)}
                  <span className="block">por {v.declaredBy.name}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EntriesCards({ entries, onOpen }: { entries: HealthEntry[]; onOpen: (entry: HealthEntry) => void }) {
  return (
    <ul className="grid gap-3 md:hidden">
      {entries.map((entry) => {
        const v = entry.latestVersion
        const facts = factsOf(entry)
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className={`grid w-full gap-1 rounded-2xl bg-card p-4 text-left ${focusRing}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{entry.categoryName}</span>
                <ConfidenceBadge level={v.confidenceLevel} />
              </span>
              <span className="text-lg font-semibold">{v.title}</span>
              {facts ? <span className="text-sm">{facts}</span> : null}
              <span className="text-sm text-muted">
                {formatDate(v.declaredAt)} · {v.declaredBy.name}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ConfidenceBadge({ level }: { level: HealthEntry['latestVersion']['confidenceLevel'] }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        level === 'CONFIRMED' ? 'bg-accent-tint text-accent-text' : 'bg-soft text-soft-text'
      }`}
    >
      {confidenceLabels[level]}
    </span>
  )
}
