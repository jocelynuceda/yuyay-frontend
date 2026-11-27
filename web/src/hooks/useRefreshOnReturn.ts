import { useEffect } from 'react'

export function useRefreshOnReturn(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function refreshIfVisible() {
      if (document.visibilityState !== 'hidden' && window.navigator.onLine !== false) refresh()
    }
    function refreshRestoredPage(event: PageTransitionEvent) {
      if (event.persisted) refreshIfVisible()
    }

    window.addEventListener('focus', refreshIfVisible)
    window.addEventListener('online', refreshIfVisible)
    window.addEventListener('pageshow', refreshRestoredPage)
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => {
      window.removeEventListener('focus', refreshIfVisible)
      window.removeEventListener('online', refreshIfVisible)
      window.removeEventListener('pageshow', refreshRestoredPage)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [refresh, enabled])
}
