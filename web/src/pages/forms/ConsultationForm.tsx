import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { consultationFields, consultationSchema, emptyConsultation, type ConsultationFormValues } from '../../schemas/consultation'
import { createConsultation } from '../../services/api/consultations'
import type { ConsultationDetail } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, ServerError } from './fields'

/** Nueva consulta. La fecha puede ser pasada, de hoy o futura (una cita agendada). */
export function ConsultationForm({
  subjectId,
  onSaved,
  onCancel,
}: {
  subjectId: number
  onSaved: (consultation: ConsultationDetail) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues, unknown, z.output<typeof consultationSchema>>({
    resolver: zodResolver(consultationSchema),
    defaultValues: emptyConsultation(),
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(await createConsultation(subjectId, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, consultationFields))
    }
  })

  return (
    <FormShell title="Nueva consulta" description="Registra una cita próxima o una visita al médico." onSubmit={onSubmit}>
      <ServerError message={serverError} />

      <Field id="consultation-date" label="Fecha" error={errors.date}>
        <input type="date" {...a11yProps('consultation-date', errors.date)} {...register('date')} />
      </Field>

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
        <textarea rows={3} {...a11yProps('consultation-notes', errors.notes, 'hint')} {...register('notes')} />
      </Field>

      <FormActions submitting={isSubmitting} submitLabel="Guardar consulta" onCancel={onCancel} />
    </FormShell>
  )
}
