import { useId, type ComponentPropsWithRef } from 'react'
import { cx } from './cx'
import { FieldMessage } from './FieldMessage'
import { controlClass, describeField } from './fieldStyles'

export interface InputProps extends ComponentPropsWithRef<'input'> {
  label: string
  hint?: string
  error?: string
}

/** Campo de texto con etiqueta, ayuda y error. Compatible con register() de react-hook-form (ref como prop). */
export function Input({ label, hint, error, id, className, 'aria-describedby': describedBy, ...rest }: InputProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describeField(fieldId, hint, error, describedBy)}
        className={controlClass(!!error, cx(className))}
        {...rest}
      />
      <FieldMessage id={fieldId} hint={hint} error={error} />
    </div>
  )
}
