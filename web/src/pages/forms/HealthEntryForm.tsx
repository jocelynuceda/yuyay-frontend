import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { MIN_YEAR, todayIso } from '../../schemas/common'
import {
  EXAM_RESULT,
  emptyHealthEntry,
  healthEntryFields,
  healthEntrySchema,
  healthEntryToForm,
  toUpdateRequest,
  type HealthEntryFormOutput,
  type HealthEntryFormValues,
} from '../../schemas/healthEntry'
import { Button } from '../../components/ui/Button'
import { DatePicker } from '../../components/ui/DatePicker'
import { suggestEntryFromOcr } from '../../utils/ocrSuggestions'
import { uploadAttachment } from '../../services/api/attachments'
import { createHealthEntry, updateHealthEntry } from '../../services/api/healthEntries'
import { CATEGORY_CODES, MEDICATION, type CategoryCode, type HealthEntry } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { ENTRY_ATTACHMENT_ACCEPT, validateEntryAttachment } from '../../utils/attachments'
import { categoryLabels } from '../../utils/format'
import { a11yProps } from './fieldProps'
import { FilePreview } from './FilePreview'
import { useReadAttachment } from './useReadAttachment'
import { ChoiceOption, Field, FormActions, FormShell, ServerError } from './fields'

const HINT_MAX = 80

function suggestionHint(evidence?: string) {
  if (!evidence) return undefined
  const text = evidence.length > HINT_MAX ? `${evidence.slice(0, HINT_MAX).trimEnd()}…` : evidence
  return `Sugerido del documento: "${text}"`
}

function SuggestionHint({ text }: { text: string }) {
  return <p className="text-sm text-muted">{suggestionHint(text)}</p>
}

/**
 * Nuevo registro (sin `entry`) o editar registro (con `entry`): mismos campos.
 * Al editar, la categoría no se puede cambiar. Dosis y frecuencia solo aparecen en medicación.
 */
