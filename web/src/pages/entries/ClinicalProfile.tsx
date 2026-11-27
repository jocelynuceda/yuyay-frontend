import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Icon, type IconName } from '../../components/ui/Icon'
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

/** Ícono y color de cada categoría, como en la app móvil. */
const categoryTiles: Record<CategoryCode, { icon: IconName; color: string; image?: string }> = {
  ALLERGY: { icon: 'flower', color: 'bg-accent text-on-accent', image: '/categories/allergy.png' },
  CONDITION: { icon: 'pulse', color: 'bg-soft text-soft-text' },
  MEDICATION: { icon: 'medkit', color: 'bg-primary-tint text-primary-fg', image: '/categories/medication.png' },
  IMMUNIZATION: { icon: 'shield', color: 'bg-primary text-white', image: '/categories/immunization.png' },
  EPISODE: { icon: 'bolt', color: 'bg-danger-bg text-danger' },
  EXAM_RESULT: { icon: 'flask', color: 'bg-accent-tint text-accent-text', image: '/categories/exam.png' },
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
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {PROFILE_CATEGORIES.map((code) => <ProfileCategory key={code} subjectId={subjectId} code={code}
          expanded={open.has(code)} onToggle={() => toggle(code)} onOpenEntry={onOpenEntry} onAddEntry={onAddEntry} />)}
      </div>
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
  const { icon, color, image } = categoryTiles[code]
  return (
    <>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}
        className={`control-interactive flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-2xl bg-card p-2 text-center shadow-[var(--shadow-soft)] ${expanded ? 'ring-2 ring-primary' : ''} ${focusRing}`}>
        {image ? <img src={image} alt="" className="h-11 w-11 object-contain" />
          : <span className={`grid h-11 w-11 place-items-center rounded-full ${color}`}><Icon name={icon} /></span>}
        <span className="max-w-full text-sm font-semibold wrap-break-word">{plural}</span>
        {overview ? <span aria-label={`${overview.total} ${overview.total === 1 ? 'registro' : 'registros'}`}
          className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-semibold text-primary-fg">{overview.total}</span>
          : <span className="text-xs text-muted">{error ? 'No disponible' : 'Cargando…'}</span>}
      </button>
      {expanded ? (
        <div id={panelId} className="order-last col-span-full grid gap-3 rounded-2xl bg-card p-4">
          <h3 className="text-lg font-semibold">{plural}</h3>
          {loading ? <p role="status" className="text-sm text-muted">Cargando {plural.toLowerCase()}…</p> : null}
          {error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : null}
          {overview ? overview.latest ? (
            <div className="grid gap-2"><p className="text-xs text-muted">Último registro agregado</p><ProfileEntry entry={overview.latest} onOpen={onOpenEntry} /></div>
          ) : <p className="text-sm text-muted">Aún no hay registros de {plural.toLowerCase()}.</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/people/${subjectId}/entries?category=${code}`} className={`text-sm ${linkClass}`}>{profileHistoryLabels[code]}</Link>
            <button type="button" onClick={() => onAddEntry(code)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-primary-fg hover:underline ${focusRing}`}>
              <Icon name="plus" className="h-4 w-4" />Agregar {name.toLowerCase()}
            </button>
          </div>
        </div>
      ) : null}
    </>
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
