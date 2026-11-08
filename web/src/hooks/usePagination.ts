import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '../utils/urlParams'

export interface PaginationOptions {
  pageParam?: string
  sizeParam?: string
}

/** Página y tamaño guardados en la URL (?page=2&size=25), conservando el resto de parámetros. */
export function usePagination({ pageParam = 'page', sizeParam = 'size' }: PaginationOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawPage = Number(searchParams.get(pageParam))
  const rawSize = Number(searchParams.get(sizeParam))
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE

  const setPage = useCallback(
    (next: number) => {
      const value = Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (value > 1) params.set(pageParam, String(value))
          else params.delete(pageParam)
          return params
        },
        { replace: false },
      )
    },
    [pageParam, setSearchParams],
  )

  const setSize = useCallback(
    (next: number) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          params.delete(pageParam)
          if ((PAGE_SIZES as readonly number[]).includes(next) && next !== DEFAULT_PAGE_SIZE) {
            params.set(sizeParam, String(next))
          } else {
            params.delete(sizeParam)
          }
          return params
        },
        { replace: false },
      )
    },
    [pageParam, sizeParam, setSearchParams],
  )

  return { page, size, apiPage: page - 1, setPage, setSize }
}
