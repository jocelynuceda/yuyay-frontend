import type { ReactNode } from 'react'
import { cx } from './cx'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Mensaje cuando no hay datos, con icono, descripción y acción opcionales. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('grid justify-items-center gap-3 rounded-3xl bg-card p-8 text-center', className)}>
      {icon ? (
        <div aria-hidden="true" className="text-primary">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
