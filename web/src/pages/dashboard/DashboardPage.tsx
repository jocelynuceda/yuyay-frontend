import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Card } from '../../components/ui/Card'
import { Icon, type IconName } from '../../components/ui/Icon'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { todayIso } from '../../schemas/common'
import { listCareSubjects } from '../../services/api/careSubjects'
import { listMyPendingInvitations } from '../../services/api/caregivers'
import { listConsultations } from '../../services/api/consultations'
import type { CareSubject, Consultation } from '../../types'
import {
  careRoleLabels,
  consultationOrder,
  daysUntil,
  describeDaysUntil,
  formatTime,
  formatWeekdayDate,
} from '../../utils/format'
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
      if (consultation.date >= today && (next === null || consultationOrder(consultation) < consultationOrder(next.consultation))) {
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

/** Tarjeta con el icono en un círculo que sobresale por arriba. */
function StatCard({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <Card as="section" className={`${cardAnimation} relative mt-8 grid content-start justify-items-center gap-2 pt-12 text-center`}>
      <span
        aria-hidden="true"
        className="absolute -top-8 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-3xl bg-primary text-white shadow-[var(--shadow-soft)] [&_svg]:h-7 [&_svg]:w-7"
      >
        <Icon name={icon} />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </Card>
  )
}

function CardSkeleton() {
  return (
    <div className="grid w-full justify-items-center gap-3">
      <Skeleton className="h-9 w-20" />
      <Skeleton lines={2} />
    </div>
  )
}

function BigNumber({ value }: { value: number }) {
  return <p className="font-display text-4xl font-bold">{value}</p>
}

const heroPill = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white'

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
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6">
      {anyLoading ? (
        <p role="status" className="sr-only">
          Cargando resumen…
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <header
          className={`${cardAnimation} relative overflow-hidden rounded-[2rem] bg-linear-to-br from-primary to-soft-text p-6 text-white shadow-[var(--shadow-soft)] sm:p-8 lg:col-span-2`}
        >
          <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 w-full text-white/10">
            <path fill="currentColor" d="M0 80C40 40 70 40 100 70s60 40 100 0 60-50 100-10 70 30 100 0V120H0Z" />
          </svg>
          <p className="relative text-sm font-medium text-white/75">Resumen de hoy</p>
          <h1 className="relative mt-1 font-display text-3xl font-bold wrap-break-word sm:text-4xl">
            {firstName ? `Hola, ${firstName}` : 'Hola'}
          </h1>
          <p className="relative mt-1 max-w-xl text-white/80">Este es el resumen de lo que importa hoy.</p>
          <ul className="relative mt-8 flex flex-wrap gap-2">
            {quickLinks.map(({ to, label, icon }, index) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`${heroPill} ${index === 0 ? 'bg-card text-primary' : 'bg-white/15 text-white hover:bg-white/25'}`}
                >
                  <Icon name={icon} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </header>

        <section
          className={`${cardAnimation} grid content-start gap-3 rounded-[2rem] bg-accent p-6 text-on-accent shadow-[var(--shadow-soft)] sm:p-8`}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/35">
              <Icon name="calendar" />
            </span>
            <h2 className="text-xl font-semibold">Próxima cita</h2>
          </div>
          {people.error && !people.data ? (
            <LoadError message={people.error} onRetry={people.reload} />
          ) : !people.data ? (
            <CardSkeleton />
          ) : next ? (
            <div className="mt-2 grid gap-1">
              <p className="font-display text-2xl font-bold first-letter:uppercase">
                {formatWeekdayDate(next.consultation.date)}
                {next.consultation.time ? ` · ${formatTime(next.consultation.time)}` : ''}
              </p>
              <p className="font-medium opacity-80">
                {describeDaysUntil(daysUntil(next.consultation.date))} · {next.subject.name}
              </p>
              <p>{next.consultation.reason}</p>
              <Link
                to={`/personas/${next.subject.id}?tab=consultas`}
                className={`${heroPill} mt-3 justify-self-start bg-on-accent text-accent hover:opacity-90`}
              >
                Ver consultas de {next.subject.name}
              </Link>
            </div>
          ) : (
            <div className="mt-2 grid justify-items-start gap-3">
              <p className="opacity-85">
                {people.data.subjects.length === 0
                  ? 'Cuando agregues a una persona, aquí verás su próxima consulta.'
                  : 'No hay consultas programadas. Registra la próxima desde la ficha de una persona.'}
              </p>
              <Link to="/personas" className={`${heroPill} bg-on-accent text-accent hover:opacity-90`}>
                {people.data.subjects.length === 0 ? 'Agregar persona' : 'Ir a personas'}
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Personas" icon="users">
          {people.error && !people.data ? (
            <LoadError message={people.error} onRetry={people.reload} />
          ) : !people.data ? (
            <CardSkeleton />
          ) : (
            <>
              <BigNumber value={people.data.subjects.length} />
              <Link to="/personas" className={linkClass}>
                {people.data.subjects.length === 0 ? 'Agregar persona' : 'Ver personas'}
              </Link>
            </>
          )}
        </StatCard>

        <StatCard title="Avisos sin leer" icon="bell">
          <BigNumber value={unread.count} />
          <Link to="/avisos" className={linkClass}>
            {unread.count === 0 ? 'Ver avisos' : 'Leer avisos'}
          </Link>
        </StatCard>

        <StatCard title="Invitaciones pendientes" icon="mail">
          {invitations.error && !invitations.data ? (
            <LoadError message={invitations.error} onRetry={invitations.reload} />
          ) : !invitations.data ? (
            <CardSkeleton />
          ) : pending.length === 0 ? (
            <>
              <BigNumber value={0} />
              <p className="text-muted">No tienes invitaciones pendientes.</p>
            </>
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
        </StatCard>
      </div>
    </main>
  )
}
