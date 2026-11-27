import { useContext, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { AuthContext } from '../../contexts/auth-context'
import { useCareSubjectAccess } from '../../hooks/useCareSubjectAccess'
import type { CareSubject } from '../../types'
import { focusRing } from '../../utils/styles'

interface PersonRouteFrameProps {
  subjectId: number
  section?: string
  children: (subject: CareSubject, reload: () => void) => ReactNode
}

export function PersonRouteFrame(props: PersonRouteFrameProps) {
  const userId = useContext(AuthContext)?.user?.id
  return <PersonRouteContent key={`${userId}:${props.subjectId}`} {...props} />
}

function PersonRouteContent({ subjectId, section, children }: PersonRouteFrameProps) {
  const { subject, error, errorStatus, loading, reload } = useCareSubjectAccess(subjectId)
  const linkClass = `rounded-sm text-primary-fg underline ${focusRing}`

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Ruta de navegación">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <li><Link to="/people" className={linkClass}>Personas</Link></li>
          {subject && (
            <li className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              {section ? (
                <Link to={`/people/${subjectId}?tab=entries`} className={linkClass}>{subject.name}</Link>
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
