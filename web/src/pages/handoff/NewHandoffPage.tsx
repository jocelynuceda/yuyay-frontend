import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import type { z } from 'zod'
import { emptyHandoff, handoffFields, handoffSchema, handoffStepFields, type HandoffFormValues } from '../../schemas/handoff'
import { createHandoff } from '../../services/api/handoffs'
import { listHealthEntries } from '../../services/api/healthEntries'
import { CATEGORY_CODES, type ErrorResponse, type HandoffDetail, type HealthEntry } from '../../types'
import { applyServerErrors, getErrorMessage } from '../../utils/apiErrors'
import { createAttemptKey } from '../../utils/attemptKey'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { collectPages } from '../../utils/pagination'
import { focusRing } from '../../utils/styles'
import { a11yProps } from '../forms/fieldProps'
import { Field, ServerError } from '../forms/fields'
import { HandoffLinkStep } from './HandoffLinkStep'

const steps = ['Elegir registros', 'Motivo y preguntas', 'Revisar'] as const

type HandoffControl = Control<HandoffFormValues, unknown, z.output<typeof handoffSchema>>

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; entries: HealthEntry[] }

/**
 * Nuevo traspaso (/people/:id/handoff/new): 1. elegir registros, 2. motivo y preguntas,
 * 3. revisar. Al crearlo, ofrece generar el enlace temporal para el médico.
 */
