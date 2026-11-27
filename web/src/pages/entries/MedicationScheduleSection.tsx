import { useState, type FormEvent } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Icon } from '../../components/ui/Icon'
import { Skeleton } from '../../components/ui/Skeleton'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { todayIso } from '../../schemas/common'
import { deleteMedicationSchedule, getMedicationSchedule, saveMedicationSchedule } from '../../services/api/medication'
import type { DayOfWeek, MedicationSchedule } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { formatDate, formatTime } from '../../utils/format'
import { describeDays, FREQUENCY_PRESETS, shortTime, WEEK_DAYS } from '../../utils/medicationSchedule'
import { focusRing } from '../../utils/styles'
import { inputClass } from '../forms/fieldProps'
import { ChoiceOption } from '../forms/fields'

const MAX_TIMES = 8

/** Horario del medicamento en su ficha: cuándo se toma, para la agenda del inicio y los avisos del celular. */
export function MedicationScheduleSection({ subjectId, entryId }: { subjectId: number; entryId: number }) {
  const { data, error, loading, reload } = useFetch((signal) => getMedicationSchedule(subjectId, entryId, signal), [subjectId, entryId])
  const [saved, setSaved] = useState<MedicationSchedule | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const toast = useToast()
  const schedule = saved !== undefined ? saved : data

  return (
    <section aria-labelledby="schedule-title" className="grid gap-4 rounded-3xl bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-tint text-primary">
            <Icon name="calendar" />
          </span>
          <h2 id="schedule-title" className="text-xl font-semibold">Horario de tomas</h2>
        </div>
        {schedule && !editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Cambiar horario</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>Quitar</Button>
          </div>
        ) : null}
      </div>

      {error && data === undefined && saved === undefined ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading && schedule === undefined ? (
        <Skeleton lines={2} />
      ) : editing || !schedule ? (
        editing ? (
          <ScheduleForm
            initial={schedule ?? null}
            onCancel={() => setEditing(false)}
            onSubmit={async (request) => {
              const result = await saveMedicationSchedule(subjectId, entryId, request)
              setSaved(result)
              setEditing(false)
              toast.success('Horario guardado. Ya aparece en la agenda del inicio.')
            }}
          />
        ) : (
          <div className="grid justify-items-start gap-3">
            <p className="text-muted">
              Agrega las horas en que se toma, según la receta, para verlo en la agenda del inicio y recibir avisos en el celular.
            </p>
            <Button onClick={() => setEditing(true)}>Agregar horario</Button>
          </div>
        )
      ) : (
        <ScheduleSummary schedule={schedule} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="¿Quitar el horario?"
        message="El medicamento sigue registrado, pero sale de la agenda y se borran las tomas marcadas."
        confirmLabel="Quitar horario"
        workingLabel="Quitando…"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          try {
            await deleteMedicationSchedule(subjectId, entryId)
            setSaved(null)
            toast.success('Horario quitado.')
          } catch (err) {
            toast.error(getErrorMessage(err))
          } finally {
            setConfirmingDelete(false)
          }
        }}
      />
    </section>
  )
}

function ScheduleSummary({ schedule }: { schedule: MedicationSchedule }) {
  return (
    <div className="grid gap-4">
      <ul className="flex flex-wrap gap-2" aria-label="Horas">
        {schedule.times.map((time) => (
          <li key={time} className="rounded-full bg-primary-tint px-4 py-2 font-display font-bold text-primary tabular-nums">
            {formatTime(time)}
          </li>
        ))}
      </ul>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm font-semibold text-muted">Días</dt>
          <dd>{describeDays(schedule.daysOfWeek)}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">Desde</dt>
          <dd>{formatDate(schedule.startDate)}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">Hasta</dt>
          <dd>{schedule.endDate ? formatDate(schedule.endDate) : 'Sin fecha de fin'}</dd>
        </div>
      </dl>
    </div>
  )
}

type Request = Parameters<typeof saveMedicationSchedule>[2]

function presetFor(times: string[]) {
  return FREQUENCY_PRESETS.find((preset) => preset.times.join() === times.join())?.id ?? 'custom'
}

function ScheduleForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: MedicationSchedule | null
  onCancel: () => void
  onSubmit: (request: Request) => Promise<void>
}) {
  const [times, setTimes] = useState<string[]>(initial ? initial.times.map(shortTime) : ['08:00'])
  const [preset, setPreset] = useState<string>(presetFor(times))
  const [someDays, setSomeDays] = useState((initial?.daysOfWeek.length ?? 0) > 0)
  const [days, setDays] = useState<DayOfWeek[]>(initial?.daysOfWeek ?? [])
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  function choosePreset(id: string) {
    setPreset(id)
    const found = FREQUENCY_PRESETS.find((option) => option.id === id)
    if (found) setTimes([...found.times])
  }

  function changeTime(index: number, value: string) {
    const next = times.map((time, i) => (i === index ? value : time))
    setTimes(next)
    setPreset(presetFor(next))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = [...new Set(times.filter(Boolean))].sort()
    if (clean.length === 0) return setProblem('Agrega al menos una hora.')
    if (someDays && days.length === 0) return setProblem('Elige al menos un día, o marca «Todos los días».')
    if (!startDate) return setProblem('Indica desde cuándo se toma.')
    if (endDate && endDate < startDate) return setProblem('La fecha de fin no puede ser anterior a la de inicio.')
    setProblem(null)
    setSending(true)
    try {
      await onSubmit({ times: clean, daysOfWeek: someDays ? days : [], startDate, endDate: endDate || null })
    } catch (error) {
      setProblem(getErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <p className="flex gap-2 rounded-2xl bg-accent-tint p-4 text-sm text-accent-text">
        <Icon name="alert" />
        <span>Copia las horas tal como dice la receta o como te indicó el médico. Yuyay no cambia ni sugiere dosis.</span>
      </p>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">¿Cada cuánto se toma?</legend>
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_PRESETS.map((option) => (
            <ChoiceOption key={option.id} name="frequency" checked={preset === option.id} onChange={() => choosePreset(option.id)}>
              {option.label}
            </ChoiceOption>
          ))}
          <ChoiceOption name="frequency" checked={preset === 'custom'} onChange={() => setPreset('custom')}>
            Otro horario
          </ChoiceOption>
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Horas de cada toma</legend>
        <p className="text-sm text-muted">Puedes cambiar las horas propuestas.</p>
        <ul className="flex flex-wrap gap-3">
          {times.map((time, index) => (
            <li key={index} className="flex items-center gap-1">
              <input
                type="time"
                aria-label={`Toma ${index + 1}`}
                value={time}
                onChange={(event) => changeTime(index, event.target.value)}
                className={`${inputClass(false)} w-44!`}
              />
              {times.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Quitar la toma ${index + 1}`}
                  onClick={() => {
                    const next = times.filter((_, i) => i !== index)
                    setTimes(next)
                    setPreset(presetFor(next))
                  }}
                  className={`control-interactive control-ghost flex h-10 w-10 items-center justify-center rounded-full ${focusRing}`}
                >
                  <Icon name="x" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {times.length < MAX_TIMES ? (
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = [...times, '12:00']
                setTimes(next)
                setPreset(presetFor(next))
              }}
            >
              <Icon name="plus" /> Agregar hora
            </Button>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">¿Qué días?</legend>
        <div className="flex flex-wrap gap-2">
          <ChoiceOption name="days" checked={!someDays} onChange={() => setSomeDays(false)}>Todos los días</ChoiceOption>
          <ChoiceOption name="days" checked={someDays} onChange={() => setSomeDays(true)}>Algunos días</ChoiceOption>
        </div>
        {someDays ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana">
            {WEEK_DAYS.map((day) => {
              const on = days.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={day.long}
                  onClick={() => setDays(on ? days.filter((d) => d !== day.value) : [...days, day.value])}
                  className={`h-11 w-11 rounded-full border font-semibold ${focusRing} ${
                    on ? 'border-primary bg-primary text-white' : 'border-line bg-card'
                  }`}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid content-start gap-1.5">
          <span className="text-sm font-semibold">Desde</span>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass(false)} />
        </label>
        <label className="grid content-start gap-1.5">
          <span className="text-sm font-semibold">Hasta (opcional)</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-describedby="schedule-end-hint"
            className={inputClass(false)}
          />
          <span id="schedule-end-hint" className="text-sm text-muted">Déjalo vacío si es un tratamiento continuo.</span>
        </label>
      </div>

      {problem ? <p role="alert" className="rounded-xl bg-danger-bg p-3 text-danger">{problem}</p> : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={sending}>Cancelar</Button>
        <Button type="submit" loading={sending}>Guardar horario</Button>
      </div>
    </form>
  )
}
