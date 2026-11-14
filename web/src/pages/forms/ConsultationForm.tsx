import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MIN_YEAR, maxYear } from '../../schemas/common'
import {
  consultationFields,
  consultationSchema,
  consultationToForm,
  emptyConsultation,
  toConsultationUpdate,
  type ConsultationFormOutput,
  type ConsultationFormValues,
} from '../../schemas/consultation'
import { createConsultation, updateConsultation } from '../../services/api/consultations'
import type { Consultation, ConsultationDetail } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, ServerError } from './fields'

/** Nueva consulta o, con `consultation`, editar esa. La fecha puede ser pasada, de hoy o futura. */
export function ConsultationForm({
  subjectId,
  consultation,
  onSaved,
  onCancel,
}: {
  subjectId: number
  consultation?: Consultation
  onSaved: (consultation: ConsultationDetail) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const editing = !!consultation
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues, unknown, ConsultationFormOutput>({
    resolver: zodResolver(consultationSchema),
    defaultValues: consultation ? consultationToForm(consultation) : emptyConsultation(),
    mode: 'onChange',
  })

  // Al editar, el botón "Editar" desaparece: el foco pasa al formulario
  useEffect(() => {
    if (editing) setFocus('date')
  }, [editing, setFocus])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(
        consultation
          ? await updateConsultation(consultation.id, toConsultationUpdate(values))
          : await createConsultation(subjectId, values),
      )
    } catch (error) {
      setServerError(applyServerErrors(error, setError, consultationFields))
    }
  })

  return (
    <FormShell
      title={editing ? 'Editar consulta' : 'Nueva consulta'}
      description={editing ? undefined : 'Registra una cita próxima o una visita al médico.'}
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="consultation-date" label="Fecha" error={errors.date}>
          <input type="date" min={`${MIN_YEAR}-01-01`} max={`${maxYear(2)}-12-31`} {...a11yProps('consultation-date', errors.date)} {...register('date')} />
        </Field>
        <Field id="consultation-time" label="Hora (opcional)" error={errors.time}>
          <input type="time" {...a11yProps('consultation-time', errors.time)} {...register('time')} />
        </Field>
      </div>

      <Field id="consultation-reason" label="Motivo" error={errors.reason}>
        <input
          maxLength={200}
          placeholder="Ej. Control de presión"
          {...a11yProps('consultation-reason', errors.reason)}
          {...register('reason')}
        />
      </Field>

      <Field
        id="consultation-notes"
        label="Notas (opcional)"
        hint="Especialidad, clínica, qué llevar, qué dijo el médico…"
        error={errors.notes}
      >
        <textarea rows={3} maxLength={500} {...a11yProps('consultation-notes', errors.notes, 'hint')} {...register('notes')} />
      </Field>

      <FormActions submitting={isSubmitting} submitLabel={editing ? 'Guardar cambios' : 'Guardar consulta'} onCancel={onCancel} />
    </FormShell>
  )
}
