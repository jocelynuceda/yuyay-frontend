import { Link } from 'react-router-dom'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'

export interface BreadcrumbItem {
  label: string
  to?: string
}

/** Ruta de navegación; el último elemento es la página actual y no es un enlace. */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Ruta de navegación" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`} className="flex items-center gap-1.5">
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined} className={cx(isLast && 'font-semibold text-ink')}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className={cx('rounded underline-offset-2 hover:underline', focusRing)}>
                  {item.label}
                </Link>
              )}
              {isLast ? null : <Icon name="chevron-right" className="h-4 w-4" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
