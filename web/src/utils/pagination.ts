import type { Page } from '../types'

const MAX_PAGES = 50

/** Junta todas las páginas de un listado paginado (páginas de hasta 100, el máximo del backend). */
export async function collectPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchPage(page)
    items.push(...result.content)
    if (result.number + 1 >= result.totalPages) return items
  }
  throw new Error('Hay demasiados registros para cargarlos todos. Filtra por categoría.')
}
