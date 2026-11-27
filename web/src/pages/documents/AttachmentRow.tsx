import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'
import { deleteAttachment, renameAttachment } from '../../services/api/attachments'
import type { Attachment } from '../../types'
import { getErrorMessage, getErrorStatus, isAccessLost } from '../../utils/apiErrors'
import { formatDate } from '../../utils/format'
import { focusRing, linkClass } from '../../utils/styles'

const iconButton = `inline-flex size-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-60 motion-safe:transition-colors ${focusRing}`
const neutral = `${iconButton} text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white`
const danger = `${iconButton} bg-red-50 text-red-700 hover:bg-red-200 active:bg-red-300 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 dark:active:bg-red-800`

const extensions: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'application/pdf': ['pdf'],
  'audio/mp4': ['m4a', 'mp4'], 'audio/x-m4a': ['m4a', 'mp4'], 'audio/webm': ['webm'],
}

function editableName(file: Attachment) {
  const name = file.originalFilename
  const dot = name.lastIndexOf('.')
  const allowed = extensions[file.contentType] ?? []
  if (dot >= 0 && allowed.includes(name.slice(dot + 1).toLowerCase())) {
    return { stem: name.slice(0, dot), suffix: name.slice(dot) }
  }
  return { stem: name, suffix: allowed.length ? `.${allowed[0]}` : '' }
}

function focusEditor(input: HTMLInputElement | null) {
  input?.focus()
  input?.select()
}

interface Props {
  file: Attachment
  subjectId: number
  canManage: boolean
  onChanged: (updated?: Attachment) => void
  onAccessLost: () => void
  documentPath?: string
  badges?: ReactNode
  action?: ReactNode
  children?: ReactNode
}

export function AttachmentRow({ file, subjectId, canManage, onChanged, onAccessLost, documentPath, badges, action, children }: Props) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const pencil = useRef<HTMLButtonElement>(null)
  const trash = useRef<HTMLButtonElement>(null)
  const name = file.originalFilename
  const { stem, suffix } = editableName(file)
  const managing = canManage && file.ocrStatus !== 'PENDING'
  const editing = managing && mode === 'rename'
  const confirming = managing && mode === 'delete'

  function cancel() {
    if (pending.current) return
    const trigger = editing ? pencil : trash
    setError('')
    setMode('view')
    requestAnimationFrame(() => trigger.current?.focus())
  }

  async function save(event?: FormEvent) {
    event?.preventDefault()
    if (pending.current || (!editing && !confirming)) return
    if (editing && !draft.trim()) {
      setError('Escribe un nombre para el archivo.')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      if (editing) {
        const updated = await renameAttachment(subjectId, file.id, draft.trim() + suffix)
        onChanged(updated)
      } else {
        await deleteAttachment(subjectId, file.id)
        onChanged()
      }
      setMode('view')
    } catch (cause) {
      setError(getErrorMessage(cause))
      if (isAccessLost(getErrorStatus(cause))) onAccessLost()
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <li className="grid min-w-0 gap-2 rounded-2xl bg-card p-4"
      onKeyDown={(event) => { if (event.key === 'Escape' && (editing || confirming)) cancel() }}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <form className="flex max-w-full flex-wrap items-center gap-1" onSubmit={save}>
                <label className="flex min-w-0 max-w-full items-center gap-1">
                  <span className="sr-only">Nombre del archivo</span>
                  <input ref={focusEditor}
                    className={`w-48 min-w-0 max-w-full rounded-lg border border-line bg-card p-2 ${focusRing}`}
                    value={draft} maxLength={255 - suffix.length} readOnly={busy}
                    onChange={(event) => { setDraft(event.target.value); setError('') }} />
                  <span className="text-sm text-muted">{suffix}</span>
                </label>
                <button className={neutral} type="submit" disabled={busy} aria-label="Guardar nombre" title="Guardar nombre"><Icon name="check" /></button>
                <button className={neutral} type="button" disabled={busy} onClick={cancel} aria-label="Cancelar cambio de nombre" title="Cancelar"><Icon name="x" /></button>
              </form>
            ) : (
              <>
                {documentPath
                  ? <Link to={documentPath} className={`${linkClass} break-all`} aria-label={`Revisar ${name}`}>{name}</Link>
                  : <span className="break-all font-semibold">{name}</span>}
                {managing && <button ref={pencil} type="button" className={neutral} disabled={busy}
                  aria-label={`Cambiar nombre de ${name}`} title="Cambiar nombre"
                  onClick={() => { setDraft(stem); setError(''); setMode('rename') }}><Icon name="pencil" className="size-4" /></button>}
              </>
            )}
            {badges}
          </div>
          <p className="mt-1 text-sm text-muted">{file.uploadedByName} · {formatDate(file.uploadedAt)}</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {action}
          {confirming && <button type="button" disabled={busy} className={`rounded px-1 text-sm text-muted underline ${focusRing}`} onClick={cancel}>Cancelar</button>}
          {managing && !editing && (
            <button ref={trash} type="button" disabled={busy} className={danger}
              aria-label={`${confirming ? 'Confirmar eliminación de' : 'Borrar'} ${name}`}
              title={confirming ? 'Confirmar eliminación' : 'Borrar archivo'}
              onClick={() => { if (confirming) void save(); else { setError(''); setMode('delete') } }}>
              <Icon name={confirming ? 'check' : 'trash'} />
            </button>
          )}
        </div>
      </div>
      {confirming && <p role="status" className="text-right text-sm text-muted">Pulsa el check para borrar el archivo.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {children}
    </li>
  )
}
