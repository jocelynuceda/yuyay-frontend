import { Link, NavLink } from 'react-router-dom'
import { useLogout } from '../../hooks/useLogout'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { Isotipo } from '../ui/Brand'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { formatBadge, navItems, noticesLabel } from './navItems'

const row = 'relative flex h-12 w-full min-w-0 items-center rounded-full transition-colors'
const iconSlot = 'relative flex h-12 w-12 shrink-0 items-center justify-center'
const label =
  'whitespace-nowrap pr-5 font-semibold opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100 group-has-[:focus-visible]/nav:opacity-100'

/**
 * Barra lateral flotante: columna de iconos que se despliega al pasar el mouse
 * (o al enfocarla con teclado) y muestra el nombre de cada sección. AppLayout
 * corre el contenido a la derecha mientras está abierta (peer/nav).
 */
export function SideNav() {
  const { count } = useUnreadCount()
  const logout = useLogout()

  return (
    <aside className="group/nav peer/nav fixed inset-y-4 left-4 z-30 hidden w-20 flex-col gap-8 overflow-hidden rounded-[2rem] bg-primary dark:bg-card dark:ring-1 dark:ring-white/6 px-4 py-6 shadow-[var(--shadow-soft)] transition-[width] duration-300 ease-out hover:w-60 has-[:focus-visible]:w-60 lg:flex">
      <Link to="/" aria-label="Yuyay, ir al inicio" className={cx('flex items-center gap-3 rounded-full', focusRing)}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card">
          <Isotipo className="h-8 w-8" />
        </span>
        <span className={cx(label, 'text-lg text-white dark:text-ink')}>Yuyay</span>
      </Link>
      <span aria-hidden="true" className="h-px w-full bg-white/25 dark:bg-line" />
      <nav aria-label="Principal" className="flex-1">
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {navItems.map(({ to, label: text, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                aria-label={to === '/notifications' ? noticesLabel(count) : text}
                className={({ isActive }) =>
                  cx(
                    row,
                    isActive ? 'bg-card text-primary-fg shadow-[var(--shadow-soft)] dark:bg-accent dark:text-on-accent' : 'bg-white/15 text-white hover:bg-white/25 dark:bg-white/5 dark:text-muted dark:hover:bg-white/10 dark:hover:text-ink',
                    focusRing,
                  )
                }
              >
                <span className={iconSlot}>
                  <Icon name={icon} />
                  {to === '/notifications' && count > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-danger-solid px-1 text-center text-[10px] leading-5 font-bold text-white ring-2 ring-primary dark:ring-card"
                    >
                      {formatBadge(count)}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" className={label}>
                  {text}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <span aria-hidden="true" className="h-px w-full bg-white/25 dark:bg-line" />
      <button
        type="button"
        aria-label="Cerrar sesión"
        onClick={() => void logout()}
        className={cx(row, 'bg-white/15 text-white hover:bg-white/25 dark:bg-white/5 dark:text-muted dark:hover:bg-white/10 dark:hover:text-ink', focusRing)}
      >
        <span className={iconSlot}>
          <Icon name="logout" />
        </span>
        <span aria-hidden="true" className={label}>
          Cerrar sesión
        </span>
      </button>
    </aside>
  )
}
