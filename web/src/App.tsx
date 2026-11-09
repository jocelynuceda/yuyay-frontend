import { useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import AppRoutes from './routes/AppRoutes'
import { RouteFocus, SkipLink } from './routes/RouteFocus'

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <SkipLink />
      <RouteFocus />
      {/* Destino de "Saltar al contenido" en todas las páginas */}
      <div id="contenido">
        <ErrorBoundary resetKeys={[pathname]}>
          <AppRoutes />
        </ErrorBoundary>
      </div>
    </>
  )
}
