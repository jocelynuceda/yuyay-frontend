import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { useFetch } from '../../hooks/useFetch'
import { useMedicalTermMatcher } from '../../hooks/useMedicalTermMatcher'
import { useToast } from '../../hooks/useToast'
import { getAttachment, getAttachmentContent, openAttachment, retryAttachmentOcr } from '../../services/api/attachments'
import type { HealthEntryFormValues } from '../../schemas/healthEntry'
import type { HealthEntry } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { isImage } from '../../utils/attachments'
import { applyAcceptedMatches, type TermMatch } from '../../utils/medicalTermMatcher'
import { suggestEntryFromOcr, type OcrSuggestion } from '../../utils/ocrSuggestions'
import { linkClass } from '../../utils/styles'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import { useOcrPolling } from './useOcrPolling'

const isPdf = (attachment: { contentType: string }) => attachment.contentType === 'application/pdf'

/** El archivo es privado: se pide con la sesión y se muestra desde una URL local. */
function DocumentPreview({
  subjectId,
  attachmentId,
  name,
  pdf,
}: {
  subjectId: number
  attachmentId: number
  name: string
  pdf: boolean
}) {
  const [zoomed, setZoomed] = useState(false)
  const { data: url, loading } = useFetch(
    async (signal) => URL.createObjectURL(await getAttachmentContent(subjectId, attachmentId, signal)),
    [subjectId, attachmentId],
  )
  useEffect(() => {
    if (url) return () => URL.revokeObjectURL(url)
  }, [url])

  if (!url) return loading ? <Skeleton lines={6} /> : null
  if (pdf) {
    return (
      <iframe title={`Vista previa de ${name}`} src={url} className="h-[75vh] w-full rounded-xl border border-line" />
    )
  }
  return (
    <div className="grid gap-3">
      <img src={url} alt={`Vista previa de ${name}`} className="max-h-[75vh] w-full rounded-xl object-contain" />
      <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => setZoomed(true)}>
        Ampliar
      </Button>
      <Modal open={zoomed} onClose={() => setZoomed(false)} title={name} className="w-[min(72rem,calc(100%-2rem))]!">
        <div className="max-h-[75vh] overflow-auto">
          <img src={url} alt={`Documento ampliado: ${name}`} className="max-w-none" />
        </div>
      </Modal>
    </div>
  )
}

type Decision = 'accepted' | 'rejected'
type Decisions = Record<string, Decision | undefined>

const matchKey = (match: TermMatch) => `${match.lineIndex}:${match.original}`

