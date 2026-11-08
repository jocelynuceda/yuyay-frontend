import { Fragment, useId } from 'react'
import { PAGE_SIZES } from '../../utils/urlParams'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'
import { getPageItems, getRange } from './pageRange'

// Reexportadas aquí para poder importarlas junto al componente (funciones puras, sin estado).
// oxlint-disable-next-line react/only-export-components
export { getPageItems, getRange, type PageItem } from './pageRange'

export interface PaginationProps {
  /** Página actual, empezando en 1. */
  page: number
  totalPages: number
  totalElements: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
  sizes?: readonly number[]
}

const navButton = cx(
  'inline-flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40',
  focusRing,
)

/** Paginación con rango "Mostrando 11–20 de 57", páginas numeradas y selector de tamaño opcional. */
export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onPageChange,
  onSizeChange,
  sizes = PAGE_SIZES,
}: PaginationProps) {
  const sizeId = useId()
  const { from, to } = getRange(page, size, totalElements)
  const sizeOptions = sizes.includes(size) ? sizes : [...sizes, size].sort((a, b) => a - b)

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <p className="text-sm text-muted" aria-live="polite">
        Mostrando {from}–{to} de {totalElements}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="text-sm text-muted">
              Por página
            </label>
            <select
              id={sizeId}
              value={size}
              onChange={(event) => onSizeChange(Number(event.target.value))}
              className={cx('rounded-xl border border-line bg-white px-3 py-2 text-sm', focusRing)}
            >
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="button" className={navButton} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevron-left" className="h-4 w-4" />
          Anterior
        </button>
        {totalPages > 1 ? (
          <ul className="flex items-center gap-1">
            {getPageItems(page, totalPages).map((item, index) => (
              <Fragment key={item === 'ellipsis' ? `ellipsis-${index}` : item}>
                {item === 'ellipsis' ? (
                  <li aria-hidden="true" className="px-1 text-muted">
                    …
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      aria-label={`Página ${item}`}
                      aria-current={item === page ? 'page' : undefined}
                      onClick={() => onPageChange(item)}
                      className={cx(
                        'h-10 min-w-10 rounded-xl px-2 text-sm font-semibold',
                        item === page ? 'bg-primary text-white' : 'border border-line bg-white',
                        focusRing,
                      )}
                    >
                      {item}
                    </button>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        ) : null}
        <button type="button" className={navButton} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Siguiente
          <Icon name="chevron-right" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
