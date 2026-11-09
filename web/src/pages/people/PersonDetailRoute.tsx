import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../hooks/useToast'
import { listCaregivers } from '../../services/api/caregivers'
import type { CareSubject, CategoryCode, HealthEntry } from '../../types'
import { ageFrom } from '../../utils/format'
import { focusRing, linkButtonClass, linkSecondaryClass } from '../../utils/styles'
import { entriesSearch, parseEntriesParams, parseRouteId } from '../../utils/urlParams'
import type { EntriesParams } from '../../utils/urlParams'
import { AccessLogPanel } from '../care/AccessLogPanel'
import { CaregiversPanel } from '../care/CaregiversPanel'
import { ConsultationsPanel } from '../care/ConsultationsPanel'
import { DelegationsPanel } from '../care/DelegationsPanel'
import { DocumentsPanel } from '../documents/DocumentsPanel'
import { EntriesPanel } from '../entries/EntriesPanel'
import { useLoad } from '../care/useLoad'
import { CareSubjectForm } from '../forms/CareSubjectForm'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from './PersonRouteFrame'
import { useSuccessNotice } from '../shared/useSuccessNotice'

const tabs = [
  { id: 'registros', label: 'Registros' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'cuidadores', label: 'Cuidadores' },
  { id: 'accesos', label: 'Accesos' },
  { id: 'consultas', label: 'Consultas' },
  { id: 'bitacora', label: 'Bitácora' },
] as const

function PersonDetail({ subject, onSubjectChanged }: { subject: CareSubject; onSubjectChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const subjectId = subject.id
  const isPrincipal = subject.myRole === 'PRINCIPAL'
  const age = ageFrom(subject.birthDate)
  const visibleTabs = isPrincipal ? tabs : tabs.filter(({ id }) => id !== 'bitacora')
  const requestedTab = searchParams.get('tab')
  const activeTab = visibleTabs.find(({ id }) => id === requestedTab)?.id ?? 'registros'
  const [newEntry, setNewEntry] = useState<{ category: CategoryCode | null } | null>(null)
  const [entriesVersion, setEntriesVersion] = useState(0)
  const toast = useToast()
  const { notify, anchorProps } = useSuccessNotice()
  const [editing, setEditing] = useState(false)
  const caregivers = useLoad(() => listCaregivers(subjectId), subjectId)
  const activeCaregivers =
    caregivers.state.status === 'ready' ? caregivers.state.data.filter((r) => r.status === 'ACTIVE') : []

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

  function handleEntrySaved(entry: HealthEntry | null) {
    setNewEntry(null)
    if (entry === null) return
    const params = parseEntriesParams(searchParams)
    // Si el filtro ocultaría el registro nuevo, se pasa a "Todas"
    const categoria = params.categoria === null || params.categoria === entry.categoryCode ? params.categoria : null
    updateEntriesParams({ ...params, categoria, page: 1 })
    // Cambiar la key remonta el panel y recarga la lista aunque la URL no cambie
    setEntriesVersion((v) => v + 1)
    notify('Registro guardado.')
  }

  if (!isPrincipal && requestedTab === 'bitacora') {
    return <Navigate to={tabLocation('registros')} replace />
  }

  return (
    <>
      <header className="grid gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{subject.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {age !== null && `${age} años · `}
            {isPrincipal ? 'Cuidador principal' : 'Cuidador/a'}
          </p>
          {subject.notes ? <p className="mt-2 whitespace-pre-line">{subject.notes}</p> : null}
          {activeCaregivers.length > 0 ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold">Cuidadores: </span>
              {activeCaregivers
                .map((r) => (r.relationshipLabel ? `${r.user.name} (${r.relationshipLabel})` : r.user.name))
                .join(', ')}
            </p>
          ) : null}
        </div>
        <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2">
          <Link to={`/personas/${subjectId}/traspaso/nuevo`} className={linkButtonClass}>
            Preparar resumen para el médico
          </Link>
          <Link to={tabLocation('consultas')} className={linkSecondaryClass}>
            Consultas
          </Link>
          {isPrincipal ? (
            <Link to={tabLocation('accesos')} className={linkSecondaryClass}>
              Delegar acceso
            </Link>
          ) : null}
          <button type="button" onClick={() => setEditing(true)} className={linkSecondaryClass}>
            Editar datos
          </button>
        </nav>
      </header>
      <span {...anchorProps} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar persona">
        {editing ? (
          <CareSubjectForm
            subject={subject}
            inModal
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              toast.success('Datos actualizados.')
              onSubjectChanged()
            }}
          />
        ) : null}
      </Modal>

      <nav aria-label="Secciones de la persona" className="flex flex-wrap gap-2">
        {visibleTabs.map(({ id, label }) => (
          <Link
            key={id}
            to={tabLocation(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${focusRing} ${
              activeTab === id ? 'bg-primary text-white' : 'bg-card text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === 'registros' && (
        <>
          {newEntry && (
            <HealthEntryForm
              subjectId={subjectId}
              initialCategory={newEntry.category ?? undefined}
              onCancel={() => setNewEntry(null)}
              onSaved={handleEntrySaved}
            />
          )}
          <EntriesPanel
            key={entriesVersion}
            subjectId={subjectId}
            params={parseEntriesParams(searchParams)}
            onParamsChange={updateEntriesParams}
            onOpenEntry={(entry) => void navigate(`/personas/${subjectId}/registros/${entry.id}`)}
            onNewEntry={(category) => {
              setNewEntry({ category })
            }}
          />
        </>
      )}
      {activeTab === 'documentos' && <DocumentsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'cuidadores' && (
        <CaregiversPanel subjectId={subjectId} isPrincipal={isPrincipal} onChanged={caregivers.reload} />
      )}
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
      {(subject, reload) => <PersonDetail subject={subject} onSubjectChanged={reload} />}
    </PersonRouteFrame>
  )
}
