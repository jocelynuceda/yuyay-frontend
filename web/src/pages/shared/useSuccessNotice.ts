import { useCallback, useRef } from 'react'
import { useToast } from '../../hooks/useToast'

/**
 * Toast de éxito tras guardar o borrar. Además mueve el foco a un ancla invisible
 * (`<span {...anchorProps} />`) junto al contenido: el formulario o el diálogo que tenía
 * el foco acaba de cerrarse, y así el teclado no vuelve al inicio de la página.
 */
export function useSuccessNotice() {
  const toast = useToast()
  const anchor = useRef<HTMLSpanElement>(null)

  const notify = useCallback(
    (message: string) => {
      toast.success(message)
      // Después de que se cierre el formulario o el diálogo
      requestAnimationFrame(() => anchor.current?.focus())
    },
    [toast],
  )

  return { notify, anchorProps: { ref: anchor, tabIndex: -1, className: 'sr-only' } }
}
