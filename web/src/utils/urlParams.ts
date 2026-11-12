import { CATEGORY_CODES, type CategoryCode } from '../types'

// Filtros que viven en la URL. La página los lee con el router (useSearchParams) y los pasa
// a los componentes; cuando cambian, los vuelve a escribir con `toSearch`.

const clean = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>

/** Convierte parámetros a query string sin los valores por defecto (URLs cortas). */
export const toSearch = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(clean(params)).toString()

// ---- /people?q=&sort= ----

export type PeopleSort = 'name' | 'age'
export interface PeopleParams {
  q: string
  sort: PeopleSort
}

export function parsePeopleParams(search: URLSearchParams): PeopleParams {
  return { q: search.get('q') ?? '', sort: search.get('sort') === 'age' ? 'age' : 'name' }
}

export const peopleSearch = ({ q, sort }: PeopleParams) =>
  toSearch({ q: q.trim() || undefined, sort: sort === 'name' ? undefined : sort })

// ---- /people/:id?category=ALLERGY&page=2&size=25 ----

export const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 10

export interface EntriesParams {
  category: CategoryCode | null
  /** Página en la URL, empezando en 1 (el backend empieza en 0). */
  page: number
  size: number
}

export function parseEntriesParams(search: URLSearchParams): EntriesParams {
  const category = search.get('category')
  const page = Number(search.get('page'))
  const size = Number(search.get('size'))
  return {
    category: CATEGORY_CODES.includes(category as CategoryCode) ? (category as CategoryCode) : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE,
  }
}

export const entriesSearch = ({ category, page, size }: EntriesParams) =>
  toSearch({
    category: category ?? undefined,
    page: page > 1 ? page : undefined,
    size: size !== DEFAULT_PAGE_SIZE ? size : undefined,
  })

/** Lee un identificador decimal positivo sin aceptar fracciones ni notación exponencial. */
export function parseRouteId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
