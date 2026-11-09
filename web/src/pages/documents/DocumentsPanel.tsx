import { useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { deleteAttachment, listAttachments, uploadAttachment } from '../../services/api/attachments'
import type { Attachment, OcrStatus } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { DOCUMENT_ACCEPT, documentsOnly, validateDocumentFile } from '../../utils/attachments'
import { formatDate } from '../../utils/format'
import { focusRing, linkClass } from '../../utils/styles'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useSuccessNotice } from '../shared/useSuccessNotice'
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
  const { notify, anchorProps } = useSuccessNotice()
  const { data, error, loading, reload } = useFetch((signal) => listAttachments(subjectId, signal), [subjectId])
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Attachment | null>(null)

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
      void navigate(`/personas/${subjectId}/documentos/${uploaded.id}`)
    } catch (e) {
      setUploadError(getErrorMessage(e))
      setUploading(false)
    }
  }

  // El backend solo deja borrar a quien lo subió o al principal, y no mientras se lee
  const canDelete = (d: Attachment) => d.ocrStatus !== 'PENDING' && (isPrincipal || d.uploadedById === user?.id)

  return (
    <section aria-labelledby="documents-title" className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="documents-title" className="text-2xl font-semibold">
            Documentos
          </h2>
          <p className="mt-1 text-sm text-muted">JPG, PNG o PDF de una página, hasta 10 MB. Leemos el texto por ti.</p>
        </div>
        <Button onClick={() => input.current?.click()} loading={uploading}>
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

      <span {...anchorProps} />

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
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-card p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/personas/${subjectId}/documentos/${d.id}`}
                      className={`${linkClass} break-all`}
                      aria-label={`Revisar ${d.originalFilename}`}
                    >
                      {d.originalFilename}
                    </Link>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {d.uploadedByName} · {formatDate(d.uploadedAt)}
                  </p>
                </div>
                {canDelete(d) ? (
                  <button
                    type="button"
                    onClick={() => setRemoving(d)}
                    aria-label={`Borrar ${d.originalFilename}`}
                    className={`rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
                  >
                    Borrar
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        title="¿Borrar este documento?"
        message={removing ? `${removing.originalFilename}. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Borrar documento"
        cancelLabel="Volver"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await deleteAttachment(subjectId, removing.id)
          notify('Documento borrado.')
          setRemoving(null)
          reload()
        }}
      />
    </section>
  )
}
