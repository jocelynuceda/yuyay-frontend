import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { entriesSearch, parseEntriesParams, parseRouteId } from '../../utils/urlParams'
import { linkSecondaryClass } from '../../utils/styles'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { EntryDetailPage } from './EntryDetailPage'

export default function EntryDetailRoute() {
  const { id, entryId: entryParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const subjectId = parseRouteId(id)
  const entryId = parseRouteId(entryParam)
  if (subjectId === null || entryId === null) return <NotFoundPage />
  const requestedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo
  const returnMatch = typeof requestedReturn === 'string' ? requestedReturn.match(/^\/people\/(\d+)\/entries(?:\?([^#]*))?$/) : null
  const returnSearch = returnMatch ? entriesSearch(parseEntriesParams(new URLSearchParams(returnMatch[2]))) : ''
  const returnTo = returnMatch?.[1] === String(subjectId)
    ? `/people/${subjectId}/entries${returnSearch ? `?${returnSearch}` : ''}`
    : `/people/${subjectId}?tab=entries`

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Link to={returnTo} className={linkSecondaryClass}><span aria-hidden="true">←</span>Regresar</Link>
      </div>
      <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Registro">
        {() => (
          <EntryDetailPage
            key={entryId}
            subjectId={subjectId}
            entryId={entryId}
            onDeleted={() => void navigate(returnTo, { replace: true })}
          />
        )}
      </PersonRouteFrame>
    </>
  )
}
