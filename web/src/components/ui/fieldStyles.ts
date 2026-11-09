import { focusRing } from '../../utils/styles'
import { cx } from './cx'

/** Clases comunes de Input, Textarea y Select. */
export const controlClass = (invalid: boolean, extra?: string) =>
  cx(
    'w-full rounded-2xl border bg-card px-4 py-2.5 placeholder:text-placeholder disabled:opacity-60',
    invalid ? 'border-danger' : 'border-line',
    focusRing,
    extra,
  )

/** Ids y aria-describedby de un campo con ayuda o error. */
export function describeField(id: string, hint: string | undefined, error: string | undefined, extra?: string) {
  const ids = [extra, error ? `${id}-error` : hint ? `${id}-hint` : undefined].filter(Boolean).join(' ')
  return ids || undefined
}
