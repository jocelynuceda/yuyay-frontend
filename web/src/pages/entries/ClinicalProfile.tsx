import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { useFetch } from '../../hooks/useFetch'
import { listHealthEntries } from '../../services/api/healthEntries'
import type { CategoryCode, HealthEntry } from '../../types'
import { clinicalCategoryOverview, PROFILE_CATEGORIES, profileHistoryLabels } from '../../utils/clinicalProfile'
import { categoryLabels, formatDate } from '../../utils/format'
import { focusRing, linkClass } from '../../utils/styles'
import { ConfidenceBadge } from './EntriesPanel'

type ClinicalProfileProps = {
  subjectId: number
  onOpenEntry: (entry: HealthEntry) => void
  onAddEntry: (category: CategoryCode) => void
  /** Al remontar tras guardar, abre la categoría del registro recién creado. */
  initialCategory?: CategoryCode
  onNewEntry?: () => void
}

/** Una vista breve por categoría; el historial completo está en su página de registros. */
export function ClinicalProfile(props: ClinicalProfileProps) {
  return <ProfileContent key={props.subjectId} {...props} />
}

function ProfileContent({ subjectId, onOpenEntry, onAddEntry, initialCategory, onNewEntry }: ClinicalProfileProps) {
  const [open, setOpen] = useState<ReadonlySet<CategoryCode>>(() => new Set(initialCategory ? [initialCategory] : []))
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="clinical-profile-title" className="text-2xl font-semibold">Perfil clínico</h2>
        {onNewEntry ? <Button onClick={onNewEntry}><Icon name="plus" className="h-4 w-4" />Nuevo registro</Button> : null}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
        {PROFILE_CATEGORIES.map((code) => <ProfileCategory key={code} subjectId={subjectId} code={code}
          expanded={open.has(code)} onToggle={() => toggle(code)} onOpenEntry={onOpenEntry} onAddEntry={onAddEntry} />)}
      </ul>
    </section>
  )
}

function ProfileCategory({ subjectId, code, expanded, onToggle, onOpenEntry, onAddEntry }: {
  subjectId: number
  code: CategoryCode
  expanded: boolean
  onToggle: () => void
  onOpenEntry: (entry: HealthEntry) => void
  onAddEntry: (category: CategoryCode) => void
}) {
  const { data, error, errorStatus, loading, reload } = useFetch(
    (signal) => listHealthEntries(subjectId, { category: code, page: 0, size: 1, sort: 'createdAt,desc' }, signal),
    [subjectId, code],
  )
  const overview = !loading && !error && data ? clinicalCategoryOverview(data) : null
  const { name, plural } = categoryLabels[code]
  const panelId = `clinical-profile-${subjectId}-${code}`
  return (
    <li>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface ${focusRing}`}>
        <span className="flex-1 font-semibold">{plural}</span>
        {overview ? <span aria-label={`${overview.total} ${overview.total === 1 ? 'registro' : 'registros'}`}
          className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary">{overview.total}</span>
          : <span className="text-xs text-muted">{error ? 'No disponible' : 'Cargando…'}</span>}
        <Icon name="chevron-right" className={`h-5 w-5 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded ? (
        <div id={panelId} className="grid gap-3 px-4 pb-4">
          {loading ? <p role="status" className="text-sm text-muted">Cargando {plural.toLowerCase()}…</p> : null}
          {error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : null}
          {overview ? overview.latest ? (
            <div className="grid gap-2"><p className="text-xs text-muted">Último registro agregado</p><ProfileEntry entry={overview.latest} onOpen={onOpenEntry} /></div>
          ) : <p className="text-sm text-muted">Aún no hay registros de {plural.toLowerCase()}.</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/people/${subjectId}/entries?category=${code}`} className={`text-sm ${linkClass}`}>{profileHistoryLabels[code]}</Link>
            <button type="button" onClick={() => onAddEntry(code)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-primary hover:underline ${focusRing}`}>
              <Icon name="plus" className="h-4 w-4" />Agregar {name.toLowerCase()}
            </button>
          </div>
        </div>
      ) : null}
    </li>
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
