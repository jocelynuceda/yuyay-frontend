import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { Avatar } from '../ui/Avatar'
import { Isotipo } from '../ui/Brand'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from './ThemeToggle'
import { formatBadge, noticesLabel } from './navItems'

export function AppHeader() {
  const { user } = useAuth()
  const { count } = useUnreadCount()
  const name = user?.name ?? ''

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-surface/70 px-4 py-3 backdrop-blur-md sm:px-6 lg:justify-end">
      <Link to="/" aria-label="Yuyay, ir al inicio" className={cx('rounded-xl lg:hidden', focusRing)}>
        <Isotipo />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          to="/avisos"
          aria-label={noticesLabel(count)}
          className={cx('relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-soft)] hover:bg-primary-tint', focusRing)}
        >
          <Icon name="bell" />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white"
            >
              {formatBadge(count)}
            </span>
          ) : null}
        </Link>
        <Link
          to="/perfil"
          aria-label={`Perfil de ${name}`}
          className={cx('flex items-center gap-2 rounded-full lg:bg-card lg:py-1 lg:pr-4 lg:pl-1 lg:shadow-[var(--shadow-soft)] lg:hover:bg-primary-tint', focusRing)}
        >
          <Avatar name={name} size="sm" />
          <span className="hidden max-w-48 truncate text-sm font-semibold lg:inline">{name}</span>
        </Link>
      </div>
    </header>
  )
}
