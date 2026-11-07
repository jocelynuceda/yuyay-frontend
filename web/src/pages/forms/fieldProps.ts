import type { FieldError } from 'react-hook-form'
import { focusRing } from '../../utils/styles'

/** Atributos de accesibilidad de un campo según su error. */
export function a11yProps(id: string, error?: FieldError, hint?: string) {
  return {
    id,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: inputClass(!!error),
  }
}

export const inputClass = (invalid: boolean) =>
  `w-full rounded-xl border bg-white px-4 py-2.5 ${invalid ? 'border-danger' : 'border-line'} ${focusRing}`
