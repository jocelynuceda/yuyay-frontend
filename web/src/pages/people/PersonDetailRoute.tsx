import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CareSubject, CategoryCode } from '../../types'
import { ageFrom } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { entriesSearch, parseEntriesParams, parseRouteId } from '../../utils/urlParams'
import type { EntriesParams } from '../../utils/urlParams'
import { AccessLogPanel } from '../care/AccessLogPanel'
import { CaregiversPanel } from '../care/CaregiversPanel'
import { ConsultationsPanel } from '../care/ConsultationsPanel'
import { DelegationsPanel } from '../care/DelegationsPanel'
import { EntriesPanel } from '../entries/EntriesPanel'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from './PersonRouteFrame'

const tabs = [
  { id: 'registros', label: 'Registros' },
  { id: 'cuidadores', label: 'Cuidadores' },
  { id: 'accesos', label: 'Accesos' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'bitacora', label: 'Bitácora' },
] as const

function PersonDetail({ subject }: { subject: CareSubject }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [entryDraft, setEntryDraft] = useState<{ category: CategoryCode | null } | null>(null)
  const [entriesVersion, setEntriesVersion] = useState(0)
  const subjectId = subject.id
  const isPrincipal = subject.myRole === 'PRINCIPAL'
  const age = ageFrom(subject.birthDate)
  const visibleTabs = isPrincipal ? tabs : tabs.filter(({ id }) => id !== 'bitacora')
  const requestedTab = searchParams.get('tab')
  const activeTab = visibleTabs.find(({ id }) => id === requestedTab)?.id ?? 'registros'

  function tabLocation(tab: typeof activeTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    return { search: `?${next}` }
  }

  function updateEntriesParams(params: EntriesParams) {
    const filters = new URLSearchParams(entriesSearch(params))
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', 'registros')
      for (const key of ['categoria', 'page', 'size']) {
        const value = filters.get(key)
        if (value === null) next.delete(key)
        else next.set(key, value)
      }
      return next
    })
  }

  function handleEntrySaved() {
    setEntryDraft(null)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', 'registros')
      next.delete('page')
      return next
    }, { replace: true })
    setEntriesVersion((version) => version + 1)
  }

  if (!isPrincipal && requestedTab === 'bitacora') {
    return <Navigate to={tabLocation('registros')} replace />
  }

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{subject.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {age !== null && `${age} años · `}
            {isPrincipal ? 'Cuidador principal' : 'Cuidador/a'}
          </p>
        </div>
        <Link
          to={`/personas/${subjectId}/traspaso/nuevo`}
          className={`rounded-xl bg-primary px-4 py-2.5 font-semibold text-white ${focusRing}`}
        >
          Preparar resumen para el médico
        </Link>
      </header>

      <nav aria-label="Secciones de la persona" className="flex flex-wrap gap-2">
        {visibleTabs.map(({ id, label }) => (
          <Link
            key={id}
            to={tabLocation(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${focusRing} ${
              activeTab === id ? 'bg-primary text-white' : 'bg-white text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === 'registros' && (
        <>
          {entryDraft && (
            <HealthEntryForm
              subjectId={subjectId}
              initialCategory={entryDraft.category ?? undefined}
              onSaved={handleEntrySaved}
              onCancel={() => setEntryDraft(null)}
            />
          )}
          <EntriesPanel
            key={entriesVersion}
            subjectId={subjectId}
            params={parseEntriesParams(searchParams)}
            onParamsChange={updateEntriesParams}
            onOpenEntry={(entry) => void navigate(`/personas/${subjectId}/registros/${entry.id}`)}
            onNewEntry={entryDraft ? undefined : (category) => setEntryDraft({ category })}
          />
        </>
      )}
      {activeTab === 'cuidadores' && <CaregiversPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'accesos' && <DelegationsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'consultas' && <ConsultationsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {isPrincipal && activeTab === 'bitacora' && <AccessLogPanel subjectId={subjectId} />}
    </>
  )
}

export default function PersonDetailRoute() {
  const { id } = useParams()
  const subjectId = parseRouteId(id)
  if (subjectId === null) return <NotFoundPage />

  return (
    <PersonRouteFrame key={subjectId} subjectId={subjectId}>
      {(subject) => <PersonDetail subject={subject} />}
    </PersonRouteFrame>
  )
}
