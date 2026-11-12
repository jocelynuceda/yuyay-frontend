import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { formatBadge, navItems, noticesLabel } from './navItems'

/** Barra inferior flotante en móvil, con el mismo estilo de la barra lateral. */
export function BottomNav() {
  const { count } = useUnreadCount()

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-full bg-primary p-1.5 shadow-[var(--shadow-soft)] lg:hidden"
    >
      <ul className="grid grid-cols-4 gap-1">
        {navItems.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              aria-label={to === '/notifications' ? noticesLabel(count) : undefined}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors',
                  isActive ? 'bg-card text-primary' : 'text-white hover:bg-white/15',
                  focusRing,
                )
              }
            >
              <span className="relative flex h-6 items-center justify-center">
                <Icon name={icon} />
                {to === '/notifications' && count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-3 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white"
                  >
                    {formatBadge(count)}
                  </span>
                ) : null}
              </span>
              <span aria-hidden={to === '/notifications' && count > 0 ? true : undefined}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
