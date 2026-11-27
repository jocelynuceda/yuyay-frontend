import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Icon } from '../../components/ui/Icon'
import { Skeleton } from '../../components/ui/Skeleton'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { todayIso } from '../../schemas/common'
import { getMedicationAgenda, markDose, unmarkDose } from '../../services/api/medication'
import type { AgendaDose, DoseStatus } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { formatTime, formatWeekdayDate } from '../../utils/format'
import {
  addDays,
  groupByPartOfDay,
  doseState,
  isTaken,
  type DoseState,
  PART_OF_DAY_LABELS,
  shortTime,
  startOfWeek,
  WEEK_DAYS,
} from '../../utils/medicationSchedule'
import { focusRing, linkClass } from '../../utils/styles'

const doseKey = (dose: Pick<AgendaDose, 'scheduleId' | 'date' | 'time'>) => `${dose.scheduleId}|${dose.date}|${dose.time}`

function nowTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Agenda de tomas en el inicio: la semana arriba con un punto por día que tiene tomas, y debajo la
 * lista del día elegido por mañana, tarde y noche. Cualquier cuidador marca la toma y los demás ven
 * quién lo hizo.
 */
export function TodayAgenda() {
  const today = todayIso()
  const [selected, setSelected] = useState(today)
  const weekStart = startOfWeek(selected)
  const weekEnd = addDays(weekStart, 6)
  const agenda = useFetch((signal) => getMedicationAgenda(weekStart, weekEnd, signal), [weekStart])
  // Cambios ya confirmados por el servidor, para no recargar toda la semana al marcar
  const [changes, setChanges] = useState<Record<string, AgendaDose>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  // Filtro por persona: «Yo» son mis propias tomas; el resto, las de quienes cuido
  const [chosen, setWho] = useState<Who>('all')

  const allDoses = (agenda.data ?? []).map((dose) => changes[doseKey(dose)] ?? dose)
  const people = peopleIn(allDoses)
  // Si en esta semana la persona elegida no tiene tomas, se muestran todas
  const who = people.some((person) => person.id === chosen) ? chosen : 'all'
  const doses = allDoses.filter((dose) => matches(dose, who))
  const ofDay = doses.filter((dose) => dose.date === selected)
  const taken = ofDay.filter(isTaken).length
  const now = nowTime()

  async function setStatus(dose: AgendaDose, status: DoseStatus | null) {
    const key = doseKey(dose)
    setBusy(key)
    try {
      const updated = status
        ? await markDose(dose.scheduleId, { date: dose.date, time: shortTime(dose.time), status })
        : (await unmarkDose(dose.scheduleId, dose.date, shortTime(dose.time)),
          { ...dose, status: null, markedByName: null, markedAt: null })
      setChanges((current) => ({ ...current, [key]: { ...updated, time: dose.time } }))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card as="section" aria-labelledby="agenda-title" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="agenda-title" className="text-xl font-semibold">Medicamentos</h2>
          <p className="text-muted first-letter:uppercase">
            {selected === today ? 'Hoy, ' : ''}
            {formatWeekdayDate(selected)}
          </p>
        </div>
        {ofDay.length > 0 ? (
          <p className="text-sm font-semibold text-muted" aria-live="polite">
            {taken} de {ofDay.length} {ofDay.length === 1 ? 'tomada' : 'tomadas'}
          </p>
        ) : null}
      </div>

      {people.length > 1 ? (
        <div role="group" aria-label="De quién son las tomas" className="flex flex-wrap gap-2">
          {[{ id: 'all' as Who, label: 'Todas' }, ...people].map((option) => (
            <button
              key={String(option.id)}
              type="button"
              aria-pressed={who === option.id}
              onClick={() => setWho(option.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${focusRing} ${
                who === option.id ? 'border-primary bg-primary text-white' : 'border-line hover:bg-primary-tint'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <WeekStrip
        weekStart={weekStart}
        selected={selected}
        today={today}
        doses={doses}
        onSelect={setSelected}
      />

      <p className="text-sm text-muted">
        Puedes marcar cada toma desde 2 horas antes hasta 30 minutos después de su hora. Si nadie la marca, queda como no tomada.
      </p>

      {agenda.error && !agenda.data ? (
        <LoadError message={agenda.error} onRetry={agenda.reload} />
      ) : !agenda.data ? (
        <Skeleton lines={3} />
      ) : ofDay.length === 0 ? (
        <div className="grid justify-items-start gap-2 rounded-2xl bg-surface p-5">
          <p className="font-semibold">
            {who === 'all' ? 'No hay tomas para este día.' : `No hay tomas de ${who === 'me' ? 'ti' : people.find((p) => p.id === who)?.label ?? 'esta persona'} este día.`}
          </p>
          <p className="text-muted">
            {allDoses.length === 0
              ? 'Para verlas aquí, abre un medicamento en la ficha de una persona y agrega su horario.'
              : 'Elige otro día de la semana para ver sus tomas.'}
          </p>
          {allDoses.length === 0 ? <Link to="/people" className={linkClass}>Ir a personas</Link> : null}
        </div>
      ) : (
        <div className="grid gap-5">
          {groupByPartOfDay(ofDay).map(({ part, doses: group }) => (
            <section key={part} aria-label={PART_OF_DAY_LABELS[part]} className="grid gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{PART_OF_DAY_LABELS[part]}</h3>
              <ul className="grid gap-2">
                {group.map((dose) => (
                  <DoseRow
                    key={doseKey(dose)}
                    dose={dose}
                    state={doseState(dose, today, now)}
                    busy={busy === doseKey(dose)}
                    onStatus={(status) => void setStatus(dose, status)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}

type Who = 'all' | 'me' | number

const matches = (dose: AgendaDose, who: Who) =>
  who === 'all' || (who === 'me' ? dose.mine : !dose.mine && dose.careSubjectId === who)

/** «Yo» primero (si tengo tomas propias) y luego cada persona que cuido, por nombre. */
function peopleIn(doses: AgendaDose[]): { id: Who; label: string }[] {
  const others = new Map<number, string>()
  for (const dose of doses) if (!dose.mine) others.set(dose.careSubjectId, dose.careSubjectName)
  return [
    ...(doses.some((dose) => dose.mine) ? [{ id: 'me' as Who, label: 'Yo' }] : []),
    ...[...others].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, label]) => ({ id: id as Who, label })),
  ]
}

function WeekStrip({
  weekStart,
  selected,
  today,
  doses,
  onSelect,
}: {
  weekStart: string
  selected: string
  today: string
  doses: AgendaDose[]
  onSelect: (date: string) => void
}) {
  const arrow = `control-interactive control-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${focusRing}`
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <button type="button" className={arrow} aria-label="Semana anterior" onClick={() => onSelect(addDays(weekStart, -7))}>
        <span aria-hidden="true">‹</span>
      </button>
      <ol className="grid flex-1 grid-cols-7 gap-1">
        {WEEK_DAYS.map((day, index) => {
          const date = addDays(weekStart, index)
          const ofDay = doses.filter((dose) => dose.date === date)
          const done = ofDay.length > 0 && ofDay.every(isTaken)
          const isSelected = date === selected
          const label = `${day.long} ${Number(date.slice(8))}${date === today ? ', hoy' : ''}: ${
            ofDay.length === 0 ? 'sin tomas' : done ? 'todas las tomas marcadas' : `${ofDay.length} tomas`
          }`
          return (
            <li key={date}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={label}
                onClick={() => onSelect(date)}
                className={`grid w-full justify-items-center gap-0.5 rounded-2xl py-2 text-sm transition-colors ${focusRing} ${
                  isSelected ? 'bg-primary text-white' : 'hover:bg-primary-tint'
                }`}
              >
                <span className={isSelected ? 'text-white/80' : 'text-muted'}>{day.short}</span>
                <span className={`font-display text-lg font-bold ${date === today && !isSelected ? 'text-primary' : ''}`}>
                  {Number(date.slice(8))}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    ofDay.length === 0 ? 'bg-transparent' : done ? (isSelected ? 'bg-white' : 'bg-accent') : isSelected ? 'bg-white' : 'bg-primary'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className={arrow} aria-label="Semana siguiente" onClick={() => onSelect(addDays(weekStart, 7))}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}

const STATUS_LABELS: Record<DoseStatus, string> = { TAKEN: 'Tomada', LATE: 'Tomada tarde', SKIPPED: 'No tomada' }

function DoseRow({
  dose,
  state,
  busy,
  onStatus,
}: {
  dose: AgendaDose
  state: DoseState
  busy: boolean
  onStatus: (status: DoseStatus | null) => void
}) {
  const time = formatTime(dose.time)
  const what = `${dose.medication} de las ${time}`
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line p-3 sm:p-4">
      <span className="shrink-0 font-display font-bold tabular-nums sm:w-20">{time}</span>
      <span
        aria-hidden="true"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary sm:flex"
      >
        {dose.mine ? 'Yo' : dose.careSubjectName.trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold wrap-break-word">
          {dose.medication}
          {dose.dose ? <span className="font-normal text-muted"> · {dose.dose}</span> : null}
        </p>
        <p className="text-sm text-muted">
          <Link to={`/people/${dose.careSubjectId}/entries/${dose.healthEntryId}`} className="underline-offset-2 hover:underline">
            {dose.mine ? 'Para mí' : `Para ${dose.careSubjectName}`}
          </Link>
          {state === 'due' ? <span className="font-semibold text-primary"> · Es hora</span> : null}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {state === 'marked' ? (
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                dose.status === 'SKIPPED' ? 'bg-danger-bg text-danger' : 'bg-accent-tint text-accent-text'
              }`}
            >
              {dose.status === 'SKIPPED' ? null : <Icon name="check" />}
              {STATUS_LABELS[dose.status ?? 'TAKEN']}
              {dose.markedByName ? <span className="font-normal"> · {dose.markedByName.split(/\s+/)[0]}</span> : null}
            </span>
            <Button size="sm" variant="ghost" loading={busy} onClick={() => onStatus(null)} aria-label={`Deshacer la marca de ${what}`}>
              Deshacer
            </Button>
          </>
        ) : state === 'upcoming' ? (
          <span className="text-sm text-muted">Aún no es hora</span>
        ) : state === 'missed' ? (
          <>
            {/* Pasaron más de 30 min sin marcar: cuenta como no tomada. Si sí se dio, se marca «tarde» */}
            <span className="rounded-full bg-danger-bg px-3 py-1 text-sm font-semibold text-danger">No tomada</span>
            <Button size="sm" variant="secondary" loading={busy} onClick={() => onStatus('LATE')} aria-label={`Marcar que ${what} se tomó tarde`}>
              Se tomó tarde
            </Button>
          </>
        ) : (
          <Button size="sm" loading={busy} onClick={() => onStatus('TAKEN')} aria-label={`Marcar ${what} como tomada`}>
            Tomada
          </Button>
        )}
      </div>
    </li>
  )
}
