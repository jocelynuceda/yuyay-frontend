import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { deleteCareSubject } from '../../services/api/careSubjects'
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
import { HandoffsPanel } from '../care/HandoffsPanel'
import { DocumentsPanel } from '../documents/DocumentsPanel'
import { VoiceNotesPanel } from '../documents/VoiceNotesPanel'
import { EntriesPanel } from '../entries/EntriesPanel'
import { CareSubjectForm } from '../forms/CareSubjectForm'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from './PersonRouteFrame'
import { useSuccessNotice } from '../../hooks/useSuccessNotice'

const tabs = [
  { id: 'entries', label: 'Registros' },
  { id: 'documents', label: 'Documentos' },
  { id: 'voice-notes', label: 'Notas de voz' },
  { id: 'caregivers', label: 'Cuidadores' },
  { id: 'access', label: 'Accesos' },
  { id: 'appointments', label: 'Consultas' },
  { id: 'handoffs', label: 'Resúmenes' },
  { id: 'access-log', label: 'Bitácora' },
] as const

function PersonDetail({ subject, onSubjectChanged }: { subject: CareSubject; onSubjectChanged: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const subjectId = subject.id
  const isPrincipal = subject.myRole === 'PRINCIPAL'
  const age = ageFrom(subject.birthDate)
  const visibleTabs = isPrincipal ? tabs : tabs.filter(({ id }) => id !== 'access-log')
  const requestedTab = searchParams.get('tab')
  const activeTab = visibleTabs.find(({ id }) => id === requestedTab)?.id ?? 'entries'
  const [newEntry, setNewEntry] = useState<{ category: CategoryCode | null } | null>(null)
  const [entriesVersion, setEntriesVersion] = useState(0)
  const toast = useToast()
  const { notify, anchorProps } = useSuccessNotice()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const caregivers = useFetch((signal) => listCaregivers(subjectId, signal), [subjectId])
  const activeCaregivers = caregivers.data?.filter((r) => r.status === 'ACTIVE') ?? []

  function tabLocation(tab: typeof activeTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    return { search: `?${next}` }
  }

  function updateEntriesParams(params: EntriesParams) {
    const filters = new URLSearchParams(entriesSearch(params))
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', 'entries')
      for (const key of ['category', 'page', 'size']) {
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
    const category = params.category === null || params.category === entry.categoryCode ? params.category : null
    updateEntriesParams({ ...params, category, page: 1 })
    // Cambiar la key remonta el panel y recarga la lista aunque la URL no cambie
    setEntriesVersion((v) => v + 1)
    notify('Registro guardado.')
  }

  if (!isPrincipal && requestedTab === 'access-log') {
    return <Navigate to={tabLocation('entries')} replace />
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
          <Link to={`/people/${subjectId}/handoff/new`} className={linkButtonClass}>
            Preparar resumen para el médico
          </Link>
          <Link to={tabLocation('appointments')} className={linkSecondaryClass}>
            Consultas
          </Link>
          {isPrincipal ? (
            <Link to={tabLocation('access')} className={linkSecondaryClass}>
              Delegar acceso
            </Link>
          ) : null}
          <button type="button" onClick={() => setEditing(true)} className={linkSecondaryClass}>
            Editar datos
          </button>
          {isPrincipal ? (
            <button type="button" onClick={() => setDeleting(true)} className={linkSecondaryClass.replace('text-ink', 'text-danger')}>
              Eliminar persona
            </button>
          ) : null}
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

      <ConfirmDialog
        open={deleting}
        title={`¿Eliminar a ${subject.name}?`}
        message="Solo se puede eliminar a una persona que aún no tiene registros de salud. Esta acción no se puede deshacer."
        confirmLabel="Eliminar persona"
        workingLabel="Eliminando…"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await deleteCareSubject(subjectId)
          toast.success(`Se eliminó a ${subject.name}.`)
          void navigate('/people', { replace: true })
        }}
      />

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

      {activeTab === 'entries' && (
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
            onOpenEntry={(entry) => void navigate(`/people/${subjectId}/entries/${entry.id}`)}
            onNewEntry={(category) => {
              setNewEntry({ category })
            }}
          />
        </>
      )}
      {activeTab === 'documents' && <DocumentsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'voice-notes' && <VoiceNotesPanel key={subjectId} subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'caregivers' && (
        <CaregiversPanel subjectId={subjectId} isPrincipal={isPrincipal} onChanged={caregivers.reload} />
      )}
      {activeTab === 'access' && <DelegationsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'appointments' && <ConsultationsPanel subjectId={subjectId} subjectName={subject.name} isPrincipal={isPrincipal} />}
      {activeTab === 'handoffs' && <HandoffsPanel key={subjectId} subjectId={subjectId} />}
      {isPrincipal && activeTab === 'access-log' && <AccessLogPanel subjectId={subjectId} />}
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
