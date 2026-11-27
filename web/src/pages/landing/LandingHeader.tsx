import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { Logo } from '../../components/ui/Brand'
import { Icon } from '../../components/ui/Icon'
import { focusRing, linkButtonClass } from '../../utils/styles'
import { LANDING_NAV } from './landingContent'

const navLink = `rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-primary-tint ${focusRing}`

/** Barra fija de la landing: logo, secciones al centro, y a la derecha el tema, «Iniciar sesión» y «Crear cuenta». */
export function LandingHeader() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Al cerrar con Escape, el foco vuelve al botón para no perder la posición del teclado
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButton.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="Yuyay, inicio" className={`rounded-xl ${focusRing}`}>
          <Logo />
        </Link>

        <nav aria-label="Secciones" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={navLink}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <ThemeToggle />
          <Link to="/login" className={`hidden sm:inline-flex ${navLink}`}>
            Iniciar sesión
          </Link>
          <Link to="/register" className={`${linkButtonClass} px-4! py-2! text-sm`}>
            Crear cuenta
          </Link>
          <button
            ref={menuButton}
            type="button"
            className={`control-interactive control-ghost inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden ${focusRing}`}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
      </div>

      {open ? (
        <nav id="landing-menu" aria-label="Secciones" className="border-t border-line px-4 pb-4 lg:hidden">
          <ul className="grid gap-1 pt-2">
            {LANDING_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={`block ${navLink} text-base`} onClick={() => setOpen(false)}>
                  {item.label}
                </a>
              </li>
            ))}
            <li className="sm:hidden">
              <Link to="/login" className={`block ${navLink} text-base`}>Iniciar sesión</Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
