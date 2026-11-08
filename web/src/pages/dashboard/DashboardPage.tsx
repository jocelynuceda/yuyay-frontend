import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Card } from '../../components/ui/Card'
import { Icon, type IconName } from '../../components/ui/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { todayIso } from '../../schemas/common'
import { listCareSubjects } from '../../services/api/careSubjects'
import { listMyPendingInvitations } from '../../services/api/caregivers'
import { listConsultations } from '../../services/api/consultations'
import type { CareSubject, Consultation } from '../../types'
import { careRoleLabels, daysUntil, describeDaysUntil, formatWeekdayDate } from '../../utils/format'
import { linkClass } from '../../utils/styles'

interface NextAppointment {
  subject: CareSubject
  consultation: Consultation
}

interface PeopleSummary {
  subjects: CareSubject[]
  next: NextAppointment | null
}

async function loadPeopleSummary(signal: AbortSignal): Promise<PeopleSummary> {
  const subjects = await listCareSubjects(signal)
  const lists = await Promise.all(subjects.map((subject) => listConsultations(subject.id, signal)))
  const today = todayIso()
  let next: NextAppointment | null = null
  for (const [index, subject] of subjects.entries()) {
    for (const consultation of lists[index] ?? []) {
      if (consultation.date >= today && (next === null || consultation.date < next.consultation.date)) {
        next = { subject, consultation }
      }
    }
  }
  return { subjects, next }
}

const quickLinks: { to: string; label: string; icon: IconName }[] = [
  { to: '/personas', label: 'Agregar persona', icon: 'plus' },
  { to: '/avisos', label: 'Ver avisos', icon: 'bell' },
  { to: '/perfil', label: 'Mi perfil', icon: 'user' },
]

const cardAnimation = 'motion-safe:animate-[fade-in-up_0.4s_ease-out_both]'

function DashCard({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card as="section" className={`${cardAnimation} grid content-start gap-3 ${className ?? ''}`}>
      <h2 className="font-sans text-sm font-semibold text-muted">{title}</h2>
      {children}
    </Card>
  )
}

function CardSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-9 w-20" />
      <Skeleton lines={2} />
    </div>
  )
}

function BigNumber({ value }: { value: number }) {
  return <p className="font-display text-4xl font-bold">{value}</p>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const unread = useUnreadCount()
  const people = useFetch(loadPeopleSummary, [])
  const invitations = useFetch((signal) => listMyPendingInvitations(signal), [])

  const firstName = user?.name.trim().split(/\s+/)[0] ?? ''
  const anyLoading = (people.loading && !people.data) || (invitations.loading && !invitations.data)
  const pending = invitations.data ?? []
  const next = people.data?.next ?? null

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <PageHeader title={firstName ? `Hola, ${firstName}` : 'Hola'} description="Este es el resumen de lo que importa hoy." />
      {anyLoading ? (
        <p role="status" className="sr-only">
          Cargando resumen…
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashCard title="Próxima cita" className="sm:col-span-2">
          {people.error && !people.data ? (
            <LoadError message={people.error} onRetry={people.reload} />
          ) : !people.data ? (
            <CardSkeleton />
          ) : next ? (
            <div className="grid gap-1">
              <p className="font-display text-2xl font-bold first-letter:uppercase">
                {formatWeekdayDate(next.consultation.date)}
              </p>
              <p className="text-muted">
                {describeDaysUntil(daysUntil(next.consultation.date))} · {next.subject.name}
              </p>
              <p>{next.consultation.reason}</p>
              <Link to={`/personas/${next.subject.id}?tab=consultas`} className={`${linkClass} mt-2 justify-self-start`}>
                Ver consultas de {next.subject.name}
              </Link>
            </div>
          ) : (
            <div className="grid justify-items-start gap-2">
              <p className="text-muted">
                {people.data.subjects.length === 0
                  ? 'Cuando agregues a una persona, aquí verás su próxima consulta.'
                  : 'No hay consultas programadas. Registra la próxima desde la ficha de una persona.'}
              </p>
              <Link to="/personas" className={linkClass}>
                {people.data.subjects.length === 0 ? 'Agregar persona' : 'Ir a personas'}
              </Link>
            </div>
          )}
        </DashCard>

        <DashCard title="Personas">
          {people.error && !people.data ? (
            <LoadError message={people.error} onRetry={people.reload} />
          ) : !people.data ? (
            <CardSkeleton />
          ) : (
            <>
              <BigNumber value={people.data.subjects.length} />
              <Link to="/personas" className={`${linkClass} justify-self-start`}>
                {people.data.subjects.length === 0 ? 'Agregar persona' : 'Ver personas'}
              </Link>
            </>
          )}
        </DashCard>

        <DashCard title="Avisos sin leer">
          <BigNumber value={unread.count} />
          <Link to="/avisos" className={`${linkClass} justify-self-start`}>
            {unread.count === 0 ? 'Ver avisos' : 'Leer avisos'}
          </Link>
        </DashCard>

        <DashCard title="Invitaciones pendientes">
          {invitations.error && !invitations.data ? (
            <LoadError message={invitations.error} onRetry={invitations.reload} />
          ) : !invitations.data ? (
            <CardSkeleton />
          ) : pending.length === 0 ? (
            <p className="text-muted">No tienes invitaciones pendientes.</p>
          ) : (
            <>
              <BigNumber value={pending.length} />
              <ul className="grid gap-1">
                {pending.slice(0, 3).map((invitation) => (
                  <li key={invitation.id}>
                    <Link to={`/invitaciones/${invitation.id}`} className={linkClass}>
                      {invitation.careSubjectName}
                    </Link>
                    <span className="text-sm text-muted"> · {careRoleLabels[invitation.role] ?? invitation.role}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashCard>

        <DashCard title="Accesos rápidos">
          <ul className="grid gap-1">
            {quickLinks.map(({ to, label, icon }) => (
              <li key={to}>
                <Link to={to} className={`${linkClass} inline-flex items-center gap-2 no-underline hover:underline`}>
                  <Icon name={icon} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </DashCard>
      </div>
    </main>
  )
}
