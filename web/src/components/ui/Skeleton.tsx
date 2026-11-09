import { cx } from './cx'

export interface SkeletonProps {
  /** Número de líneas de texto; la última es más corta. Sin `lines`, un solo bloque. */
  lines?: number
  className?: string
}

/** Marcador de posición animado mientras carga el contenido (oculto para lectores de pantalla). */
export function Skeleton({ lines, className }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div aria-hidden="true" className={cx('grid gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cx('h-4 rounded-lg bg-line motion-safe:animate-pulse', i === lines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
      </div>
    )
  }
  return <div aria-hidden="true" className={cx('h-4 w-full rounded-lg bg-line motion-safe:animate-pulse', className)} />
}
