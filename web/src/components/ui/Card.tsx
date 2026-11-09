import type { ComponentPropsWithoutRef } from 'react'
import { cx } from './cx'

const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-6 sm:p-8' } as const

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  as?: 'div' | 'section' | 'article'
  padding?: keyof typeof paddings
}

/** Tarjeta blanca redondeada; el elemento HTML se elige con `as`. */
export function Card({ as: Tag = 'div', padding = 'md', className, ...rest }: CardProps) {
  return <Tag className={cx('rounded-3xl bg-card', paddings[padding], className)} {...rest} />
}
