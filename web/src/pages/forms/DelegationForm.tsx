import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'
import {
  delegationFields,
  delegationSchema,
  emptyDelegation,
  type DelegationFormValues,
} from '../../schemas/delegation'
import { createDelegation } from '../../services/api/delegations'
import { CATEGORY_CODES, type DelegationCreated } from '../../types'
import { delegationExpiry } from '../../utils/accessDurations'
import { applyServerErrors } from '../../utils/apiErrors'
import { categoryLabels, formatDateTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { DurationField } from './DurationField'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, ServerError } from './fields'

/** Delegar acceso de solo lectura a ciertas categorías, por tiempo limitado (vista /access/:token). */
export function DelegationForm({
  subjectId,
  onSaved,
  onCancel,
}: {
  subjectId: number
  onSaved: (created: DelegationCreated) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DelegationFormValues, unknown, z.output<typeof delegationSchema>>({
    resolver: zodResolver(delegationSchema),
    defaultValues: emptyDelegation,
    mode: 'onChange',
  })
  const duration = useWatch({ control, name: 'duration' })
  const preview = delegationExpiry(duration).validUntil

  const onSubmit = handleSubmit(async ({ duration, ...values }) => {
    setServerError(null)
    const expiry = delegationExpiry(duration)
    if (!expiry.validUntil) {
      setError('duration.amount', { message: expiry.error }, { shouldFocus: true })
      return
    }
    try {
      onSaved(await createDelegation(subjectId, { ...values, validUntil: expiry.validUntil }))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, delegationFields, { validUntil: 'duration.amount' }))
    }
  })

  return (
    <FormShell
      title="Delegar acceso"
      description="Para alguien sin cuenta, como una enfermera o un familiar de viaje. Solo verá lo que elijas durante el tiempo que indiques."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="delegation-name" label="Nombre" error={errors.granteeName}>
          <input placeholder="Dr. Pedro Ramos" maxLength={120} autoComplete="off" {...a11yProps('delegation-name', errors.granteeName)} {...register('granteeName')} />
        </Field>
        <Field id="delegation-email" label="Correo" error={errors.granteeEmail}>
          <input
            type="email"
            maxLength={150}
            autoComplete="off"
            {...a11yProps('delegation-email', errors.granteeEmail)}
            {...register('granteeEmail')}
          />
        </Field>
      </div>

      <fieldset className="grid gap-2" aria-describedby={errors.categoryCodes ? 'delegation-categories-error' : undefined}>
        <legend className="mb-1 text-sm font-semibold">¿Qué podrá ver?</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 has-checked:border-primary has-checked:bg-primary-tint"
            >
              <input type="checkbox" value={code} className={`accent-primary ${focusRing}`} {...register('categoryCodes')} />
              {categoryLabels[code].plural}
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 has-checked:border-primary has-checked:bg-primary-tint">
            <input
              type="checkbox"
              className={`accent-primary ${focusRing}`}
              {...register('includeConsultations', { deps: ['categoryCodes'] })}
            />
            Citas
          </label>
        </div>
        <p className="text-sm text-muted">De las citas verá la fecha, la hora y el motivo, pero no las notas.</p>
        {errors.categoryCodes ? (
          <p id="delegation-categories-error" role="alert" className="text-sm text-danger">
            {errors.categoryCodes.message}
          </p>
        ) : null}
      </fieldset>

      <DurationField
        id="delegation-duration"
        label="El acceso vence en"
        hint={preview ? `Vence aproximadamente el ${formatDateTime(preview)}. Máximo: 365 días.` : 'El tiempo comienza al crear el acceso. Máximo: 365 días.'}
        error={errors.duration?.amount}
        amountField={register('duration.amount')}
        unitField={register('duration.unit', { deps: ['duration.amount'] })}
        disabled={isSubmitting}
      />

      <FormActions submitting={isSubmitting} submitLabel="Crear acceso" submittingLabel="Creando…" onCancel={onCancel} />
    </FormShell>
  )
}
