import type { IconName } from '../ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
}

export const navItems: readonly NavItem[] = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/people', label: 'Personas', icon: 'users' },
  { to: '/notifications', label: 'Avisos', icon: 'bell' },
  { to: '/profile', label: 'Perfil', icon: 'user' },
]

export const formatBadge = (count: number) => (count > 99 ? '99+' : String(count))

export const noticesLabel = (count: number) => (count > 0 ? `Avisos, ${count} sin leer` : 'Avisos')
