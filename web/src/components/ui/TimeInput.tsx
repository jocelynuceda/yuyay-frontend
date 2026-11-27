import { useState } from 'react'
import { fromTime, toTime, type Period } from '../../utils/time12'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'

export interface TimeInputProps {
  id: string
  /** 'HH:MM' en 24 horas, o '' si no hay hora. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  className?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Hora escrita a mano con AM/PM. El campo nativo de Safari muestra una hora tenue aunque esté vacío. */
export function TimeInput({ value, onChange, onBlur, className, ...input }: TimeInputProps) {
  const [{ text, period }, setState] = useState(() => fromTime(value))

  function update(nextText: string, nextPeriod: Period) {
    setState({ text: nextText, period: nextPeriod })
    onChange(toTime(nextText, nextPeriod))
  }

  return (
    <div className="flex gap-2">
      <input
        {...input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={5}
        placeholder="Sin hora"
        value={text}
        onChange={(event) => update(event.target.value, period)}
        onBlur={() => {
          // Al salir se ordena lo escrito: "930" pasa a "9:30"
          const time = toTime(text, period)
          if (time && !time.startsWith('?')) setState(fromTime(time))
          onBlur?.()
        }}
        className={cx(className, 'min-w-0 flex-1')}
      />
      <div role="group" aria-label="AM o PM" className="flex shrink-0 overflow-hidden rounded-xl border border-line">
        {(['AM', 'PM'] as const).map((option) => (
          <button key={option} type="button" aria-pressed={period === option} onClick={() => update(text, option)}
            className={cx('px-3 text-sm font-semibold', period === option ? 'bg-primary text-white' : 'bg-card', focusRing)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
