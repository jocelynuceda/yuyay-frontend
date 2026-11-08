import AppRoutes from './routes/AppRoutes'
import { RouteFocus, SkipLink } from './routes/RouteFocus'

export default function App() {
  return (
    <>
      <SkipLink />
      <RouteFocus />
      {/* Destino de "Saltar al contenido" en todas las páginas */}
      <div id="contenido">
        <AppRoutes />
      </div>
    </>
  )
}