export function NewHandoffPage({ subjectId, subjectName }: { subjectId: number; subjectName?: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<HandoffDetail | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [needsReview, setNeedsReview] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [attemptKey] = useState(() => createAttemptKey(() => crypto.randomUUID()))
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    trigger,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<HandoffFormValues, unknown, z.output<typeof handoffSchema>>({
    resolver: zodResolver(handoffSchema),
    defaultValues: emptyHandoff,
    mode: 'onChange',
  })

  useEffect(() => {
    let active = true
    collectPages((page) => listHealthEntries(subjectId, { page, size: 100, sort: 'createdAt,desc' }))
      .then((entries) => {
        if (!active) return
        const available = entries.filter((e) => !e.deletedAt)
        setLoaded({ status: 'ready', entries: available })
        setValue('healthEntryIds', getValues('healthEntryIds').filter((id) => available.some((e) => e.id === id)))
        setNeedsReview(false)
      })
      .catch((error) => active && setLoaded({ status: 'error', message: getErrorMessage(error) }))
    return () => {
      active = false
    }
  }, [subjectId, reloadKey, getValues, setValue])

  async function next() {
    if (await trigger(handoffStepFields[step])) setStep((s) => s + 1)
  }

  const onSubmit = handleSubmit(async (values) => {
    if (needsReview || loaded.status !== 'ready') return
    setServerError(null)
    try {
      const expectedVersionIds = Object.fromEntries(
        loaded.entries.filter((e) => values.healthEntryIds.includes(e.id)).map((e) => [e.id, e.latestVersion.id]),
      )
      const request = { ...values, healthEntryIds: [...values.healthEntryIds].sort((a, b) => a - b), expectedVersionIds }
      setCreated(await createHandoff(subjectId, { ...request, requestId: attemptKey(request) }))
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setNeedsReview(true)
        setServerError('Un registro cambió mientras preparabas el resumen. Actualiza los registros y revisa el contenido antes de crearlo.')
        return
      }
      setServerError(applyServerErrors(error, setError, handoffFields))
      // Si el backend marca un campo, volver al paso donde está
      const failed = axios.isAxiosError<ErrorResponse>(error) ? (error.response?.data?.fieldErrors ?? []) : []
      const failedStep = handoffStepFields.findIndex((fields) => fields.some((f) => failed.some((e) => e.field === f)))
      if (failedStep >= 0) setStep(failedStep)
    }
  })

  if (created) return <HandoffLinkStep handoff={created} subjectName={subjectName} />
  if (loaded.status === 'loading') return <p className="p-6 text-muted">Cargando registros…</p>
  if (loaded.status === 'error') {
    return (
      <div className="grid gap-3">
        <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">{loaded.message}</p>
        <button type="button" className={`justify-self-start font-semibold text-primary-fg underline ${focusRing}`}
          onClick={() => { setLoaded({ status: 'loading' }); setReloadKey((key) => key + 1) }}>
          Reintentar carga de registros
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-semibold">Nuevo resumen</h1>
        {subjectName ? <p className="mt-1 text-muted">{subjectName}</p> : null}
      </header>

      <Stepper current={step} />

      <form onSubmit={onSubmit} noValidate className="grid gap-6 rounded-3xl bg-card p-6 sm:p-8">
        <ServerError message={serverError} />
        {needsReview ? (
          <button type="button" className={`justify-self-start font-semibold text-primary-fg underline ${focusRing}`}
            onClick={() => { setStep(0); setLoaded({ status: 'loading' }); setReloadKey((key) => key + 1); setServerError(null) }}>
            Actualizar registros y revisar
          </button>
        ) : null}

        {step === 0 ? (
          <EntryPicker
            entries={loaded.entries}
            control={control}
            onChange={(ids) => setValue('healthEntryIds', ids, { shouldValidate: true, shouldDirty: true })}
            error={errors.healthEntryIds?.message}
          />
        ) : null}

        {step === 1 ? (
          <>
            <SelectedContent entries={loaded.entries} control={control} />
            <p className="text-sm text-muted">El contenido de los registros ya está incluido arriba. Añade el motivo de esta consulta y tus preguntas; no necesitas volver a copiar el texto del documento.</p>
            <Field id="handoff-reason" label="Motivo de la consulta" error={errors.reason}>
              <textarea
                rows={3}
                maxLength={200}
                placeholder="Ej. Control de presión y dolor de rodilla"
                {...a11yProps('handoff-reason', errors.reason)}
                {...register('reason')}
              />
            </Field>
            <Field
              id="handoff-questions"
              label="Preguntas para el médico (opcional)"
              hint="Una por línea. El médico las verá junto al resumen."
              error={errors.questions}
            >
              <textarea rows={4} maxLength={500} {...a11yProps('handoff-questions', errors.questions, 'hint')} {...register('questions')} />
            </Field>
          </>
        ) : null}

        {step === 2 ? <Review entries={loaded.entries} control={control} onEdit={setStep} /> : null}

        <div className="flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0 || isSubmitting}
            className={`rounded-xl border border-line px-5 py-2.5 font-semibold disabled:invisible ${focusRing}`}
          >
            Atrás
          </button>
          {step < steps.length - 1 ? (
            // `key` distinto: si React reutilizara el mismo botón, el clic en "Siguiente" enviaría el formulario
            <button
              key="next"
              type="button"
              onClick={next}
              disabled={needsReview}
              className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
            >
              Siguiente
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={isSubmitting || needsReview}
              className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white disabled:opacity-60 ${focusRing}`}
            >
              {isSubmitting ? 'Creando…' : 'Crear resumen'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`rounded-2xl border-2 px-3 py-2 text-sm ${
              state === 'current' ? 'border-primary-fg bg-card' : state === 'done' ? 'border-accent bg-card' : 'border-transparent bg-card/60 text-muted'
            }`}
          >
            <span className="block font-semibold">
              {state === 'done' ? '✓ ' : `${index + 1}. `}
              <span className="sr-only">{state === 'done' ? 'Completado: ' : ''}</span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Paso 1: casillas por registro y una casilla por categoría para marcar todos. */
function EntryPicker({
  entries,
  control,
  onChange,
  error,
}: {
  entries: HealthEntry[]
  control: HandoffControl
  onChange: (ids: number[]) => void
  error?: string
}) {
  const selected = useWatch({ control, name: 'healthEntryIds' })
  const isSelected = (id: number) => selected.includes(id)
  const toggle = (ids: number[], on: boolean) =>
    onChange(on ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))

  const groups = CATEGORY_CODES.map((code) => ({ code, items: entries.filter((e) => e.categoryCode === code) })).filter(
    (g) => g.items.length > 0,
  )

  if (groups.length === 0) {
    return <p className="text-muted">Esta persona aún no tiene registros. Agrega alguno antes de crear el resumen.</p>
  }

  return (
    <fieldset className="grid gap-5" aria-describedby={error ? 'pick-error' : 'pick-hint'}>
      <legend className="mb-2 text-xl font-semibold">¿Qué registros quieres compartir?</legend>
      <p id="pick-hint" className="text-sm text-muted">
        {selected.length} seleccionado{selected.length === 1 ? '' : 's'}. El médico solo verá lo que marques.
      </p>
      {error ? (
        <p id="pick-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {groups.map(({ code, items }) => {
        const ids = items.map((e) => e.id)
        const count = ids.filter(isSelected).length
        return (
          <div key={code} className="rounded-2xl border border-line p-4">
            <label className="flex items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className={`size-5 accent-primary ${focusRing}`}
                checked={count === ids.length}
                ref={(el) => {
                  if (el) el.indeterminate = count > 0 && count < ids.length
                }}
                onChange={(e) => toggle(ids, e.target.checked)}
              />
              {categoryLabels[code].plural}
              <span className="text-sm font-normal text-muted">
                ({count}/{ids.length})
              </span>
            </label>
            <ul className="mt-3 grid gap-2 pl-8">
              {items.map((entry) => {
                const v = entry.latestVersion
                const facts = [v.dose, v.frequency].filter(Boolean).join(' · ')
                return (
                  <li key={entry.id}>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className={`mt-1 size-4 accent-primary ${focusRing}`}
                        checked={isSelected(entry.id)}
                        onChange={(e) => toggle([entry.id], e.target.checked)}
                      />
                      <span>
                        {v.title}
                        <span className="block text-sm text-muted">
                          {[facts, confidenceLabels[v.confidenceLevel]].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </fieldset>
  )
}

/** Paso 3: resumen de lo que verá el médico, con atajos para corregir cada parte. */
function Review({
  entries,
  control,
  onEdit,
}: {
  entries: HealthEntry[]
  control: HandoffControl
  onEdit: (step: number) => void
}) {
  const [ids, reason, questions] = useWatch({ control, name: ['healthEntryIds', 'reason', 'questions'] })
  const chosen = entries.filter((e) => ids.includes(e.id))

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">Revisa antes de crear</h2>
      <ReviewBlock title="Motivo" onEdit={() => onEdit(1)}>
        <p className="whitespace-pre-line">{reason}</p>
      </ReviewBlock>
      <ReviewBlock title="Preguntas" onEdit={() => onEdit(1)}>
        <p className="whitespace-pre-line">{questions?.trim() || <span className="text-muted">Sin preguntas</span>}</p>
      </ReviewBlock>
      <ReviewBlock title={`Registros (${chosen.length})`} onEdit={() => onEdit(0)}>
        <EntryContents entries={chosen} />
      </ReviewBlock>
    </div>
  )
}

function SelectedContent({ entries, control }: { entries: HealthEntry[]; control: HandoffControl }) {
  const ids = useWatch({ control, name: 'healthEntryIds' })
  return (
    <section className="grid gap-3" aria-label="Contenido incluido en el resumen">
      <h2 className="text-xl font-semibold">Contenido del resumen</h2>
      <EntryContents entries={entries.filter((e) => ids.includes(e.id))} />
    </section>
  )
}

function EntryContents({ entries }: { entries: HealthEntry[] }) {
  return <ul className="grid gap-4">{entries.map((entry) => {
    const v = entry.latestVersion
    return <li key={entry.id} className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{v.title}</h3>
        <span className="text-sm text-muted">{confidenceLabels[v.confidenceLevel]}</span>
      </div>
      <p className="text-sm text-muted">{entry.categoryName}{v.occurredOn ? ` · ${formatDate(v.occurredOn)}` : ''}</p>
      {v.dose || v.frequency ? <p className="mt-2">{[v.dose, v.frequency].filter(Boolean).join(' · ')}</p> : null}
      {v.details ? <p className="mt-3 whitespace-pre-wrap break-words">{v.details}</p> : <p className="mt-3 text-sm text-muted">Este registro no tiene texto en Detalles.</p>}
      {v.notes ? <p className="mt-2 whitespace-pre-wrap break-words text-muted">{v.notes}</p> : null}
      {v.sourceAttachmentId ? <p className="mt-3 text-sm text-muted">Incluye el documento original como respaldo para el médico.</p> : null}
    </li>
  })}</ul>
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className={`text-sm font-semibold text-primary-fg underline ${focusRing}`}>
          Cambiar
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}
