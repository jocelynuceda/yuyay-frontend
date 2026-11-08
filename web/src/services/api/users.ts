import { api } from '../http'
import type { UserProfile } from '../../types'

export async function getMe(signal?: AbortSignal) {
  const { data } = await api.get<UserProfile>('/users/me', { signal })
  return data
}

export async function updateMe(request: { name: string }) {
  const { data } = await api.patch<UserProfile>('/users/me', request)
  return data
}
