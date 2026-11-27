import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { Isotipo, Logo } from '../../components/ui/Brand'
import { cx } from '../../components/ui/cx'
import { Icon } from '../../components/ui/Icon'
import { focusRing, linkButtonClass } from '../../utils/styles'
import { LANDING_NAV } from './landingContent'

const navLink = `relative rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-primary-tint ${focusRing}`

/** Sección que ocupa la parte alta de la pantalla, para marcarla en el menú. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const sections = LANDING_NAV.map(({ id }) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
    const update = () => {
      const readingLine = Math.min(window.innerHeight * 0.25, 160)
      const current = sections.findLast((section) => section.getBoundingClientRect().top <= readingLine)
      setActive(current?.id ?? sections[0]?.id ?? null)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return active
}

/** La barra gana fondo y borde cuando la página ya no está arriba del todo. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return scrolled
}

/** Barra fija de la landing: logo, secciones con la activa marcada, tema, «Iniciar sesión» y «Crear cuenta». */
export function LandingHeader() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const active = useActiveSection()
  const scrolled = useScrolled()

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

  const link = (id: string, mobile = false) =>
    cx(navLink, mobile && 'block text-base', active === id ? 'text-primary-fg' : 'text-ink')

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b transition-colors duration-200',
        scrolled || open ? 'border-line bg-surface/85 backdrop-blur-md' : 'border-transparent bg-transparent',
      )}
    >
      <div className="landing-container flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Link to="/" aria-label="Yuyay, inicio" className={`shrink-0 rounded-xl ${focusRing}`}>
          <Isotipo className="min-[380px]:hidden" />
          <span className="hidden min-[380px]:inline-flex"><Logo /></span>
        </Link>

        <nav aria-label="Secciones" className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className={link(item.id)} aria-current={active === item.id ? 'location' : undefined}>
                  {item.label}
                  {/* Indicador de la sección activa: subrayado, no solo color */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary-fg transition-opacity',
                      active === item.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <ThemeToggle />
          <Link to="/login" className={`hidden sm:inline-flex ${navLink} text-ink`}>
            Iniciar sesión
          </Link>
          <Link to="/register" className={`${linkButtonClass} whitespace-nowrap px-3! py-2! text-sm sm:px-4!`}>
            Crear cuenta
          </Link>
          <button
            ref={menuButton}
            type="button"
            className={`control-interactive control-ghost inline-flex h-11 w-11 items-center justify-center rounded-full lg:hidden ${focusRing}`}
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
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={link(item.id, true)}
                  aria-current={active === item.id ? 'location' : undefined}
                  onClick={() => {
                    document.getElementById(item.id)?.focus({ preventScroll: true })
                    setOpen(false)
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="sm:hidden">
              <Link to="/login" className={`block ${navLink} text-base text-ink`}>Iniciar sesión</Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
