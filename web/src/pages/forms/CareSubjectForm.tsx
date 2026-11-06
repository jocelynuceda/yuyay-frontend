import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import {
  careSubjectFields,
  careSubjectSchema,
  careSubjectToForm,
  emptyCareSubject,
  type CareSubjectFormValues,
} from '../../schemas/careSubject'
import { createCareSubject, updateCareSubject } from '../../services/api/careSubjects'
import type { CareSubject } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { yesterdayIso } from '../../schemas/common'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, ServerError } from './fields'

/** Nueva persona (sin `subject`) o editar persona (con `subject`). Pensado para ir dentro de un modal. */
export function CareSubjectForm({
  subject,
  onSaved,
  onCancel,
}: {
  subject?: CareSubject
  onSaved: (subject: CareSubject) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CareSubjectFormValues, unknown, z.output<typeof careSubjectSchema>>({
    resolver: zodResolver(careSubjectSchema),
    defaultValues: subject ? careSubjectToForm(subject) : emptyCareSubject,
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(subject ? await updateCareSubject(subject.id, values) : await createCareSubject(values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, careSubjectFields))
    }
  })

  return (
    <FormShell
      title={subject ? 'Editar persona' : 'Agregar persona'}
      description="La persona a la que cuidan. Solo el nombre es obligatorio."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <Field id="subject-name" label="Nombre" error={errors.name}>
        <input autoComplete="off" maxLength={120} {...a11yProps('subject-name', errors.name)} {...register('name')} />
      </Field>

      <Field id="subject-birthDate" label="Fecha de nacimiento (opcional)" error={errors.birthDate}>
        <input type="date" max={yesterdayIso()} {...a11yProps('subject-birthDate', errors.birthDate)} {...register('birthDate')} />
      </Field>

      <Field
        id="subject-notes"
        label="Notas (opcional)"
        hint="Lo que conviene saber de un vistazo: idioma, movilidad, contacto de emergencia…"
        error={errors.notes}
      >
        <textarea rows={3} {...a11yProps('subject-notes', errors.notes, 'hint')} {...register('notes')} />
      </Field>

      <FormActions
        submitting={isSubmitting}
        submitLabel={subject ? 'Guardar cambios' : 'Agregar persona'}
        onCancel={onCancel}
      />
    </FormShell>
  )
}
