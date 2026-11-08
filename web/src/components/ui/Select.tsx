import { useId, type ComponentPropsWithRef } from 'react'
import { cx } from './cx'
import { FieldMessage } from './FieldMessage'
import { controlClass, describeField } from './fieldStyles'

export interface SelectProps extends ComponentPropsWithRef<'select'> {
  label: string
  hint?: string
  error?: string
}

/** Lista desplegable nativa con etiqueta, ayuda y error. Las opciones van como children. */
export function Select({ label, hint, error, id, className, children, 'aria-describedby': describedBy, ...rest }: SelectProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describeField(fieldId, hint, error, describedBy)}
        className={controlClass(!!error, cx(className))}
        {...rest}
      >
        {children}
      </select>
      <FieldMessage id={fieldId} hint={hint} error={error} />
    </div>
  )
}
