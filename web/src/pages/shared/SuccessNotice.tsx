import { useEffect, useRef } from 'react'

/**
 * Mensaje de éxito tras guardar o borrar. Recibe el foco al aparecer: el formulario o el diálogo
 * que tenía el foco acaba de cerrarse, y así el teclado no vuelve al inicio de la página.
 */
export function SuccessNotice({ message }: { message: string | null }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (message) ref.current?.focus()
  }, [message])

  if (!message) return null
  return (
    <p ref={ref} role="status" tabIndex={-1} className="rounded-xl bg-accent-tint p-4 font-semibold text-accent-text">
      {message}
    </p>
  )
}
