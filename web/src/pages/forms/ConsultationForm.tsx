import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { DatePicker } from '../../components/ui/DatePicker'
import { TimeInput } from '../../components/ui/TimeInput'
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
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationFormValues, unknown, ConsultationFormOutput>({
    resolver: zodResolver(consultationSchema),
    defaultValues: consultation ? consultationToForm(consultation) : emptyConsultation(),
    mode: 'onChange',
  })

  // Al editar, el botón "Editar" desaparece: el foco pasa al formulario
  useEffect(() => {
    if (editing) document.getElementById('consultation-date')?.focus()
  }, [editing])

  const { field: date } = useController({ control, name: 'date' })
  const { field: time } = useController({ control, name: 'time' })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(
        consultation
          ? await updateConsultation(consultation.id, toConsultationUpdate(values), subjectId)
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

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field id="consultation-date" label="Fecha" error={errors.date}>
          <DatePicker value={date.value} onChange={date.onChange} onBlur={date.onBlur} min={`${MIN_YEAR}-01-01`} max={`${maxYear(2)}-12-31`} {...a11yProps('consultation-date', errors.date)} />
        </Field>
        <Field id="consultation-time" label="Hora (opcional)" error={errors.time}>
          <TimeInput value={time.value} onChange={time.onChange} onBlur={time.onBlur} {...a11yProps('consultation-time', errors.time)} />
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
