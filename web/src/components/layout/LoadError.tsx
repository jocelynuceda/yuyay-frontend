import { Button } from '../ui/Button'

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-2xl bg-danger-bg p-4 text-danger">
      <p>{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}
