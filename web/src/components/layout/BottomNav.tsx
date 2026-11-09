import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { formatBadge, navItems, noticesLabel } from './navItems'

export function BottomNav() {
  const { count } = useUnreadCount()

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {navItems.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              aria-label={to === '/avisos' ? noticesLabel(count) : undefined}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-0.5 px-2 py-2 text-xs font-semibold',
                  isActive ? 'text-primary' : 'text-muted',
                  focusRing,
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'relative flex h-7 w-12 items-center justify-center rounded-full',
                      isActive && 'bg-primary-tint',
                    )}
                  >
                    <Icon name={icon} />
                    {to === '/avisos' && count > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 right-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white"
                      >
                        {formatBadge(count)}
                      </span>
                    ) : null}
                  </span>
                  <span aria-hidden={to === '/avisos' && count > 0 ? true : undefined}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
