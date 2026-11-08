import { Link, NavLink } from 'react-router-dom'
import isologo from '../../assets/brand/isologo.svg'
import { useLogout } from '../../hooks/useLogout'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { formatBadge, navItems, noticesLabel } from './navItems'

export function SideNav() {
  const { count } = useUnreadCount()
  const logout = useLogout()

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-line bg-white px-4 py-6 lg:flex">
      <Link to="/" aria-label="Yuyay, ir al inicio" className={cx('rounded-xl px-2', focusRing)}>
        <img src={isologo} alt="" className="h-12 w-auto" />
      </Link>
      <nav aria-label="Principal" className="flex-1">
        <ul className="grid gap-1">
          {navItems.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                aria-label={to === '/avisos' ? noticesLabel(count) : undefined}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold',
                    isActive ? 'bg-primary text-white' : 'text-ink hover:bg-primary-tint',
                    focusRing,
                  )
                }
              >
                <Icon name={icon} />
                <span className="flex-1">{label}</span>
                {to === '/avisos' && count > 0 ? (
                  <Badge tone="danger" aria-hidden="true">
                    {formatBadge(count)}
                  </Badge>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Button variant="secondary" onClick={() => void logout()} className="w-full justify-start">
        <Icon name="logout" />
        Cerrar sesión
      </Button>
    </aside>
  )
}
