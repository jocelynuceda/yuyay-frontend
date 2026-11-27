import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { DocumentScopeBadge } from '../../components/DocumentScopeBadge'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { AttachmentRow } from './AttachmentRow'
import { useAttachmentList } from './useAttachmentList'
import { uploadAttachment } from '../../services/api/attachments'
import type { OcrStatus } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { DOCUMENT_ACCEPT, documentsOnly, validateDocumentFile } from '../../utils/attachments'
import { useToast } from '../../hooks/useToast'
import { useOcrPolling } from './useOcrPolling'

const ocrBadges: Record<OcrStatus, { label: string; tone: 'soft' | 'accent' | 'danger' }> = {
  PENDING: { label: 'Leyendo…', tone: 'soft' },
  DONE: { label: 'Listo', tone: 'accent' },
  FAILED: { label: 'Sin leer', tone: 'danger' },
}

/** Pestaña "Documentos" del detalle de persona: subir recetas o exámenes y ver cómo va su lectura. */
export function DocumentsPanel({ subjectId, isPrincipal }: { subjectId: number; isPrincipal: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const uploadButton = useRef<HTMLButtonElement>(null)
  const { data, error, loading, reload, applyChange } = useAttachmentList(subjectId)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const documents = data ? documentsOnly(data) : []
  useOcrPolling(documents.some((d) => d.ocrStatus === 'PENDING'), reload)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite volver a elegir el mismo archivo después de un error
    event.target.value = ''
    if (!file) return
    const invalid = validateDocumentFile(file)
    setUploadError(invalid)
    if (invalid) return
    setUploading(true)
    try {
      const uploaded = await uploadAttachment(subjectId, file)
      void navigate(`/people/${subjectId}/documents/${uploaded.id}`)
    } catch (e) {
      setUploadError(getErrorMessage(e))
      setUploading(false)
    }
  }

  return (
    <section aria-labelledby="documents-title" className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="documents-title" className="text-2xl font-semibold">
            Documentos
          </h2>
          <p className="mt-1 text-sm text-muted">JPG, PNG o PDF de una página, hasta 10 MB. Leemos el texto por ti.</p>
        </div>
        <Button ref={uploadButton} onClick={() => input.current?.click()} loading={uploading}>
          {uploading ? 'Subiendo…' : 'Subir documento'}
        </Button>
        <input
          ref={input}
          type="file"
          accept={DOCUMENT_ACCEPT}
          onChange={handleFile}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {uploadError ? (
        <p role="alert" className="rounded-2xl bg-danger-bg p-4 text-danger">
          {uploadError}
        </p>
      ) : null}

      {error && !data ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton lines={3} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<Icon name="file" className="h-10 w-10" />}
          title="Aún no hay documentos"
          description="Sube una receta o un examen y crea un registro con el texto que leamos."
        />
      ) : (
        <ul className="grid gap-3">
          {documents.map((d) => {
            const badge = ocrBadges[d.ocrStatus]
            return (
              <AttachmentRow key={d.id} file={d} subjectId={subjectId}
                canManage={isPrincipal || d.uploadedById === user?.id}
                documentPath={`/people/${subjectId}/documents/${d.id}`}
                badges={<><Badge tone={badge.tone}>{badge.label}</Badge><DocumentScopeBadge label={d.scopeLabel} /></>}
                onAccessLost={reload}
                focusUpload={() => uploadButton.current?.focus()}
                onChanged={(updated) => {
                  applyChange(d.id, updated)
                  toast.success(updated ? 'Nombre guardado.' : 'Documento borrado.')
                }}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}
