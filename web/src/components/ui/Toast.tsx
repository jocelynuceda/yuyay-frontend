import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon, type IconName } from './Icon'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

const tones: Record<ToastTone, { box: string; icon: IconName; iconClass: string }> = {
  success: { box: 'border-accent bg-card', icon: 'check', iconClass: 'text-accent-text' },
  error: { box: 'border-danger/30 bg-danger-bg text-danger', icon: 'alert', iconClass: 'text-danger' },
  info: { box: 'border-line bg-card', icon: 'bell', iconClass: 'text-primary' },
}

export interface ToastRegionProps {
  toasts: readonly ToastItem[]
  onDismiss: (id: number) => void
}

/** Lista de avisos: abajo a la derecha en escritorio y a todo el ancho en móvil. */
export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  return (
    <section
      aria-label="Avisos"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 p-4 sm:inset-x-auto sm:right-0 sm:w-96"
    >
      {toasts.map(({ id, tone, message }) => {
        const style = tones[tone]
        return (
          <div
            key={id}
            className={cx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg',
              'motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0',
              style.box,
            )}
          >
            <Icon name={style.icon} className={cx('mt-0.5 h-5 w-5', style.iconClass)} />
            <p className="min-w-0 flex-1 font-medium wrap-break-word">{message}</p>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => onDismiss(id)}
              className={cx('-m-1 rounded-lg p-1 hover:bg-primary-tint', focusRing)}
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </section>
  )
}
