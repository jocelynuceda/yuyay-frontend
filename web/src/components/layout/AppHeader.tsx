import { Link } from 'react-router-dom'
import isotipo from '../../assets/brand/isotipo.svg'
import isotipoDark from '../../assets/brand/isotipo-dark.svg'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { focusRing } from '../../utils/styles'
import { Avatar } from '../ui/Avatar'
import { cx } from '../ui/cx'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from './ThemeToggle'
import { formatBadge, noticesLabel } from './navItems'

export function AppHeader() {
  const { user } = useAuth()
  const { count } = useUnreadCount()
  const name = user?.name ?? ''

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card/90 px-4 py-2 backdrop-blur sm:px-6 lg:justify-end">
      <Link to="/" aria-label="Yuyay, ir al inicio" className={cx('rounded-xl lg:hidden', focusRing)}>
        <img src={isotipo} alt="" className="h-9 w-9 dark:hidden" />
        <img src={isotipoDark} alt="" className="hidden h-9 w-9 dark:inline" />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          to="/avisos"
          aria-label={noticesLabel(count)}
          className={cx('relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-primary-tint', focusRing)}
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
          className={cx('flex items-center gap-2 rounded-full lg:rounded-xl lg:py-1 lg:pr-3 lg:hover:bg-primary-tint', focusRing)}
        >
          <Avatar name={name} size="sm" />
          <span className="hidden max-w-48 truncate text-sm font-semibold lg:inline">{name}</span>
        </Link>
      </div>
    </header>
  )
}
