import { cx } from './cx'
import { getInitials } from './initials'

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' } as const

export interface AvatarProps {
  name: string
  size?: keyof typeof sizes
  /** Si se indica, el avatar se anuncia con esta etiqueta; si no, es decorativo. */
  label?: string
  className?: string
}

/** Círculo con las iniciales del nombre. */
export function Avatar({ name, size = 'md', label, className }: AvatarProps) {
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary',
        sizes[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}
