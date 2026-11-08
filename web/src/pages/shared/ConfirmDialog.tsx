import { useEffect, useId, useRef, useState } from 'react'
import { getErrorMessage } from '../../utils/apiErrors'
import { focusRing } from '../../utils/styles'

/**
 * Confirmación antes de una acción destructiva (borrar, quitar, revocar).
 * Usa <dialog> nativo: atrapa el foco, cierra con Escape y devuelve el foco al botón que lo abrió.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  workingLabel = 'Borrando…',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  /** Texto del botón mientras se ejecuta (por ejemplo, "Revocando…"). */
  workingLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const ref = useRef<HTMLDialogElement>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setError(null)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  async function confirm() {
    setWorking(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault()
        if (!working) onCancel()
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-white p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        {title}
      </h2>
      <p id={`${id}-message`} className="mt-2 text-muted">
        {message}
      </p>
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-bg p-3 text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          disabled={working}
          className={`rounded-xl border border-line px-5 py-2.5 font-semibold ${focusRing}`}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={working}
          className={`rounded-xl bg-danger px-5 py-2.5 font-semibold text-white disabled:opacity-60 ${focusRing}`}
        >
          {working ? workingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
