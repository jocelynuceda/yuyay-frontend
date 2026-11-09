import { Outlet } from 'react-router-dom'
import { UnreadCountProvider } from '../../contexts/UnreadCountContext'
import { AppHeader } from './AppHeader'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { SideNav } from './SideNav'

/** Marco de las páginas privadas. Cada página dibuja su propio <main>, por eso el contenido va en un <div>. */
export default function AppLayout() {
  return (
    <UnreadCountProvider>
      <SideNav />
      <div className="min-h-svh lg:pl-64">
        <AppHeader />
        <OfflineBanner />
        <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </UnreadCountProvider>
  )
}
