import { useTheme } from '../../hooks/useTheme'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

/** Botón de icono que alterna entre modo claro y oscuro. */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'
  return (
    <Button
      variant="ghost"
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={toggle}
      className="h-10 w-10 rounded-full bg-card p-0! shadow-[var(--shadow-soft)]"
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </Button>
  )
}
