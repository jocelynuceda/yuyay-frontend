import { useParams } from 'react-router-dom'
import { parseRouteId } from '../../utils/urlParams'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { DocumentReviewPage } from './DocumentReviewPage'

export default function DocumentReviewRoute() {
  const { id, attachmentId: attachmentParam } = useParams()
  const subjectId = parseRouteId(id)
  const attachmentId = parseRouteId(attachmentParam)
  if (subjectId === null || attachmentId === null) return <NotFoundPage />

  return (
    <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Documento">
      {() => <DocumentReviewPage key={attachmentId} subjectId={subjectId} attachmentId={attachmentId} />}
    </PersonRouteFrame>
  )
}
