import { useId } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  /** Deshabilita los botones y bloquea el cierre mientras se ejecuta la acción. */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmación de una acción (por defecto destructiva) construida sobre Modal. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messageId = useId()
  return (
    <Modal open={open} onClose={onCancel} title={title} describedBy={messageId} dismissible={!loading}>
      <p id={messageId} className="text-muted">
        {message}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
