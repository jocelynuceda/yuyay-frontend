import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getCareSubject } from '../../services/api/careSubjects'
import type { CareSubject } from '../../types'
import { focusRing } from '../../utils/styles'
import { useLoad } from '../care/useLoad'

export function PersonRouteFrame({
  subjectId,
  section,
  children,
}: {
  subjectId: number
  section?: string
  children: (subject: CareSubject) => ReactNode
}) {
  const { state } = useLoad(() => getCareSubject(subjectId), subjectId)
  const subject = state.status === 'ready' ? state.data : null
  const linkClass = `rounded-sm text-primary underline ${focusRing}`

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Ruta de navegación">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <li><Link to="/personas" className={linkClass}>Personas</Link></li>
          {subject && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              {section ? (
                <Link to={`/personas/${subjectId}?tab=registros`} className={linkClass}>{subject.name}</Link>
              ) : (
                <span aria-current="page">{subject.name}</span>
              )}
            </li>
          )}
          {section && subject && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              <span aria-current="page">{section}</span>
            </li>
          )}
        </ol>
      </nav>
      {state.status === 'loading' && <p role="status" className="text-muted">Cargando persona…</p>}
      {state.status === 'error' && (
        <p role="alert" className="rounded-2xl bg-danger-bg p-4 text-danger">{state.message}</p>
      )}
      {subject && children(subject)}
    </main>
  )
}
