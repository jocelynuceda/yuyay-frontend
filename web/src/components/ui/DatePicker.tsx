import { useEffect, useRef, useState } from 'react'
import { todayIso } from '../../schemas/common'
import { formatDate } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const pad = (value: number) => String(value).padStart(2, '0')
const toIso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`

export interface DatePickerProps {
  id: string
  /** 'YYYY-MM-DD', o '' si no hay fecha. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min: string
  max: string
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Calendario propio en español. Flota sobre el formulario, sin mover los demás campos. */
export function DatePicker({ id, value, onChange, onBlur, min, max, className, ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ year: 0, month: 0 })
  const root = useRef<HTMLDivElement>(null)

  // Un clic fuera lo cierra. No sirve onBlur: Safari no enfoca los botones al hacer clic
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function toggle() {
    if (!open) {
      const [year, month] = (value || (todayIso() < max ? todayIso() : max)).split('-').map(Number)
      setView({ year, month: month - 1 })
    }
    setOpen(!open)
  }

  function choose(next: string) {
    onChange(next)
    onBlur?.()
    setOpen(false)
    document.getElementById(id)?.focus()
  }

  function shift(step: number) {
    const next = new Date(view.year, view.month + step, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  const { year, month } = view
  const [minYear, maxYear] = [Number(min.slice(0, 4)), Number(max.slice(0, 4))]
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index)
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1)
  const arrow = `grid h-9 w-9 place-items-center rounded-full hover:bg-primary-tint disabled:opacity-30 ${focusRing}`
  const selectClass = `rounded-xl border border-line bg-card px-2 py-1.5 text-sm font-semibold ${focusRing}`

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        // Escape cierra solo el calendario, no el modal que lo contiene
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        document.getElementById(id)?.focus()
      }}
    >
      <button type="button" id={id} value={value} aria-expanded={open} onClick={toggle} className={cx(className, 'flex items-center justify-between gap-2 text-left')} {...aria}>
        <span className={value ? undefined : 'text-placeholder'}>{value ? formatDate(value) : 'Elige una fecha'}</span>
        <Icon name="calendar" className="h-5 w-5 text-muted" />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-30 mt-2 grid w-80 max-w-full gap-3 rounded-2xl border border-line bg-card p-3 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-1">
            <button type="button" aria-label="Mes anterior" className={arrow} disabled={toIso(year, month, 1) <= min} onClick={() => shift(-1)}>
              <Icon name="chevron-left" />
            </button>
            <select aria-label="Mes" className={selectClass} value={month} onChange={(event) => setView({ year, month: Number(event.target.value) })}>
              {MONTHS.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </select>
            <select aria-label="Año" className={selectClass} value={year} onChange={(event) => setView({ year: Number(event.target.value), month })}>
              {years.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <button type="button" aria-label="Mes siguiente" className={arrow} disabled={toIso(year, month, days.length) >= max} onClick={() => shift(1)}>
              <Icon name="chevron-right" />
            </button>
          </div>
          <div className="grid grid-cols-7 justify-items-center gap-y-1">
            {WEEKDAYS.map((name) => <span key={name} aria-hidden="true" className="text-xs font-semibold text-muted">{name}</span>)}
            {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
            {days.map((day) => {
              const iso = toIso(year, month, day)
              const selected = iso === value
              return (
                <button key={iso} type="button" aria-label={formatDate(iso)} aria-pressed={selected} disabled={iso < min || iso > max} onClick={() => choose(iso)}
                  className={cx('h-9 w-9 rounded-full text-sm disabled:opacity-30', selected ? 'bg-primary font-semibold text-white' : 'enabled:hover:bg-primary-tint', focusRing)}>
                  {day}
                </button>
              )
            })}
          </div>
          {value ? (
            <button type="button" onClick={() => choose('')} className={`justify-self-end rounded-xl px-2 py-1 text-sm font-semibold text-primary-fg hover:underline ${focusRing}`}>
              Borrar fecha
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
