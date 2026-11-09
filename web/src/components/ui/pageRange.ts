export type PageItem = number | 'ellipsis'

/**
 * Páginas a mostrar: siempre la primera, la última y la actual ±1.
 * Un hueco de una sola página se muestra como número; los demás, como 'ellipsis'.
 */
export function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages < 1) return []
  const current = Math.min(Math.max(page, 1), totalPages)
  const wanted = new Set([1, totalPages, current - 1, current, current + 1])
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const items: PageItem[] = []
  pages.forEach((p, i) => {
    const prev = pages[i - 1]
    if (prev !== undefined) {
      if (p - prev === 2) items.push(prev + 1)
      else if (p - prev > 2) items.push('ellipsis')
    }
    items.push(p)
  })
  return items
}

/** Rango 1-based de elementos mostrados en la página; from = 0 si no hay elementos. */
export function getRange(page: number, size: number, totalElements: number): { from: number; to: number } {
  if (totalElements <= 0 || size <= 0) return { from: 0, to: 0 }
  const to = Math.min(Math.max(page, 1) * size, totalElements)
  const from = Math.min((Math.max(page, 1) - 1) * size + 1, to)
  return { from, to }
}