/** Medicamentos y dispositivos hallados en la receta. Las correcciones solo se usan si el cuidador las acepta. */
function DetectedTermsSection({
  matches,
  decisions,
  onDecide,
  pendingCount,
  outdated,
  upToDate,
  onApply,
}: {
  matches: TermMatch[]
  decisions: Decisions
  onDecide: (key: string, decision: Decision | undefined) => void
  pendingCount: number
  outdated: boolean
  upToDate: boolean
  onApply: () => void
}) {
  const pending = pendingCount > 0 || outdated
  return (
    <section aria-labelledby="detected-terms-title" className="grid gap-3 rounded-2xl bg-card p-4">
      <h2 id="detected-terms-title" className="text-xl font-semibold">
        Medicamentos y dispositivos detectados
      </h2>
      <p className="text-muted">
        Revisa cada sugerencia con la imagen. Solo se usan las que aceptes, al aplicarlas a Detalles.
      </p>
      <ul className="grid gap-3">
        {matches.map((match) => {
          const key = matchKey(match)
          if (match.kind === 'known') {
            return (
              <li key={key}>
                <span aria-hidden="true">✓</span> {match.term} <span className="sr-only">reconocido</span>
              </li>
            )
          }
          const decision = decisions[key]
          return (
            <li key={key} className="flex flex-wrap items-center gap-3">
              <span>
                {match.original} → ¿{match.term}?
              </span>
              {decision ? (
                <>
                  <span className="font-semibold">{decision === 'accepted' ? 'Aceptado' : 'Descartado'}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Deshacer decisión sobre ${match.term}`}
                    onClick={() => onDecide(key, undefined)}
                  >
                    Deshacer
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    aria-label={`Aceptar ${match.term} en lugar de ${match.original}`}
                    onClick={() => onDecide(key, 'accepted')}
                  >
                    Aceptar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Descartar sugerencia ${match.term}`}
                    onClick={() => onDecide(key, 'rejected')}
                  >
                    Descartar
                  </Button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {pending ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-tint p-3 text-accent-text">
          <span>
            {outdated
              ? 'Cambiaste las correcciones después de aplicarlas. Actualiza Detalles.'
              : pendingCount === 1
                ? '1 corrección aceptada sin aplicar a Detalles.'
                : `${pendingCount} correcciones aceptadas sin aplicar a Detalles.`}
          </span>
          <Button size="sm" onClick={onApply}>
            {outdated ? 'Actualizar Detalles' : 'Aplicar a Detalles'}
          </Button>
        </div>
      ) : upToDate ? (
        <p className="text-sm text-muted">Detalles ya incluye las correcciones aceptadas.</p>
      ) : null}
    </section>
  )
}

/** Texto completo de la lectura, para consultarlo o copiarlo a Detalles. */
function OcrTextSection({ text, onAppend }: { text: string; onAppend: () => void }) {
  const toast = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Texto copiado.')
    } catch {
      toast.error('No pudimos copiar el texto. Selecciónalo y cópialo a mano.')
    }
  }

  return (
    <details className="rounded-2xl bg-card p-4">
      <summary className="cursor-pointer font-semibold">Texto leído del documento</summary>
      <div className="mt-3 grid gap-3">
        <pre className="max-h-[60vh] overflow-auto rounded-xl border border-line p-3 text-base whitespace-pre-wrap break-words">
          {text}
        </pre>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={onAppend}>
            Copiar a Detalles
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            Copiar
          </Button>
        </div>
      </div>
    </details>
  )
}

/** Muestra cómo va la lectura de un documento y permite convertir el texto en un registro. */
export function DocumentReviewPage({ subjectId, attachmentId }: { subjectId: number; attachmentId: number }) {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    data: document,
    error,
    errorStatus,
    loading,
    reload,
  } = useFetch((signal) => getAttachment(subjectId, attachmentId, signal), [subjectId, attachmentId])
  const [writingByHand, setWritingByHand] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [opening, setOpening] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  useOcrPolling(document?.ocrStatus === 'PENDING', reload)
  type PlaceDetails = (text: string, previous?: string) => 'inserted' | 'replaced' | 'unchanged' | 'appended'
  const appendDetails = useRef<PlaceDetails | null>(null)
  const registerAppendDetails = useCallback((fn: PlaceDetails) => {
    appendDetails.current = fn
  }, [])
  const done = document?.ocrStatus === 'DONE'
  const ocrText = document?.ocrText ?? ''
  const suggestion = useMemo(() => (done ? suggestEntryFromOcr(ocrText) : null), [done, ocrText])
  const matcher = useMedicalTermMatcher()
  const matches = useMemo(
    () => (done && ocrText && matcher ? matcher.findInText(ocrText) : []),
    [done, ocrText, matcher],
  )
  const [decisionState, setDecisionState] = useState<{
    forText: string
    values: Decisions
  }>({
    forText: ocrText,
    values: {},
  })
  const decisions = decisionState.forText === ocrText ? decisionState.values : {}
  const acceptedSuggestions = matches.filter((m) => m.kind === 'suggestion' && decisions[matchKey(m)] === 'accepted')
  function decide(key: string, decision: Decision | undefined) {
    setDecisionState({
      forText: ocrText,
      values: { ...decisions, [key]: decision },
    })
  }

  // Último bloque puesto en Detalles; se reinicia si cambia el texto leído
  const [insertedState, setInsertedState] = useState<{ forText: string; value: string | null }>({
    forText: ocrText,
    value: null,
  })
  const inserted = insertedState.forText === ocrText ? insertedState.value : null
  const corrected = applyAcceptedMatches(ocrText, acceptedSuggestions)
  const pendingCount = inserted === null ? acceptedSuggestions.length : 0
  const outdated = inserted !== null && inserted !== corrected
  const upToDate = inserted !== null && inserted === corrected && acceptedSuggestions.length > 0

  function placeDetails() {
    const result = appendDetails.current?.(corrected, inserted ?? undefined)
    if (!result) return
    setInsertedState({ forText: ocrText, value: corrected })
    if (result === 'inserted') toast.success('Texto copiado a Detalles.')
    else if (result === 'replaced') toast.success('Detalles actualizado con las correcciones.')
    else if (result === 'unchanged') toast.success('Detalles ya tiene este texto.')
    else if (result === 'appended')
      toast.info('Editaste el texto en Detalles, así que agregamos la versión corregida al final.')
  }

  const backToDocuments = `/people/${subjectId}?tab=documents`

  if (error && !document) return <LoadError message={error} status={errorStatus} onRetry={reload} />
  if (loading && !document) return <Skeleton lines={4} />
  if (!document) return null

  async function open() {
    setOpening(true)
    setActionError(null)
    try {
      const opened = await openAttachment(subjectId, attachmentId)
      if (!opened)
        setActionError('Tu navegador bloqueó la pestaña nueva. Permite las ventanas emergentes e inténtalo de nuevo.')
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
    void navigate(`/people/${subjectId}/entries/${entry.id}`)
  }

  const hasSuggestions = !!suggestion && !!(suggestion.title || suggestion.categoryCode || suggestion.occurredOn)

  const form = (initialValues: Partial<HealthEntryFormValues>, suggestedFields?: OcrSuggestion['evidence']) => (
    <HealthEntryForm
      subjectId={subjectId}
      initialValues={initialValues}
      requireCategoryChoice
      suggestedFields={suggestedFields}
      sourceAttachmentId={attachmentId}
      onRegisterAppendDetails={registerAppendDetails}
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

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {isImage(document) || isPdf(document) ? (
          <section aria-label="Documento" className="min-w-0 rounded-2xl bg-card p-4 lg:sticky lg:top-20">
            <DocumentPreview
              subjectId={subjectId}
              attachmentId={attachmentId}
              name={document.originalFilename}
              pdf={isPdf(document)}
            />
          </section>
        ) : null}
        <div className="grid min-w-0 gap-6">
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
          {document.ocrStatus === 'FAILED' && writingByHand ? form({ confidenceLevel: 'UNCERTAIN' }) : null}

          {document.ocrStatus === 'DONE' && suggestion ? (
            <>
              <p className="rounded-2xl bg-accent-tint p-4 text-accent-text">
                {!document.ocrText
                  ? 'No encontramos texto en este documento. Puedes escribir el registro.'
                  : hasSuggestions
                    ? 'Sugerimos algunos campos a partir del documento. Revísalos con la imagen antes de guardar.'
                    : 'No pudimos sugerir campos. Completa el registro mirando el documento.'}
              </p>
              {document.ocrText && matches.length > 0 ? (
                <DetectedTermsSection
                  matches={matches}
                  decisions={decisions}
                  onDecide={decide}
                  pendingCount={pendingCount}
                  outdated={outdated}
                  upToDate={upToDate}
                  onApply={placeDetails}
                />
              ) : null}
              {document.ocrText ? <OcrTextSection text={document.ocrText} onAppend={placeDetails} /> : null}
              {form(
                {
                  title: suggestion.title,
                  categoryCode: suggestion.categoryCode,
                  occurredOn: suggestion.occurredOn,
                  confidenceLevel: 'UNCERTAIN',
                  details: '',
                },
                suggestion.evidence,
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
