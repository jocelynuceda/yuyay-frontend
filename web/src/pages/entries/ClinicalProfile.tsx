import { useState } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { Icon } from '../../components/ui/Icon'
import { useFetch } from '../../hooks/useFetch'
import { listHealthEntries } from '../../services/api/healthEntries'
import type { CategoryCode, HealthEntry } from '../../types'
import { groupByCategory, PROFILE_CATEGORIES } from '../../utils/clinicalProfile'
import { categoryLabels, formatDate } from '../../utils/format'
import { collectPages } from '../../utils/pagination'
import { focusRing } from '../../utils/styles'
import { ConfidenceBadge } from './EntriesPanel'

/**
 * Perfil clínico de la persona: una sección desplegable por categoría con sus registros y un botón
 * para agregar uno nuevo de esa categoría. Se pueden abrir varias a la vez, como en la app móvil.
 */
export function ClinicalProfile({
  subjectId,
  onOpenEntry,
  onAddEntry,
}: {
  subjectId: number
  onOpenEntry: (entry: HealthEntry) => void
  onAddEntry: (category: CategoryCode) => void
}) {
  const [open, setOpen] = useState<ReadonlySet<CategoryCode>>(new Set())
  const { data, error, errorStatus, loading, reload } = useFetch(
    (signal) =>
      collectPages((page) => listHealthEntries(subjectId, { page, size: 100, sort: 'createdAt,desc' }, signal)),
    [subjectId],
  )
  const groups = data ? groupByCategory(data) : null

  function toggle(code: CategoryCode) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <section aria-labelledby="clinical-profile-title" className="grid gap-3">
      <h2 id="clinical-profile-title" className="text-2xl font-semibold">
        Perfil clínico
      </h2>
      {loading && !data ? <p className="text-muted">Cargando perfil clínico…</p> : null}
      {error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : null}
      {groups ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
          {PROFILE_CATEGORIES.map((code) => {
            const items = groups.get(code) ?? []
            const expanded = open.has(code)
            const { name, plural } = categoryLabels[code]
            const panelId = `clinical-profile-${code}`
            return (
              <li key={code}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggle(code)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface ${focusRing}`}
                >
                  <span className="flex-1 font-semibold">{plural}</span>
                  {items.length > 0 ? (
                    <span
                      aria-label={`${items.length} ${items.length === 1 ? 'registro' : 'registros'}`}
                      className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary-fg"
                    >
                      {items.length}
                    </span>
                  ) : null}
                  <Icon
                    name="chevron-right"
                    className={`h-5 w-5 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                </button>
                {expanded ? (
                  <div id={panelId} className="grid gap-2 px-4 pb-4">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted">Aún no hay registros de {plural.toLowerCase()}.</p>
                    ) : (
                      <ul className="grid gap-2">
                        {items.map((entry) => (
                          <li key={entry.id}>
                            <ProfileEntry entry={entry} onOpen={onOpenEntry} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <div>
                      <button
                        type="button"
                        onClick={() => onAddEntry(code)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-primary-fg hover:underline ${focusRing}`}
                      >
                        <Icon name="plus" className="h-4 w-4" />
                        Agregar {name.toLowerCase()}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function ProfileEntry({ entry, onOpen }: { entry: HealthEntry; onOpen: (entry: HealthEntry) => void }) {
  const v = entry.latestVersion
  const facts = [v.dose, v.frequency].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className={`grid w-full gap-1 rounded-xl bg-surface px-3 py-2 text-left hover:ring-1 hover:ring-primary ${focusRing}`}
    >
      <span className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-semibold">{v.title}</span>
        <ConfidenceBadge level={v.confidenceLevel} />
      </span>
      {facts ? <span className="text-sm">{facts}</span> : null}
      {v.occurredOn ? <span className="text-sm text-muted">{formatDate(v.occurredOn)}</span> : null}
    </button>
  )
}
