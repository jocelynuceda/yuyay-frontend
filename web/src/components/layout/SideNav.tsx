import { Link, NavLink } from 'react-router-dom'
import { useLogout } from '../../hooks/useLogout'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { Isotipo } from '../ui/Brand'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { formatBadge, navItems, noticesLabel } from './navItems'

const pill = 'relative flex h-12 w-12 items-center justify-center rounded-full transition-colors'

/** Barra lateral flotante: columna redondeada con iconos en círculo y el nombre como tooltip. */
export function SideNav() {
  const { count } = useUnreadCount()
  const logout = useLogout()

  return (
    <aside className="fixed inset-y-4 left-4 z-30 hidden w-20 flex-col items-center gap-8 rounded-[2rem] bg-primary py-6 shadow-[var(--shadow-soft)] lg:flex">
      <Link
        to="/"
        aria-label="Yuyay, ir al inicio"
        className={cx('flex h-12 w-12 items-center justify-center rounded-full bg-card', focusRing)}
      >
        <Isotipo className="h-8 w-8" />
      </Link>
      <span aria-hidden="true" className="h-px w-10 bg-white/25" />
      <nav aria-label="Principal" className="flex-1">
        <ul className="grid gap-4">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                title={label}
                aria-label={to === '/avisos' ? noticesLabel(count) : label}
                className={({ isActive }) =>
                  cx(
                    pill,
                    isActive ? 'bg-card text-primary shadow-[var(--shadow-soft)]' : 'bg-white/15 text-white hover:bg-white/25',
                    focusRing,
                  )
                }
              >
                <Icon name={icon} />
                {to === '/avisos' && count > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-[10px] leading-5 font-bold text-white ring-2 ring-primary"
                  >
                    {formatBadge(count)}
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <span aria-hidden="true" className="h-px w-10 bg-white/25" />
      <button
        type="button"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        onClick={() => void logout()}
        className={cx(pill, 'bg-white/15 text-white hover:bg-white/25', focusRing)}
      >
        <Icon name="logout" />
      </button>
    </aside>
  )
}
