/** Clase de foco visible y común a botones y campos (navegación con teclado). */
export const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Enlace de texto dentro de contenido. */
export const linkClass = `rounded-sm font-semibold text-primary underline underline-offset-2 ${focusRing}`

/** Enlace con aspecto de botón primario. */
export const linkButtonClass = `inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`

/** Enlace con aspecto de botón secundario. */
export const linkSecondaryClass = `inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 py-2.5 font-semibold text-ink ${focusRing}`
