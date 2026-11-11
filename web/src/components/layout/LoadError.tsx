import { Link } from 'react-router-dom'
import { linkClass } from '../../utils/styles'
import { Button } from '../ui/Button'

const titles: Record<number, string> = {
  403: 'No tienes acceso a esta información',
  404: 'No encontramos lo que buscas',
  410: 'Este enlace ya no está disponible',
}

/**
 * Error de carga. Si el recurso no existe o no hay permiso (403, 404, 410) reintentar no sirve:
 * se ofrece volver al inicio. Con errores de red o del servidor se ofrece reintentar.
 */
export function LoadError({ message, status, onRetry }: { message: string; status?: number; onRetry: () => void }) {
  const title = status ? titles[status] : undefined
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-2xl bg-danger-bg p-4 text-danger">
      {title ? <p className="font-semibold">{title}</p> : null}
      <p>{message}</p>
      {title ? (
        <Link to="/" className={linkClass}>
          Volver al inicio
        </Link>
      ) : (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
