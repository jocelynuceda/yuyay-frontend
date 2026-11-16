import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { uploadAttachment } from '../../services/api/attachments'
import { createHealthEntry, updateHealthEntry } from '../../services/api/healthEntries'
import { CATEGORY_CODES, MEDICATION, type CategoryCode, type HealthEntry } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { ENTRY_ATTACHMENT_ACCEPT, validateEntryAttachment } from '../../utils/attachments'
import { categoryLabels } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { a11yProps } from './fieldProps'
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
  onRegisterAppendDetails,
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
  /** Entrega una función que agrega texto al final de Detalles. */
  onRegisterAppendDetails?: (
    place: (text: string, previous?: string) => 'inserted' | 'replaced' | 'unchanged' | 'appended',
  ) => void
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
  const isMedication = categoryCode === MEDICATION
  const isExam = categoryCode === EXAM_RESULT
  // Archivo opcional al crear (foto, PDF o audio), como en la app móvil
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
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

  useEffect(() => {
    onRegisterAppendDetails?.((text, previous) => {
      const current = getValues('details')
      const options = { shouldDirty: true, shouldValidate: true }
      // Si el bloque anterior sigue intacto, se reemplaza en su lugar
      if (previous && current.includes(previous)) {
        if (previous === text) return 'unchanged'
        setValue(
          'details',
          current.replace(previous, () => text),
          options,
        )
        return 'replaced'
      }
      if (current.includes(text)) return 'unchanged'
      if (!current.trim()) {
        setValue('details', text, options)
        return 'inserted'
      }
      // El bloque anterior se editó a mano: se agrega uno nuevo al final
      setValue('details', `${current}\n\n${text}`, options)
      return previous ? 'appended' : 'inserted'
    })
  }, [onRegisterAppendDetails, getValues, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
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

  return (
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
        <input
          type="date"
          min={`${MIN_YEAR}-01-01`}
          max={todayIso()}
          {...a11yProps('entry-occurredOn', errors.occurredOn, suggestionHint(suggestedFields?.occurredOn))}
          {...register('occurredOn')}
        />
      </Field>

      <Field id="entry-details" label={isExam ? 'Resultado (opcional)' : 'Detalles (opcional)'} error={errors.details}>
        <textarea rows={3} maxLength={2000} {...a11yProps('entry-details', errors.details)} {...register('details')} />
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
            className={`text-sm ${focusRing}`}
            onChange={(event) => {
              const picked = event.target.files?.[0] ?? null
              const problem = picked ? validateEntryAttachment(picked) : null
              setFileError(problem)
              setFile(problem ? null : picked)
              if (problem) event.target.value = ''
            }}
          />
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
        submitLabel={entry ? 'Guardar cambios' : 'Registrar'}
        onCancel={onCancel}
      />
    </FormShell>
  )
}
