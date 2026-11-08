import { useEffect, useRef, type MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { focusRing } from '../utils/styles'

const APP_NAME = 'Yuyay'

/** Título principal de la página. En login y registro el <h1> es solo la marca: se usa el del formulario. */
function pageHeading() {
  const h1 = document.querySelector('h1')
  return h1?.textContent?.trim() === APP_NAME ? (document.querySelector('h2') ?? h1) : h1
}

/**
 * Al cambiar de página: pone el título de la pestaña según el título principal y mueve el foco a
 * él, para que el lector de pantalla anuncie la página nueva. Sigue observando la página porque
 * muchas muestran primero un "Cargando…" y después su título real. En la carga inicial no mueve el foco.
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const firstLoad = useRef(true)

  useEffect(() => {
    const moveFocus = !firstLoad.current
    firstLoad.current = false
    let focused: HTMLElement | null = null

    const apply = () => {
      const heading = pageHeading()
      const text = heading?.textContent?.trim()
      if (!heading || !text) return
      const title = `${text} · ${APP_NAME}`
      if (document.title !== title) document.title = title
      // Enfoca el título una vez; si se reemplazó (por ejemplo, tras cargar), enfoca el nuevo
      // solo si el foco quedó perdido en el <body>
      const lost = focused !== null && !focused.isConnected && document.activeElement === document.body
      if (moveFocus && heading !== focused && (focused === null || lost)) {
        heading.setAttribute('tabindex', '-1')
        heading.focus()
        focused = heading
      }
    }

    document.title = APP_NAME
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}

/** Primer elemento enfocable: permite saltar directo al contenido de la página. */
export function SkipLink() {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector('main')
    if (!main) return
    event.preventDefault()
    main.setAttribute('tabindex', '-1')
    main.focus()
  }

  return (
    <a
      href="#contenido"
      onClick={skip}
      className={`sr-only rounded-xl bg-ink px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 ${focusRing}`}
    >
      Saltar al contenido
    </a>
  )
}
