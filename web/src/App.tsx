import AppRoutes from './routes/AppRoutes'
import { RouteFocus, SkipLink } from './routes/RouteFocus'

export default function App() {
  return (
    <>
      <SkipLink />
      <RouteFocus />
      <AppRoutes />
    </>
  )
}
