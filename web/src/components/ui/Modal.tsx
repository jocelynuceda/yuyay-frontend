import { useEffect, useId, useRef, type ReactNode } from 'react'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Id del elemento que describe el diálogo (aria-describedby). */
  describedBy?: string
  /** Si es false, Escape, el fondo y el botón "Cerrar" no cierran (por ejemplo mientras se guarda). */
  dismissible?: boolean
  className?: string
}

/**
 * Diálogo modal sobre <dialog> nativo: showModal() atrapa el foco, Escape llama a onClose
 * y al cerrar el foco vuelve al elemento que lo tenía antes de abrir.
 */
export function Modal({ open, onClose, title, children, describedBy, dismissible = true, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    return () => {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
      previous?.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
      className={cx('m-auto w-[min(32rem,calc(100%-2rem))] rounded-3xl bg-card p-0 text-ink backdrop:bg-scrim', className)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Cerrar"
            className={cx('-m-1.5 rounded-xl p-1.5 text-muted hover:bg-primary-tint disabled:opacity-40', focusRing)}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  )
}
