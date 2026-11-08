import type { ComponentPropsWithRef } from 'react'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Spinner } from './Spinner'

const variants = {
  primary: 'bg-primary text-white',
  secondary: 'border border-line bg-card text-ink',
  ghost: 'text-ink hover:bg-primary-tint',
  danger: 'bg-danger text-white',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5',
} as const

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  /** Muestra un spinner, marca aria-busy y deshabilita el botón. */
  loading?: boolean
}

/** Botón con variantes y estado de carga. Por defecto type="button". */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-60',
        variants[variant],
        sizes[size],
        focusRing,
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" decorative /> : null}
      {children}
    </button>
  )
}
