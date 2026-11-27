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
import { useFetch } from '../../hooks/useFetch'
import { LoadError } from '../../components/layout/LoadError'
import { listHealthEntries } from '../../services/api/healthEntries'
import { listConsultations } from '../../services/api/consultations'
import { createDelegation } from '../../services/api/delegations'
import { CATEGORY_CODES, type DelegationCreated } from '../../types'
import { delegationExpiry } from '../../utils/accessDurations'
import { applyServerErrors } from '../../utils/apiErrors'
import { categoryLabels, formatDateTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { DurationField } from './DurationField'
import { a11yProps } from './fieldProps'
import { Field, FormActions, ServerError } from './fields'

/** Delegar acceso de solo lectura a ciertas categorías, por tiempo limitado (vista /access/:token). */
export function DelegationForm({
  subjectId,
  subjectName,
  onSaved,
  onCancel,
}: {
  subjectId: number
  subjectName: string
  onSaved: (created: DelegationCreated) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<DelegationFormValues, unknown, z.output<typeof delegationSchema>>({
    resolver: zodResolver(delegationSchema),
    defaultValues: emptyDelegation,
    mode: 'onChange',
  })
  const duration = useWatch({ control, name: 'duration' })
  const preview = delegationExpiry(duration).validUntil

  const selected = useWatch({ control, name: 'categoryCodes' })
  const availability = useFetch(async (signal) => {
    const [pages, appointments] = await Promise.all([
      Promise.all(CATEGORY_CODES.map(category => listHealthEntries(subjectId, { category, size: 1 }, signal))),
      listConsultations(subjectId, signal),
    ])
    return {
      categories: CATEGORY_CODES.filter((_, index) => pages[index].content.length > 0),
      appointments: appointments.length > 0,
    }
  }, [subjectId])
  const available = availability.data
  const canCreate = !!available && (available.categories.length > 0 || available.appointments)

  const onSubmit = handleSubmit(async ({ duration, ...values }) => {
    if (!canCreate || availability.loading || availability.error) return
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
    <form onSubmit={onSubmit} noValidate aria-labelledby="delegate-heading" className="grid gap-3 rounded-3xl bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="delegate-heading" className="text-xl font-semibold">Delegar acceso</h2>
        <span className="ml-auto rounded-full bg-primary-tint px-3 py-1 text-sm">{subjectName} · Acceso delegado</span>
      </div>
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

      <DurationField
        id="delegation-duration"
        label="El acceso vence en"
        hint={preview ? `Vence aproximadamente el ${formatDateTime(preview)}. Máximo: 365 días.` : 'El tiempo comienza al crear el acceso. Máximo: 365 días.'}
        error={errors.duration?.amount}
        amountField={register('duration.amount')}
        unitField={register('duration.unit', { deps: ['duration.amount'] })}
        disabled={isSubmitting}
      />

      <fieldset className="grid gap-2" aria-describedby={errors.categoryCodes ? 'delegation-categories-error' : undefined}>
        <legend className="mb-1 text-sm font-semibold">¿Qué podrá ver?</legend>
        <div className="flex flex-wrap gap-2">
          {available?.categories.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 has-checked:border-primary-fg has-checked:bg-primary-tint"
            >
              <input type="checkbox" value={code} className={`accent-primary ${focusRing}`} name="categoryCodes" checked={selected.includes(code)}
                onChange={(event) => setValue('categoryCodes', event.target.checked ? [...selected, code] : selected.filter(value => value !== code), { shouldValidate: true })} />
              {categoryLabels[code].plural}
            </label>
          ))}
          {available?.appointments && <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 has-checked:border-primary-fg has-checked:bg-primary-tint">
            <input
              type="checkbox"
              className={`accent-primary ${focusRing}`}
              {...register('includeConsultations', { deps: ['categoryCodes'] })}
            />
            Citas
          </label>}
        </div>
        {availability.error ? <LoadError message={availability.error} onRetry={availability.reload} /> :
          availability.loading ? <p role="status">Cargando opciones…</p> :
          !canCreate ? <p className="text-sm text-muted">Aún no hay registros ni citas para compartir.</p> : null}
        {errors.categoryCodes ? (
          <p id="delegation-categories-error" role="alert" className="text-sm text-danger">
            {errors.categoryCodes.message}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {available?.appointments && <p className="mr-auto text-sm text-muted">De las citas podrá ver la fecha, la hora y el motivo.</p>}
        <FormActions submitDisabled={!canCreate || availability.loading || !!availability.error} submitting={isSubmitting} submitLabel="Crear acceso" submittingLabel="Creando…" onCancel={onCancel} />
      </div>
    </form>
  )
}
