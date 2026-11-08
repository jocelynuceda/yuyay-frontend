import { useParams } from 'react-router-dom'
import { parseRouteId } from '../../utils/urlParams'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { NewHandoffPage } from './NewHandoffPage'

export default function NewHandoffRoute() {
  const { id } = useParams()
  const subjectId = parseRouteId(id)
  if (subjectId === null) return <NotFoundPage />

  return (
    <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Nuevo resumen">
      {(subject) => <NewHandoffPage subjectId={subjectId} subjectName={subject.name} />}
    </PersonRouteFrame>
  )
}
