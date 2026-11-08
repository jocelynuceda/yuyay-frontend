import { CATEGORY_CODES, type CategoryCode } from '../types'

// Filtros que viven en la URL. La página los lee con el router (useSearchParams) y los pasa
// a los componentes; cuando cambian, los vuelve a escribir con `toSearch`.

const clean = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>

/** Convierte parámetros a query string sin los valores por defecto (URLs cortas). */
export const toSearch = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(clean(params)).toString()

// ---- /personas?q=&orden= ----

export type PeopleSort = 'nombre' | 'edad'
export interface PeopleParams {
  q: string
  orden: PeopleSort
}

export function parsePeopleParams(search: URLSearchParams): PeopleParams {
  return { q: search.get('q') ?? '', orden: search.get('orden') === 'edad' ? 'edad' : 'nombre' }
}

export const peopleSearch = ({ q, orden }: PeopleParams) =>
  toSearch({ q: q.trim() || undefined, orden: orden === 'nombre' ? undefined : orden })

// ---- /personas/:id?categoria=ALLERGY&page=2&size=25 ----

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10

export interface EntriesParams {
  categoria: CategoryCode | null
  /** Página en la URL, empezando en 1 (el backend empieza en 0). */
  page: number
  size: number
}

export function parseEntriesParams(search: URLSearchParams): EntriesParams {
  const categoria = search.get('categoria')
  const page = Number(search.get('page'))
  const size = Number(search.get('size'))
  return {
    categoria: CATEGORY_CODES.includes(categoria as CategoryCode) ? (categoria as CategoryCode) : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  }
}

export const entriesSearch = ({ categoria, page, size }: EntriesParams) =>
  toSearch({
    categoria: categoria ?? undefined,
    page: page > 1 ? page : undefined,
    size: size !== DEFAULT_PAGE_SIZE ? size : undefined,
  })
