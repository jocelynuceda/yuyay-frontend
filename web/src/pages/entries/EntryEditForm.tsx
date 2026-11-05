import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import {
  healthEntryFields,
  healthEntrySchema,
  healthEntryToForm,
  toUpdateRequest,
  type HealthEntryFormOutput,
  type HealthEntryFormValues,
} from '../../schemas/healthEntry'
import { updateHealthEntry } from '../../services/api/healthEntries'
import { MEDICATION, type HealthEntry } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { focusRing } from '../../utils/styles'

/**
 * Editar registro: mismos campos que "nuevo registro". La categoría no se puede cambiar.
 * Validación en tiempo real con Zod y errores por campo devueltos por el backend.
 */
export function EntryEditForm({
  subjectId,
  entry,
  onCancel,
  onSaved,
}: {
  subjectId: number
  entry: HealthEntry
  onCancel: () => void
  /** `changed` es false si no había nada que guardar (no se envía el PATCH). */
  onSaved: (changed: boolean) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HealthEntryFormValues, unknown, HealthEntryFormOutput>({
    resolver: zodResolver(healthEntrySchema),
    defaultValues: healthEntryToForm(entry),
    mode: 'onChange',
  })
  const isMedication = entry.categoryCode === MEDICATION

  const onSubmit = handleSubmit(async (values) => {
    // Cada PATCH crea una versión nueva: si nada cambió, no se envía
    if (!isDirty) return onSaved(false)
    setServerError(null)
    try {
      await updateHealthEntry(subjectId, entry.id, toUpdateRequest(values))
      onSaved(true)
    } catch (error) {
      setServerError(applyServerErrors(error, setError, healthEntryFields))
    }
  })

  const fieldProps = (name: keyof HealthEntryFormValues) => ({
    id: `entry-${name}`,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `entry-${name}-error` : undefined,
    className: inputClass(!!errors[name]),
    ...register(name),
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 rounded-3xl bg-white p-6 sm:p-8" aria-labelledby="edit-title">
      <h2 id="edit-title" className="text-xl font-semibold">
        Editar registro
      </h2>
      <p className="-mt-3 text-sm text-muted">Se guardará como una versión nueva y se avisará a los demás cuidadores.</p>

      {serverError ? (
        <p role="alert" className="rounded-xl bg-danger-bg p-4 text-danger">
          {serverError}
        </p>
      ) : null}

      <div className="grid gap-1">
        <span className="text-sm font-semibold">Categoría</span>
        <span className="text-muted">{entry.categoryName}</span>
      </div>

      <Field name="title" label="Título" error={errors.title?.message}>
        <input maxLength={150} {...fieldProps('title')} />
      </Field>

      {isMedication ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="dose" label="Dosis" error={errors.dose?.message}>
            <input maxLength={60} placeholder="1 tableta" {...fieldProps('dose')} />
          </Field>
          <Field name="frequency" label="Frecuencia" error={errors.frequency?.message}>
            <input maxLength={60} placeholder="Cada 12 h" {...fieldProps('frequency')} />
          </Field>
        </div>
      ) : null}

      <Field name="occurredOn" label="Fecha (opcional)" error={errors.occurredOn?.message}>
        <input type="date" {...fieldProps('occurredOn')} />
      </Field>

      <Field name="details" label="Detalles (opcional)" error={errors.details?.message}>
        <textarea rows={3} {...fieldProps('details')} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">¿Qué tan seguro es el dato?</legend>
        <div className="flex flex-wrap gap-3">
          {(['CONFIRMED', 'UNCERTAIN'] as const).map((level) => (
            <label key={level} className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 has-checked:border-primary">
              <input type="radio" value={level} className={focusRing} {...register('confidenceLevel')} />
              {level === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar'}
            </label>
          ))}
        </div>
      </fieldset>

      <Field name="notes" label="Notas (opcional)" error={errors.notes?.message}>
        <textarea rows={2} {...fieldProps('notes')} />
      </Field>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className={`rounded-xl border border-line px-5 py-2.5 font-semibold ${focusRing}`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white disabled:opacity-60 ${focusRing}`}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={`entry-${name}`} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`entry-${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const inputClass = (invalid: boolean) =>
  `rounded-xl border bg-white px-4 py-2.5 ${invalid ? 'border-danger' : 'border-line'} ${focusRing}`
