import { useId, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import type { Consultation } from '../../types'
import { APPOINTMENT_MINUTES, googleCalendarUrl } from '../../utils/calendar'
import { formatDate } from '../../utils/format'
import { focusRing } from '../../utils/styles'

const actionClass = `inline-flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-primary ${focusRing}`

export function AddToCalendar({ consultation, subjectName }: { consultation: Consultation; subjectName: string }) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('09:00')
  const helpId = useId()
  const label = 'Agregar a Google Calendar'

  function openCalendar(chosenTime: string | null) {
    window.open(googleCalendarUrl({ ...consultation, time: chosenTime }, subjectName), '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  if (consultation.time) {
    return (
      <a href={googleCalendarUrl(consultation, subjectName)} target="_blank" rel="noopener noreferrer" className={actionClass}>
        <Icon name="calendar" className="size-4" />
        {label}
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={actionClass}
        onClick={() => {
          setTime('09:00')
          setOpen(true)
        }}
      >
        <Icon name="calendar" className="size-4" />
        {label}
      </button>
      {open ? (
        <Modal open onClose={() => setOpen(false)} title="¿A qué hora es la cita?" describedBy={helpId}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (time) openCalendar(time)
            }}
          >
            <p id={helpId} className="text-sm text-muted">
              {consultation.reason} · {formatDate(consultation.date)}. La cita durará {APPOINTMENT_MINUTES} minutos y puedes ajustarla en Google Calendar.
            </p>
            <Input type="time" label="Hora" required value={time} onChange={(event) => setTime(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Abrir Google Calendar</Button>
              <Button variant="secondary" onClick={() => openCalendar(null)}>Todo el día</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  )
}
