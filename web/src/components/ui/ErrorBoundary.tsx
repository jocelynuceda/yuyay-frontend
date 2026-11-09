import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { Card } from './Card'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Contenido alternativo; `reset` vuelve a intentar renderizar los hijos. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Si alguno cambia estando en error (por ejemplo la ruta), se reintenta automáticamente. */
  resetKeys?: readonly unknown[]
}

interface ErrorBoundaryState {
  error: Error | null
}

function DefaultFallback({ reset }: { reset: () => void }) {
  return (
    <Card as="section" role="alert" className="m-4 grid justify-items-start gap-3">
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="text-muted">Ocurrió un error inesperado al mostrar esta página. Puedes intentarlo de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </Card>
  )
}

/** Captura errores de render de sus hijos y muestra un mensaje con opción de reintentar. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack)
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    const { resetKeys = [] } = this.props
    const previous = prev.resetKeys ?? []
    if (
      this.state.error &&
      (resetKeys.length !== previous.length || resetKeys.some((key, i) => !Object.is(key, previous[i])))
    ) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.fallback ? this.props.fallback(error, this.reset) : <DefaultFallback reset={this.reset} />
  }
}
