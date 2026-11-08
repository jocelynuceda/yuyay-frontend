import { cx } from './cx'

const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' } as const

export interface SpinnerProps {
  size?: keyof typeof sizes
  /** Decorativo: sin role ni texto (por ejemplo dentro de un botón que ya anuncia su estado). */
  decorative?: boolean
  className?: string
}

/** Indicador de carga; anuncia "Cargando…" a lectores de pantalla salvo que sea decorativo. */
export function Spinner({ size = 'md', decorative = false, className }: SpinnerProps) {
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'status' })}
      className={cx('inline-flex', className)}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={cx('motion-safe:animate-spin', sizes[size])}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {decorative ? null : <span className="sr-only">Cargando…</span>}
    </span>
  )
}
