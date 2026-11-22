import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { linkSecondaryClass } from '../../utils/styles'
import { parseRouteId } from '../../utils/urlParams'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { HandoffWorkspacePage, type HandoffWorkspaceMode } from './HandoffWorkspacePage'

/** Páginas independientes de detalle, creación de enlace y código de un enlace existente. */
export default function HandoffWorkspaceRoute({ mode = 'detail' }: { mode?: HandoffWorkspaceMode }) {
  const { id, handoffId: handoffParam, sessionId: sessionParam } = useParams()
  const { user } = useAuth()
  const subjectId = parseRouteId(id)
  const handoffId = parseRouteId(handoffParam)
  const sessionId = mode === 'code' ? parseRouteId(sessionParam) : undefined
  useEffect(() => { window.scrollTo(0, 0) }, [subjectId, handoffId, mode, sessionId])
  const valid = subjectId !== null && handoffId !== null && sessionId !== null
  const back = subjectId === null ? '/people' : mode === 'detail' || handoffId === null
    ? `/people/${subjectId}?tab=handoffs` : `/people/${subjectId}/handoffs/${handoffId}`
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Link to={back} className={linkSecondaryClass}><span aria-hidden="true">←</span>Regresar {subjectId === null ? 'a personas' : mode === 'detail' || handoffId === null ? 'a resúmenes' : 'al resumen'}</Link>
      </div>
      {valid ? (
        <PersonRouteFrame key={`${subjectId}:${handoffId}:${mode}:${sessionId ?? ''}`} subjectId={subjectId}
          section={mode === 'detail' ? 'Resumen' : mode === 'share' ? 'Compartir resumen' : 'Código de acceso'}>
          {(subject) => <HandoffWorkspacePage subjectId={subjectId} handoffId={handoffId} mode={mode} sessionId={sessionId}
            isPrincipal={subject.myRole === 'PRINCIPAL'} userId={user?.id} showBack={false} />}
        </PersonRouteFrame>
      ) : <NotFoundPage />}
    </>
  )
}