export function HealthEntryForm({
  subjectId,
  entry,
  initialCategory,
  initialDetails,
  initialValues,
  requireCategoryChoice = false,
  suggestedFields,
  sourceAttachmentId,
  onRegisterApplyOcrText,
  requireDocumentText = false,
  onSaved,
  onCancel,
}: {
  subjectId: number
  entry?: HealthEntry
  /** Categoría preseleccionada al crear (por ejemplo, desde la pestaña filtrada). */
  initialCategory?: CategoryCode
  /** Detalles precargados al crear (por ejemplo, el texto leído de un documento). */
  initialDetails?: string
  /** Valores precargados al crear; tienen prioridad sobre `initialCategory` e `initialDetails`. */
  initialValues?: Partial<HealthEntryFormValues>
  /** Sin categoría elegida al empezar (salvo que `initialValues` la traiga): la persona debe escoger una. */
  requireCategoryChoice?: boolean
  /** Texto del documento que justifica cada campo sugerido; se muestra como pista bajo el campo. */
  suggestedFields?: Partial<Record<'title' | 'categoryCode' | 'occurredOn', string>>
  /** Aplica correcciones solo si la base anterior permanece intacta y no es ambigua. */
  onRegisterApplyOcrText?: (
    apply: (text: string, previous: string) => 'replaced' | 'unchanged' | 'conflict',
  ) => void
  /** Un OCR con texto no se puede guardar sin contenido revisado. */
  requireDocumentText?: boolean
  /** Documento que respalda el registro nuevo. */
  sourceAttachmentId?: number
  /** `entry` es null si se editó sin cambios (no se envía nada). */
  onSaved: (entry: HealthEntry | null) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HealthEntryFormValues, unknown, HealthEntryFormOutput>({
    resolver: zodResolver(healthEntrySchema),
    defaultValues: entry
      ? healthEntryToForm(entry)
      : {
          ...emptyHealthEntry,
          // '' no es una categoría: no marca ninguna opción y falla con 'Elige una categoría.' al guardar
          categoryCode:
            initialCategory ?? (requireCategoryChoice ? ('' as CategoryCode) : emptyHealthEntry.categoryCode),
          details: initialDetails ?? emptyHealthEntry.details,
          ...initialValues,
        },
    mode: 'onChange',
  })
  const categoryCode = useWatch({ control, name: 'categoryCode' })
  const { field: occurredOn } = useController({ control, name: 'occurredOn' })
  const isMedication = categoryCode === MEDICATION
  const isExam = categoryCode === EXAM_RESULT
  const isDocument = sourceAttachmentId !== undefined
  const detailsHint = isDocument
    ? 'Se guardará este registro.'
    : undefined
  // Archivo opcional al crear (foto, PDF o audio), como en la app móvil
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [showFile, setShowFile] = useState(false)
  const [uploaded, setUploaded] = useState<{ file: File; id: number } | null>(null)
  const canAttach = !entry && sourceAttachmentId === undefined

  async function uploadFile() {
    if (!file) return undefined
    // Si el registro falla después de subir el archivo, reintentar no debe subirlo de nuevo
    if (uploaded?.file === file) return uploaded.id
    const { id } = await uploadAttachment(subjectId, file)
    setUploaded({ file, id })
    return id
  }

  const ocr = useReadAttachment(subjectId, uploadFile)
  const canRead = !!file && !file.type.startsWith('audio/')
  // Foto o PDF a la vista: archivo a la izquierda y formulario a la derecha, como al revisar un documento
  const split = canAttach && canRead && showFile

  /** Rellena solo lo que está vacío: lo que escribió la persona no se toca. */
  function fillFromText(text: string) {
    const clean = text.replace(/\r\n?/g, '\n')
    const suggestion = suggestEntryFromOcr(clean)
    const options = { shouldDirty: true, shouldValidate: true }
    if (suggestion.title && !getValues('title').trim()) setValue('title', suggestion.title, options)
    if (suggestion.occurredOn && !getValues('occurredOn')) setValue('occurredOn', suggestion.occurredOn, options)
    if (getValues('details')?.trim()) return 'Ya habías escrito en el resultado, así que no lo reemplazamos.'
    setValue('details', clean, options)
    setValue('confidenceLevel', 'UNCERTAIN', options)
    return 'Copiamos el texto leído. Revísalo con el archivo antes de guardar.'
  }

  useEffect(() => {
    onRegisterApplyOcrText?.((text, previous) => {
      const current = getValues('details')
      if (current.includes(text)) return 'unchanged'
      // Una edición manual nunca se sustituye ni se duplica con otra copia del OCR.
      if (!previous || current.split(previous).length !== 2) return 'conflict'
      setValue('details', current.replace(previous, () => text), { shouldDirty: true, shouldValidate: true })
      return 'replaced'
    })
  }, [onRegisterApplyOcrText, getValues, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    if (requireDocumentText && !values.details?.trim()) {
      setError('details', { type: 'required', message: 'Revisa y conserva el texto del documento, o escribe el contenido que deseas guardar.' }, { shouldFocus: true })
      return
    }
    try {
      if (!entry) {
        const attachmentId = sourceAttachmentId ?? (await uploadFile())
        return onSaved(await createHealthEntry(subjectId, { ...values, sourceAttachmentId: attachmentId }))
      }
      // Cada PATCH crea una versión nueva: si nada cambió, no se envía
      if (!isDirty) return onSaved(null)
      onSaved(await updateHealthEntry(subjectId, entry.id, toUpdateRequest(values)))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, healthEntryFields))
    }
  })

  const categoryField = register('categoryCode', {
    // Al dejar medicación se limpian dosis y frecuencia: el backend las rechaza en otras categorías
    onChange: (event) => {
      if (event.target.value !== MEDICATION) {
        setValue('dose', '', { shouldValidate: true })
        setValue('frequency', '', { shouldValidate: true })
      }
    },
  })

  // El formulario siempre es el segundo hijo: abrir u ocultar el archivo no lo vuelve a montar
  return (
    <div className={split ? 'grid items-start gap-6 lg:grid-cols-2' : 'grid'}>
      {split && file ? (
        <section aria-label="Archivo adjunto" className="min-w-0 rounded-2xl bg-card p-4 lg:sticky lg:top-20">
          <FilePreview file={file} name={file.name} large />
        </section>
      ) : null}
      <FormShell
        title={entry ? 'Editar registro' : 'Nuevo registro'}
        description={
          entry
            ? 'Se guardará como una versión nueva y se avisará a los demás cuidadores.'
            : 'Los demás cuidadores recibirán un aviso.'
        }
        onSubmit={onSubmit}
      >
        <ServerError message={serverError} />

        {entry ? (
          <div className="grid gap-1">
            <span className="text-sm font-semibold">Categoría</span>
            <span className="text-muted">{entry.categoryName}</span>
          </div>
        ) : (
          <fieldset
            className="grid gap-2"
            aria-invalid={!!errors.categoryCode}
            aria-describedby={errors.categoryCode ? 'entry-category-error' : undefined}
          >
            <legend className="text-sm font-semibold">Categoría</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_CODES.map((code) => (
                <ChoiceOption key={code} value={code} {...categoryField}>
                  {categoryLabels[code].name}
                </ChoiceOption>
              ))}
            </div>
            {errors.categoryCode ? (
              <p id="entry-category-error" role="alert" className="text-sm text-danger">
                {errors.categoryCode.message}
              </p>
            ) : suggestedFields?.categoryCode ? (
              <SuggestionHint text={suggestedFields.categoryCode} />
            ) : null}
          </fieldset>
        )}

        <Field
          id="entry-title"
          label={isExam ? 'Nombre del examen' : 'Título'}
          error={errors.title}
          hint={suggestionHint(suggestedFields?.title)}
        >
          <input
            maxLength={150}
            placeholder={isExam ? 'Ej. Hemograma completo' : isMedication ? 'Ej. Losartán 50 mg' : 'Ej. Alergia a la penicilina'}
            {...a11yProps('entry-title', errors.title, suggestionHint(suggestedFields?.title))}
            {...register('title')}
          />
        </Field>

        {isMedication ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="entry-dose" label="Dosis" error={errors.dose}>
              <input
                maxLength={60}
                placeholder="1 tableta"
                {...a11yProps('entry-dose', errors.dose)}
                {...register('dose')}
              />
            </Field>
            <Field id="entry-frequency" label="Frecuencia" error={errors.frequency}>
              <input
                maxLength={60}
                placeholder="Cada 12 h"
                {...a11yProps('entry-frequency', errors.frequency)}
                {...register('frequency')}
              />
            </Field>
          </div>
        ) : null}

        <Field
          id="entry-occurredOn"
          label={isExam ? 'Fecha del examen' : 'Fecha (opcional)'}
          error={errors.occurredOn}
          hint={suggestionHint(suggestedFields?.occurredOn)}
        >
          <DatePicker value={occurredOn.value ?? ''} onChange={occurredOn.onChange} onBlur={occurredOn.onBlur} min={`${MIN_YEAR}-01-01`} max={todayIso()} {...a11yProps('entry-occurredOn', errors.occurredOn, suggestionHint(suggestedFields?.occurredOn))} />
        </Field>

        <Field
          id="entry-details"
          label={isDocument ? (isExam ? 'Resultado / Texto del documento' : 'Texto del documento') : isExam ? 'Resultado (opcional)' : 'Detalles (opcional)'}
          error={errors.details}
          hint={detailsHint}
        >
          <textarea
            rows={isDocument ? 12 : 3}
            {...a11yProps('entry-details', errors.details, detailsHint)}
            {...register('details')}
          />
        </Field>

        {canAttach ? (
          <div className="grid gap-1.5">
            <label htmlFor="entry-file" className="text-sm font-semibold">
              Adjuntar foto, PDF o audio (opcional)
            </label>
            <input
              id="entry-file"
              type="file"
              accept={ENTRY_ATTACHMENT_ACCEPT}
              aria-invalid={!!fileError}
              aria-describedby={fileError ? 'entry-file-error' : 'entry-file-hint'}
              className="peer sr-only"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null
                const problem = picked ? validateEntryAttachment(picked) : null
                setFileError(problem)
                setFile(problem ? null : picked)
                setShowFile(!problem && !!picked && !picked.type.startsWith('audio/'))
                ocr.cancel()
                if (problem) event.target.value = ''
              }}
            />
            {/* El selector nativo casi no se ve y sale en el idioma del navegador: se oculta y esta etiqueta es el botón */}
            <div className="flex flex-wrap items-center gap-3 peer-focus-visible:*:first:outline-3 peer-focus-visible:*:first:outline-offset-2 peer-focus-visible:*:first:outline-primary">
              <label htmlFor="entry-file" className="control-interactive cursor-pointer rounded-full border border-primary-fg bg-card px-5 py-2 text-sm font-semibold text-primary-fg">
                {file ? 'Cambiar archivo' : 'Subir archivo'}
              </label>
              <span className="min-w-0 text-sm text-muted wrap-break-word">{file ? file.name : 'Ningún archivo elegido'}</span>
              {file ? (
                <button type="button" aria-expanded={showFile} className="text-sm font-semibold text-primary-fg underline" onClick={() => setShowFile((value) => !value)}>
                  {showFile ? 'Ocultar archivo' : 'Ver archivo'}
                </button>
              ) : null}
            </div>
            {file && showFile && !split ? <FilePreview file={file} name={file.name} /> : null}
            {canRead ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" className="border border-primary-fg text-primary-fg!" loading={ocr.reading} onClick={() => void ocr.read(fillFromText)}>
                  {ocr.reading ? 'Leyendo…' : 'Leer texto del archivo'}
                </Button>
                {ocr.message ? <p role="status" className="text-sm text-muted">{ocr.message}</p> : null}
              </div>
            ) : null}
            {fileError ? (
              <p id="entry-file-error" role="alert" className="text-sm text-danger">
                {fileError}
              </p>
            ) : (
              <p id="entry-file-hint" className="text-sm text-muted">
                JPG, PNG, PDF o audio M4A o WEBM, hasta 10 MB.
              </p>
            )}
          </div>
        ) : null}

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">¿Qué tan seguro es el dato?</legend>
          <div className="flex flex-wrap gap-2">
            <ChoiceOption value="CONFIRMED" {...register('confidenceLevel')}>
              Confirmado
            </ChoiceOption>
            <ChoiceOption value="UNCERTAIN" {...register('confidenceLevel')}>
              Por confirmar
            </ChoiceOption>
          </div>
        </fieldset>

        <Field id="entry-notes" label="Notas (opcional)" error={errors.notes}>
          <textarea rows={2} maxLength={500} {...a11yProps('entry-notes', errors.notes)} {...register('notes')} />
        </Field>

        <FormActions
          submitting={isSubmitting}
          submitDisabled={ocr.reading}
          submitLabel={entry ? 'Guardar cambios' : 'Registrar'}
          onCancel={onCancel}
        />
      </FormShell>
    </div>
  )
}
