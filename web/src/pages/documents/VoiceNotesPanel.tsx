import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { deleteAttachment, getAttachmentContent, listAttachments, uploadAttachment } from '../../services/api/attachments'
import type { Attachment } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { formatDate } from '../../utils/format'
import { focusRing, linkClass } from '../../utils/styles'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useSuccessNotice } from '../../hooks/useSuccessNotice'
import {
  MAX_RECORDING_MINUTES,
  VOICE_FILE_ACCEPT,
  prepareVoiceFile,
  recordVoiceNote,
  recordingUnavailableReason,
  voiceMimeType,
} from './voiceRecording'

interface VoiceNotesPanelProps {
  subjectId: number
  isPrincipal: boolean
}

export function VoiceNotesPanel(props: VoiceNotesPanelProps) {
  // Cambiar de persona descarta la grabación y deja de mostrar los archivos del perfil anterior.
  return <SubjectVoiceNotes key={props.subjectId} {...props} />
}

function SubjectVoiceNotes({ subjectId, isPrincipal }: VoiceNotesPanelProps) {
  const titleId = useId()
  const { user } = useAuth()
  const { notify, anchorProps } = useSuccessNotice()
  const { data, error, loading, reload } = useFetch((signal) => listAttachments(subjectId, signal), [subjectId])
  const [openedId, setOpenedId] = useState<number | null>(null)
  const [removing, setRemoving] = useState<Attachment | null>(null)
  const notes = (data ?? [])
    .filter((attachment) => attachment.contentType.startsWith('audio/'))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
      <div>
        <h2 id={titleId} className="text-2xl font-semibold">Notas de voz</h2>
        <p className="mt-1 text-sm text-muted">
          Graba hasta {MAX_RECORDING_MINUTES} minutos o elige un archivo de audio M4A o WebM de hasta 10 MB.
        </p>
      </div>
      <VoiceNoteComposer subjectId={subjectId} onSaved={() => {
        notify('Nota de voz guardada.')
        reload()
      }} />
      <span {...anchorProps} />

      {error ? (
        <LoadError message={`No pudimos cargar las notas de voz. ${error}`} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton lines={3} />
      ) : notes.length === 0 ? (
        <EmptyState title="Aún no hay notas de voz" description="Graba una nota o sube un audio para esta persona." />
      ) : (
        <ul className="grid gap-3">
          {notes.map((note) => {
            const opened = note.id === openedId
            const canDelete = note.ocrStatus !== 'PENDING' && (isPrincipal || note.uploadedById === user?.id)
            return (
              <li key={note.id} className="grid gap-3 rounded-2xl bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-semibold">{note.originalFilename}</p>
                    <p className="mt-1 text-sm text-muted">{note.uploadedByName} · {formatDate(note.uploadedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={opened}
                      aria-label={`${opened ? 'Cerrar reproductor de' : 'Abrir reproductor de'} ${note.originalFilename}`}
                      onClick={() => setOpenedId(opened ? null : note.id)}
                    >
                      {opened ? 'Cerrar reproductor' : 'Abrir reproductor'}
                    </Button>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => setRemoving(note)}
                        aria-label={`Borrar ${note.originalFilename}`}
                        className={`rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
                      >
                        Borrar
                      </button>
                    ) : null}
                  </div>
                </div>
                {opened ? <SavedVoicePlayer subjectId={subjectId} note={note} /> : null}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        title="¿Borrar esta nota de voz?"
        message={removing ? `${removing.originalFilename}. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Borrar nota de voz"
        cancelLabel="Volver"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await deleteAttachment(subjectId, removing.id)
          setOpenedId((id) => id === removing.id ? null : id)
          setRemoving(null)
          notify('Nota de voz borrada.')
          reload()
        }}
      />
    </section>
  )
}

interface VoiceCapture {
  controller: AbortController
  stop?: () => void
}

function VoiceNoteComposer({ subjectId, onSaved }: { subjectId: number; onSaved: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const capture = useRef<VoiceCapture | null>(null)
  const [recording, setRecording] = useState<'idle' | 'requesting' | 'recording' | 'stopping'>('idle')
  const [draft, setDraft] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unavailable = recordingUnavailableReason()

  useEffect(() => () => capture.current?.controller.abort(), [])

  async function startRecording() {
    if (capture.current) return
    const request: VoiceCapture = { controller: new AbortController() }
    capture.current = request
    setError(null)
    setRecording('requesting')
    try {
      const file = await recordVoiceNote(request.controller.signal, (stop) => {
        request.stop = stop
        setRecording('recording')
      })
      if (file && !request.controller.signal.aborted) setDraft(file)
    } catch (cause) {
      if (!request.controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'No pudimos grabar el audio.')
      }
    } finally {
      if (capture.current === request && !request.controller.signal.aborted) {
        capture.current = null
        setRecording('idle')
      }
    }
  }

  function discard() {
    capture.current?.controller.abort()
    capture.current = null
    setRecording('idle')
    setDraft(null)
    setError(null)
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setError(null)
    try {
      setDraft(prepareVoiceFile(file))
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
    }
  }

  async function save() {
    if (!draft || uploading) return
    setUploading(true)
    setError(null)
    try {
      await uploadAttachment(subjectId, draft)
      setDraft(null)
      onSaved()
    } catch (cause) {
      setError(`No pudimos guardar la nota de voz. ${getErrorMessage(cause)}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl bg-card p-4">
      {recording === 'idle' && !draft ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startRecording} disabled={!!unavailable}>Grabar nota de voz</Button>
            <Button variant="secondary" onClick={() => input.current?.click()}>Elegir archivo de audio</Button>
          </div>
          <input
            ref={input}
            type="file"
            accept={VOICE_FILE_ACCEPT}
            onChange={chooseFile}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
          {unavailable ? <p className="text-sm text-muted">{unavailable}</p> : null}
        </>
      ) : null}

      {recording !== 'idle' ? (
        <>
          <p role="status" className="text-sm font-semibold">
            {recording === 'requesting' ? 'Esperando permiso del micrófono…' :
              recording === 'recording' ? 'Grabando…' : 'Preparando el audio…'}
          </p>
          <div className="flex flex-wrap gap-2">
            {recording === 'recording' ? (
              <Button onClick={() => {
                setRecording('stopping')
                capture.current?.stop?.()
              }}>Detener grabación</Button>
            ) : null}
            <Button variant="secondary" onClick={discard}>Cancelar grabación</Button>
          </div>
        </>
      ) : null}

      {draft ? (
        <>
          <p className="break-all text-sm font-semibold">Vista previa · {draft.name}</p>
          <VoicePlayer blob={draft} name="Vista previa de la nota de voz" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={uploading}>{uploading ? 'Subiendo…' : 'Guardar nota de voz'}</Button>
            <Button variant="secondary" onClick={discard} disabled={uploading}>Descartar audio</Button>
          </div>
        </>
      ) : null}

      {error ? <p role="alert" className="rounded-xl bg-danger-bg p-3 text-danger">{error}</p> : null}
    </div>
  )
}

function SavedVoicePlayer({ subjectId, note }: { subjectId: number; note: Attachment }) {
  const { data, error, loading, reload } = useFetch(async (signal) => {
    const blob = await getAttachmentContent(subjectId, note.id, signal)
    const type = voiceMimeType(note.contentType)
    return type && blob.type !== type ? new Blob([blob], { type }) : blob
  }, [subjectId, note.id, note.contentType])

  if (error) return <LoadError message={`No pudimos abrir el audio. ${error}`} onRetry={reload} />
  if (loading || !data) return <p role="status" className="text-sm text-muted">Cargando audio…</p>
  if (!data.size) return <LoadError message="No recibimos el contenido del audio." onRetry={reload} />
  return <VoicePlayer blob={data} name={note.originalFilename} download />
}

function VoicePlayer({ blob, name, download = false }: { blob: Blob; name: string; download?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const downloadLink = useRef<HTMLAnchorElement>(null)
  const [playbackError, setPlaybackError] = useState(false)
  useEffect(() => {
    const player = audio.current
    if (!player) return
    const link = downloadLink.current
    const objectUrl = URL.createObjectURL(blob)
    player.src = objectUrl
    if (link) link.href = objectUrl
    return () => {
      player.pause()
      player.removeAttribute('src')
      player.load()
      URL.revokeObjectURL(objectUrl)
    }
  }, [blob])

  return (
    <div className="grid justify-items-start gap-2">
      <audio
        ref={audio}
        aria-label={name}
        className="w-full max-w-md"
        controls
        preload="metadata"
        onLoadStart={() => setPlaybackError(false)}
        onError={() => setPlaybackError(true)}
      />
      {playbackError ? <p role="alert" className="text-sm text-danger">El navegador no pudo reproducir este audio.</p> : null}
      {download ? <a ref={downloadLink} download={name} className={linkClass}>Descargar audio</a> : null}
    </div>
  )
}
