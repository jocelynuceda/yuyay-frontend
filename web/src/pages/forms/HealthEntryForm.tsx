import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  emptyHealthEntry,
  healthEntryFields,
  healthEntrySchema,
  healthEntryToForm,
  toUpdateRequest,
  type HealthEntryFormOutput,
  type HealthEntryFormValues,
} from '../../schemas/healthEntry'
import { createHealthEntry, updateHealthEntry } from '../../services/api/healthEntries'
import { CATEGORY_CODES, MEDICATION, type CategoryCode, type HealthEntry } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { categoryLabels } from '../../utils/format'
import { a11yProps } from './fieldProps'
import { ChoiceOption, Field, FormActions, FormShell, ServerError } from './fields'

/**
 * Nuevo registro (sin `entry`) o editar registro (con `entry`): mismos campos.
 * Al editar, la categoría no se puede cambiar. Dosis y frecuencia solo aparecen en medicación.
 */
export function HealthEntryForm({
  subjectId,
  entry,
  initialCategory,
  onSaved,
  onCancel,
}: {
  subjectId: number
  entry?: HealthEntry
  /** Categoría preseleccionada al crear (por ejemplo, desde la pestaña filtrada). */
  initialCategory?: CategoryCode
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
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HealthEntryFormValues, unknown, HealthEntryFormOutput>({
    resolver: zodResolver(healthEntrySchema),
    defaultValues: entry
      ? healthEntryToForm(entry)
      : { ...emptyHealthEntry, categoryCode: initialCategory ?? emptyHealthEntry.categoryCode },
    mode: 'onChange',
  })
  const isMedication = useWatch({ control, name: 'categoryCode' }) === MEDICATION

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      if (!entry) return onSaved(await createHealthEntry(subjectId, values))
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
          ) : null}
        </fieldset>
      )}

      <Field id="entry-title" label="Título" error={errors.title}>
        <input
          maxLength={150}
          placeholder={isMedication ? 'Ej. Losartán 50 mg' : 'Ej. Alergia a la penicilina'}
          {...a11yProps('entry-title', errors.title)}
          {...register('title')}
        />
      </Field>

      {isMedication ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="entry-dose" label="Dosis" error={errors.dose}>
            <input maxLength={60} placeholder="1 tableta" {...a11yProps('entry-dose', errors.dose)} {...register('dose')} />
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

      <Field id="entry-occurredOn" label="Fecha (opcional)" error={errors.occurredOn}>
        <input type="date" {...a11yProps('entry-occurredOn', errors.occurredOn)} {...register('occurredOn')} />
      </Field>

      <Field id="entry-details" label="Detalles (opcional)" error={errors.details}>
        <textarea rows={3} {...a11yProps('entry-details', errors.details)} {...register('details')} />
      </Field>

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
        <textarea rows={2} {...a11yProps('entry-notes', errors.notes)} {...register('notes')} />
      </Field>

      <FormActions submitting={isSubmitting} submitLabel={entry ? 'Guardar cambios' : 'Registrar'} onCancel={onCancel} />
    </FormShell>
  )
}
