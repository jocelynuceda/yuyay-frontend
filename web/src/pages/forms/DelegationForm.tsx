import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { delegationFields, delegationSchema, emptyDelegation, type DelegationFormValues } from '../../schemas/delegation'
import { createDelegation } from '../../services/api/delegations'
import { CATEGORY_CODES, type DelegationCreated } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { categoryLabels } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, ServerError } from './fields'

/** Valor mínimo del <input type="datetime-local">: ahora, en hora local. */
function nowLocal() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Delegar acceso de solo lectura a ciertas categorías, por tiempo limitado (vista /acceso/:token). */
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
    formState: { errors, isSubmitting },
  } = useForm<DelegationFormValues, unknown, z.output<typeof delegationSchema>>({
    resolver: zodResolver(delegationSchema),
    defaultValues: emptyDelegation,
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSaved(await createDelegation(subjectId, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, delegationFields))
    }
  })

  return (
    <FormShell
      title="Delegar acceso"
      description="Para alguien sin cuenta (por ejemplo, una enfermera o un familiar de viaje): solo verá las categorías que elijas, hasta la fecha que indiques."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="delegation-name" label="Nombre" error={errors.granteeName}>
          <input maxLength={120} autoComplete="off" {...a11yProps('delegation-name', errors.granteeName)} {...register('granteeName')} />
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
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 has-checked:border-primary has-checked:bg-primary-tint"
            >
              <input type="checkbox" value={code} className={`accent-primary ${focusRing}`} {...register('categoryCodes')} />
              {categoryLabels[code].plural}
            </label>
          ))}
        </div>
        {errors.categoryCodes ? (
          <p id="delegation-categories-error" className="text-sm text-danger">
            {errors.categoryCodes.message}
          </p>
        ) : null}
      </fieldset>

      <Field id="delegation-until" label="Válido hasta" error={errors.validUntil}>
        <input type="datetime-local" min={nowLocal()} {...a11yProps('delegation-until', errors.validUntil)} {...register('validUntil')} />
      </Field>

      <FormActions submitting={isSubmitting} submitLabel="Crear acceso" submittingLabel="Creando…" onCancel={onCancel} />
    </FormShell>
  )
}
