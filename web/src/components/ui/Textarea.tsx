import { useId, type ComponentPropsWithRef } from 'react'
import { cx } from './cx'
import { FieldMessage } from './FieldMessage'
import { controlClass, describeField } from './fieldStyles'

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  label: string
  hint?: string
  error?: string
}

/** Área de texto con etiqueta, ayuda y error. Compatible con register() de react-hook-form. */
export function Textarea({ label, hint, error, id, className, rows = 4, 'aria-describedby': describedBy, ...rest }: TextareaProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describeField(fieldId, hint, error, describedBy)}
        className={controlClass(!!error, cx('resize-y', className))}
        {...rest}
      />
      <FieldMessage id={fieldId} hint={hint} error={error} />
    </div>
  )
}
