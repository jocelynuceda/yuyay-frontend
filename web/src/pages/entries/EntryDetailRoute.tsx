import { useNavigate, useParams } from 'react-router-dom'
import { parseRouteId } from '../../utils/urlParams'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { EntryDetailPage } from './EntryDetailPage'

export default function EntryDetailRoute() {
  const { id, entryId: entryParam } = useParams()
  const navigate = useNavigate()
  const subjectId = parseRouteId(id)
  const entryId = parseRouteId(entryParam)
  if (subjectId === null || entryId === null) return <NotFoundPage />

  return (
    <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Registro">
      {() => (
        <EntryDetailPage
          key={entryId}
          subjectId={subjectId}
          entryId={entryId}
          onDeleted={() => void navigate(`/people/${subjectId}?tab=entries`, { replace: true })}
        />
      )}
    </PersonRouteFrame>
  )
}
