import { api } from '../http'
import type { Notification, Page, UnreadCount } from '../../types'

export interface NotificationListParams {
  unread?: boolean
  /** Empieza en 0. */
  page: number
  size: number
}

export async function listNotifications({ unread, page, size }: NotificationListParams, signal?: AbortSignal) {
  const { data } = await api.get<Page<Notification>>('/notifications', {
    params: { unread, page, size, sort: 'createdAt,desc' },
    signal,
  })
  return data
}

export async function getUnreadCount(signal?: AbortSignal) {
  const { data } = await api.get<UnreadCount>('/notifications/unread-count', { signal })
  return data
}

export async function markNotificationRead(id: number) {
  const { data } = await api.patch<Notification>(`/notifications/${id}/read`)
  return data
}
