import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { useFetch } from '../../hooks/useFetch'
import { getCareSubject } from '../../services/api/careSubjects'
import type { CareSubject } from '../../types'
import { focusRing } from '../../utils/styles'

export function PersonRouteFrame({
  subjectId,
  section,
  children,
}: {
  subjectId: number
  section?: string
  children: (subject: CareSubject, reload: () => void) => ReactNode
}) {
  const { data: subject, error, errorStatus, loading, reload } = useFetch(
    (signal) => getCareSubject(subjectId, signal),
    [subjectId],
  )
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
      {loading && !subject && <p role="status" className="text-muted">Cargando persona…</p>}
      {error && !subject && <LoadError message={error} status={errorStatus} onRetry={reload} />}
      {subject && children(subject, reload)}
    </main>
  )
}
