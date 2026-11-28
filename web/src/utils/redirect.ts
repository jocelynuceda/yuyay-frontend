const AUTH_PATHS = ['/login', '/register']
const INTERNAL_ORIGIN = 'https://yuyay.invalid'
const unsafe = (value: string, allowSpaces = false) => Array.from(value).some((char) =>
  char === '\\' || char.charCodeAt(0) < (allowSpaces ? 32 : 33) || char.charCodeAt(0) === 127)

/** Reutiliza location.state.from, admitiendo exclusivamente un destino interno seguro. */
export function getPostLoginTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/'
  const from = state.from
  if (typeof from !== 'object' || from === null || !('pathname' in from)) return '/'
  const { pathname } = from
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//') || unsafe(pathname)) return '/'
  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''
  if ((search !== '' && !search.startsWith('?')) || unsafe(search, true)) return '/'
  try {
    const target = new URL(pathname + search, INTERNAL_ORIGIN)
    if (target.origin !== INTERNAL_ORIGIN || target.pathname.startsWith('//') || AUTH_PATHS.includes(target.pathname)) return '/'
    return target.pathname + target.search
  } catch { return '/' }
}
