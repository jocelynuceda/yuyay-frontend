import { createContext } from 'react'

export interface UnreadCountValue {
  count: number
  refresh: () => void
}

export const UnreadCountContext = createContext<UnreadCountValue | undefined>(undefined)
