const AUTH_PATHS = ['/login', '/register']

/** Destino tras iniciar sesión: la ruta guardada en `location.state.from` o "/" si no hay una válida. */
export function getPostLoginTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/'
  const from = state.from
  if (typeof from !== 'object' || from === null || !('pathname' in from)) return '/'
  const { pathname } = from
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) return '/'
  if (AUTH_PATHS.includes(pathname)) return '/'
  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''
  return `${pathname}${search}`
}
