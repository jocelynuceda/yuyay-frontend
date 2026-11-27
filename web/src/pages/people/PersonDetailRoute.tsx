import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AvatarButton } from '../../components/ui/AvatarButton'
import { AvatarPicker, SubjectAvatar } from '../../components/ui/AvatarPicker'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { deleteCareSubject } from '../../services/api/careSubjects'
import { listCaregivers } from '../../services/api/caregivers'
import type { CareSubject, CategoryCode, HealthEntry } from '../../types'
import { ageFrom } from '../../utils/format'
import { focusRing, linkActiveClass, linkButtonClass, linkSecondaryClass } from '../../utils/styles'
import { entriesSearch, parseEntriesParams, parseRouteId } from '../../utils/urlParams'
import { AccessLogPanel } from '../care/AccessLogPanel'
import { CaregiversPanel } from '../care/CaregiversPanel'
import { ConsultationsPanel } from '../care/ConsultationsPanel'
import { DelegationsPanel } from '../care/DelegationsPanel'
import { HandoffsPanel } from '../care/HandoffsPanel'
import { DocumentsPanel } from '../documents/DocumentsPanel'
import { VoiceNotesPanel } from '../documents/VoiceNotesPanel'
import { ClinicalProfile } from '../entries/ClinicalProfile'
import { CareSubjectForm } from '../forms/CareSubjectForm'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import NotFoundPage from '../NotFoundPage'
import { CareAuthorizationStatus } from './CareAuthorizationStatus'
import { PersonRouteFrame } from './PersonRouteFrame'
import { MyCareRoleBadge } from './MyCareRoleBadge'
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const subjectId = subject.id
  const isPrincipal = subject.myRole === 'PRINCIPAL'
  const userId = useAuth().user?.id
  const age = ageFrom(subject.birthDate)
  const visibleTabs = isPrincipal ? tabs : tabs.filter(({ id }) => id !== 'access-log')
  const requestedTab = searchParams.get('tab')
  const activeTab = visibleTabs.find(({ id }) => id === requestedTab)?.id ?? 'entries'
  const [newEntry, setNewEntry] = useState<{ category: CategoryCode | null } | null>(null)
  const newEntryRef = useRef<HTMLDivElement>(null)
  // Al abrir el formulario desde el perfil clínico (más abajo), se lleva a la vista
  useEffect(() => {
    if (newEntry) newEntryRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [newEntry])
  const [entriesVersion, setEntriesVersion] = useState(0)
  const [lastCreatedCategory, setLastCreatedCategory] = useState<CategoryCode>()
  const toast = useToast()
  const { notify, anchorProps } = useSuccessNotice()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const caregivers = useFetch((signal) => listCaregivers(subjectId, signal), [subjectId])
  const activeCaregivers = caregivers.data?.filter((r) => r.status === 'ACTIVE') ?? []

  /** Acceso rápido que lleva a una pestaña: se pinta como activo (con transición) mientras esa pestaña está abierta. */
  function quickLinkProps(tab: typeof activeTab) {
    const active = activeTab === tab
    return {
      to: tabLocation(tab),
      'aria-current': active ? ('page' as const) : undefined,
      className: `${active ? linkActiveClass : linkSecondaryClass} transition-colors duration-300 ease-out`,
    }
  }

  function tabLocation(tab: typeof activeTab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    return { search: `?${next}` }
  }

  function handleEntrySaved(entry: HealthEntry | null) {
    setNewEntry(null)
    if (entry === null) return
    setLastCreatedCategory(entry.categoryCode)
    // Recargar el perfil y abrir la categoría del registro recién creado.
    setEntriesVersion((v) => v + 1)
    notify('Registro guardado.')
  }

  if (!isPrincipal && requestedTab === 'access-log') {
    return <Navigate to={tabLocation('entries')} replace />
  }
  if (activeTab === 'entries' && ['category', 'page', 'size'].some((key) => searchParams.has(key))) {
    const search = entriesSearch(parseEntriesParams(searchParams))
    return <Navigate to={`/people/${subjectId}/entries${search ? `?${search}` : ''}`} replace />
  }

  return (
    <>
      <header className="grid gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 min-[360px]:flex-nowrap sm:gap-4">
            <div className="flex min-w-0 max-w-full items-center gap-2 sm:gap-4">
              <AvatarButton onClick={() => setPickingAvatar(true)}>
                <SubjectAvatar subject={subject} size="xl" animated />
              </AvatarButton>
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold wrap-break-word">{subject.name}</h1>
                {age !== null && <p className="mt-2 text-sm text-muted">{age} años</p>}
              </div>
            </div>
            <button type="button" onClick={() => setEditing(true)} className={`ml-auto min-h-11 shrink-0 max-sm:px-3 max-sm:py-2 max-sm:text-sm ${linkSecondaryClass}`}>
              Editar perfil
            </button>
          </div>
          <AvatarPicker
            open={pickingAvatar}
            onClose={() => setPickingAvatar(false)}
            title={`Avatar de ${subject.name}`}
            target={{ type: 'subject', id: subject.id, birthDate: subject.birthDate, gender: subject.gender }}
          />
          {subject.notes ? <p className="mt-2 whitespace-pre-line">{subject.notes}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {activeCaregivers.length > 0 && <p className="text-sm">
              <span className="font-semibold">Cuidadores: </span>
              {activeCaregivers
                .map((r) => (r.relationshipLabel ? `${r.user.name} (${r.relationshipLabel})` : r.user.name))
                .join(', ')}
            </p>}
            <MyCareRoleBadge role={subject.myRole} />
          </div>
        </div>
        <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-2">
          <Link to={`/people/${subjectId}/handoff/new`} className={linkButtonClass}>
            Preparar resumen para el médico
          </Link>
          {isPrincipal ? (
            <Link {...quickLinkProps('access')}>
              Delegar acceso
            </Link>
          ) : null}
          {isPrincipal ? (
            <button type="button" onClick={() => setDeleting(true)} className={linkSecondaryClass.replace('text-ink', 'text-danger')}>
              Eliminar persona
            </button>
          ) : null}
        </nav>
      </header>
      {isPrincipal && <CareAuthorizationStatus subjectId={subjectId} />}
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
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-300 ease-out ${focusRing} ${
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
            <div ref={newEntryRef} className="scroll-mt-6">
              <HealthEntryForm
                key={newEntry.category ?? 'ALL'}
                subjectId={subjectId}
                initialCategory={newEntry.category ?? undefined}
                onCancel={() => setNewEntry(null)}
                onSaved={handleEntrySaved}
              />
            </div>
          )}
          <ClinicalProfile
            key={`profile-${entriesVersion}`}
            subjectId={subjectId}
            initialCategory={lastCreatedCategory}
            onNewEntry={() => setNewEntry({ category: null })}
            onOpenEntry={(entry) => void navigate(`/people/${subjectId}/entries/${entry.id}`)}
            onAddEntry={(category) => setNewEntry({ category })}
          />
        </>
      )}
      {activeTab === 'documents' && <DocumentsPanel subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'voice-notes' && <VoiceNotesPanel key={subjectId} subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'caregivers' && (
        <CaregiversPanel subjectId={subjectId} isPrincipal={isPrincipal} onChanged={caregivers.reload} />
      )}
      {activeTab === 'access' && <DelegationsPanel key={subjectId} subjectName={subject.name} subjectId={subjectId} isPrincipal={isPrincipal} />}
      {activeTab === 'appointments' && <ConsultationsPanel subjectId={subjectId} subjectName={subject.name} isPrincipal={isPrincipal} />}
      {activeTab === 'handoffs' && <HandoffsPanel key={subjectId} subjectId={subjectId} isPrincipal={isPrincipal} userId={userId} />}
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
