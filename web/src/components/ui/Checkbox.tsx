import { useId, type ComponentPropsWithRef } from 'react'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { FieldMessage } from './FieldMessage'
import { describeField } from './fieldStyles'

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  label: string
  hint?: string
  error?: string
}

/** Casilla de verificación con etiqueta, ayuda y error. Compatible con register() de react-hook-form. */
export function Checkbox({ label, hint, error, id, className, 'aria-describedby': describedBy, ...rest }: CheckboxProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="grid gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describeField(fieldId, hint, error, describedBy)}
          className={cx('mt-0.5 h-5 w-5 shrink-0 rounded accent-primary disabled:opacity-60', focusRing, className)}
          {...rest}
        />
        <label htmlFor={fieldId} className="font-medium">
          {label}
        </label>
      </div>
      <FieldMessage id={fieldId} hint={hint} error={error} />
    </div>
  )
}
