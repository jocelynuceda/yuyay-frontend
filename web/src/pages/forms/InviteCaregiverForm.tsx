import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import {
  caregiverInviteFields,
  caregiverInviteSchema,
  emptyCaregiverInvite,
  type CaregiverInviteFormValues,
} from '../../schemas/caregiver'
import { inviteCaregiver } from '../../services/api/caregivers'
import type { CareRelationship } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { a11yProps } from './fieldProps'
import { ChoiceOption, Field, FormActions, FormShell, ServerError } from './fields'

/** Invitar cuidador por correo. La persona invitada acepta desde su cuenta. */
export function InviteCaregiverForm({
  subjectId,
  onSaved,
  onCancel,
}: {
  subjectId: number
  onSaved: (relationship: CareRelationship) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CaregiverInviteFormValues, unknown, z.output<typeof caregiverInviteSchema>>({
    resolver: zodResolver(caregiverInviteSchema),
    defaultValues: emptyCaregiverInvite,
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(await inviteCaregiver(subjectId, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, caregiverInviteFields))
    }
  })

  return (
    <FormShell
      title="Invitar cuidador"
      description="Le llegará una invitación; podrá ver y editar los registros cuando la acepte."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <Field id="invite-email" label="Correo" error={errors.email}>
        <input type="email" autoComplete="email" maxLength={150} {...a11yProps('invite-email', errors.email)} {...register('email')} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Rol</legend>
        <div className="flex flex-wrap gap-2">
          <ChoiceOption value="CAREGIVER" {...register('role')}>
            Cuidador/a
          </ChoiceOption>
          <ChoiceOption value="PRINCIPAL" {...register('role')}>
            Principal
          </ChoiceOption>
        </div>
        <p className="text-sm text-muted">El principal también puede invitar, delegar accesos y ver la bitácora.</p>
      </fieldset>

      <Field
        id="invite-label"
        label="Parentesco (opcional)"
        hint="Por ejemplo: hija, sobrino, enfermera."
        error={errors.relationshipLabel}
      >
        <input maxLength={60} {...a11yProps('invite-label', errors.relationshipLabel, 'hint')} {...register('relationshipLabel')} />
      </Field>

      <FormActions submitting={isSubmitting} submitLabel="Enviar invitación" submittingLabel="Enviando…" onCancel={onCancel} />
    </FormShell>
  )
}
