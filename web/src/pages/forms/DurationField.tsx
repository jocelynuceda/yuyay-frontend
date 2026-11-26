import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Icon } from '../../components/ui/Icon'
import { durationUnitLabels, durationUnits } from '../../utils/accessDurations'
import { a11yProps } from './fieldProps'

export function DurationField({ id, label, hint, error, amountField, unitField, disabled }: {
  id: string
  label: string
  hint?: string
  error?: FieldError
  amountField: UseFormRegisterReturn
  unitField: UseFormRegisterReturn
  disabled?: boolean
}) {
  const { className, ...amountProps } = a11yProps(id, error, hint)
  return (
    <div className="@container grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 @min-[421px]:grid-cols-[7rem_9.5rem_minmax(0,1fr)]">
        <input type="text" inputMode="numeric" disabled={disabled} className={className} {...amountProps} {...amountField} />
        <select
          aria-label={`Unidad de ${label.toLowerCase()}`}
          aria-describedby={amountProps['aria-describedby']}
          className={className}
          disabled={disabled}
          {...unitField}
        >
          {durationUnits.map((unit) => <option key={unit} value={unit}>{durationUnitLabels[unit]}</option>)}
        </select>
        <div aria-live="polite" className="col-span-full @min-[421px]:col-span-1 empty:hidden">
          {error?.message ? (
            <p id={`${id}-error`} className="flex items-start gap-1.5 wrap-anywhere text-sm text-danger @min-[421px]:pt-2.5">
              <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
              {error.message}
            </p>
          ) : null}
        </div>
      </div>
      {hint ? <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  )
}
