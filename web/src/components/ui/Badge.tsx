import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './cx'

const tones = {
  neutral: 'bg-border text-muted',
  primary: 'bg-primary-tint text-primary',
  accent: 'bg-accent-tint text-accent-text',
  danger: 'bg-danger-bg text-danger',
  soft: 'bg-soft text-soft-text',
} as const

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: keyof typeof tones
}

/** Etiqueta pequeña de estado o categoría. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}
      {...rest}
    />
  )
}
