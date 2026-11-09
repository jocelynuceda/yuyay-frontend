import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { getAttachment, getAttachmentContent, openAttachment, retryAttachmentOcr } from '../../services/api/attachments'
import type { HealthEntry } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { isImage } from '../../utils/attachments'
import { linkClass } from '../../utils/styles'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import { useOcrPolling } from './useOcrPolling'

/** La imagen es privada: se pide con la sesión y se muestra desde una URL local. */
function ImagePreview({ subjectId, attachmentId, name }: { subjectId: number; attachmentId: number; name: string }) {
  const { data: url } = useFetch(
    async (signal) => URL.createObjectURL(await getAttachmentContent(subjectId, attachmentId, signal)),
    [subjectId, attachmentId],
  )
  useEffect(() => {
    if (url) return () => URL.revokeObjectURL(url)
  }, [url])

  return url ? <img src={url} alt={`Vista previa de ${name}`} className="max-h-96 w-fit rounded-2xl" /> : null
}

/** Muestra cómo va la lectura de un documento y permite convertir el texto en un registro. */
export function DocumentReviewPage({ subjectId, attachmentId }: { subjectId: number; attachmentId: number }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: document, error, loading, reload } = useFetch(
    (signal) => getAttachment(subjectId, attachmentId, signal),
    [subjectId, attachmentId],
  )
  const [writingByHand, setWritingByHand] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [opening, setOpening] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  useOcrPolling(document?.ocrStatus === 'PENDING', reload)

  const backToDocuments = `/personas/${subjectId}?tab=documentos`

  if (error && !document) return <LoadError message={error} onRetry={reload} />
  if (loading && !document) return <Skeleton lines={4} />
  if (!document) return null

  async function open() {
    setOpening(true)
    setActionError(null)
    try {
      const opened = await openAttachment(subjectId, attachmentId)
      if (!opened) setActionError('Tu navegador bloqueó la pestaña nueva. Permite las ventanas emergentes e inténtalo de nuevo.')
    } catch (e) {
      setActionError(getErrorMessage(e))
    } finally {
      setOpening(false)
    }
  }

  async function retry() {
    setRetrying(true)
    setActionError(null)
    try {
      await retryAttachmentOcr(subjectId, attachmentId)
      setWritingByHand(false)
      reload()
    } catch (e) {
      setActionError(getErrorMessage(e))
    } finally {
      setRetrying(false)
    }
  }

  function handleSaved(entry: HealthEntry | null) {
    if (!entry) return
    toast.success('Registro guardado.')
    void navigate(`/personas/${subjectId}/registros/${entry.id}`)
  }

  const form = (details?: string) => (
    <HealthEntryForm
      subjectId={subjectId}
      initialDetails={details}
      sourceAttachmentId={attachmentId}
      onCancel={() => void navigate(backToDocuments)}
      onSaved={handleSaved}
    />
  )

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold break-words">{document.originalFilename}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={() => void open()} loading={opening}>
            Abrir archivo
          </Button>
          <Link to={backToDocuments} className={linkClass}>
            Volver a documentos
          </Link>
        </div>
      </header>

      {isImage(document) ? (
        <ImagePreview subjectId={subjectId} attachmentId={attachmentId} name={document.originalFilename} />
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-2xl bg-danger-bg p-4 text-danger">
          {actionError}
        </p>
      ) : null}
      {error ? <LoadError message={error} onRetry={reload} /> : null}

      {document.ocrStatus === 'PENDING' ? (
        <p role="status" className="flex items-center gap-3 rounded-2xl bg-card p-4">
          <Spinner decorative />
          Leyendo el documento…
        </p>
      ) : null}

      {document.ocrStatus === 'FAILED' ? (
        <div className="grid gap-3 rounded-2xl bg-danger-bg p-4">
          <p role="alert" className="text-danger">
            {document.ocrError ?? 'No pudimos leer el texto del documento.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void retry()} loading={retrying}>
              Reintentar
            </Button>
            {!writingByHand ? (
              <Button variant="secondary" onClick={() => setWritingByHand(true)}>
                Escribir el registro
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {document.ocrStatus === 'FAILED' && writingByHand ? form() : null}

      {document.ocrStatus === 'DONE' ? (
        <>
          <p className="rounded-2xl bg-accent-tint p-4 text-accent-text">
            {document.ocrText
              ? 'La lectura puede tener errores. Corrige los detalles antes de guardar.'
              : 'No encontramos texto en este documento. Puedes escribir el registro.'}
          </p>
          {form(document.ocrText ?? undefined)}
        </>
      ) : null}
    </div>
  )
}
