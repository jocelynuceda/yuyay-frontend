/** Clase de foco visible y común a botones y campos (navegación con teclado). */
export const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Enlace de texto dentro de contenido. */
export const linkClass = `rounded-sm font-semibold text-primary underline underline-offset-2 ${focusRing}`

/** Enlace con aspecto de botón primario. */
export const linkButtonClass = `inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-[var(--shadow-soft)] ${focusRing}`

/** Enlace con aspecto de botón secundario. */
export const linkSecondaryClass = `inline-flex items-center justify-center gap-2 rounded-full bg-card px-6 py-3 font-semibold text-ink shadow-[var(--shadow-soft)] ${focusRing}`
