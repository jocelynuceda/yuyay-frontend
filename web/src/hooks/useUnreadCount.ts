import { useContext } from 'react'
import { UnreadCountContext } from '../contexts/unread-count-context'
import type { UnreadCountValue } from '../contexts/unread-count-context'

export function useUnreadCount(): UnreadCountValue {
  const context = useContext(UnreadCountContext)
  if (!context) throw new Error('useUnreadCount debe usarse dentro de UnreadCountProvider.')
  return context
}
