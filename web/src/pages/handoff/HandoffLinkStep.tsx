import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { emptyHandoffSession, handoffSessionSchema, type HandoffSessionFormValues } from '../../schemas/handoff'
import { createHandoffSession } from '../../services/api/handoffs'
import type { HandoffDetail, HandoffSessionCreated } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { formatDateTime } from '../../utils/format'
import { handoffLink } from '../../utils/links'
import { focusRing } from '../../utils/styles'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'

/** Después de crear el resumen: generar el enlace temporal y copiarlo para enviarlo al médico. */
export function HandoffLinkStep({ handoff, subjectName }: { handoff: HandoffDetail; subjectName?: string }) {
  const [session, setSession] = useState<HandoffSessionCreated | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HandoffSessionFormValues, unknown, z.output<typeof handoffSessionSchema>>({
    resolver: zodResolver(handoffSessionSchema),
    defaultValues: emptyHandoffSession,
    mode: 'onChange',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      setSession(await createHandoffSession(handoff.id, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['expiresInHours', 'sessionWindowMinutes']))
    }
  })

  return (
    <div className="grid gap-6">
      <p role="status" className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-text">
        Resumen creado{subjectName ? ` para ${subjectName}` : ''} con {handoff.items.length} registro
        {handoff.items.length === 1 ? '' : 's'}.
      </p>

      {session ? (
        <ShareLink session={session} />
      ) : (
        <FormShell
          title="Crear enlace para el médico"
          description="El médico lo abre sin cuenta. Le pedirá su nombre y rol, y queda en la bitácora."
          onSubmit={onSubmit}
        >
          <ServerError message={serverError} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="session-hours" label="Vence en (horas)" hint="Entre 1 y 72." error={errors.expiresInHours}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={72}
                {...a11yProps('session-hours', errors.expiresInHours, 'hint')}
                {...register('expiresInHours')}
              />
            </Field>
            <Field
              id="session-window"
              label="Minutos de consulta"
              hint="Tiempo para leerlo desde que lo abre."
              error={errors.sessionWindowMinutes}
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                {...a11yProps('session-window', errors.sessionWindowMinutes, 'hint')}
                {...register('sessionWindowMinutes')}
              />
            </Field>
          </div>
          <FormActions submitting={isSubmitting} submitLabel="Crear enlace" submittingLabel="Creando…" />
        </FormShell>
      )}
    </div>
  )
}

function ShareLink({ session }: { session: HandoffSessionCreated }) {
  const [copied, setCopied] = useState(false)
  const link = handoffLink(session.token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="grid gap-4 rounded-3xl bg-white p-6 sm:p-8" aria-labelledby="share-title">
      <h2 id="share-title" className="text-xl font-semibold">
        Enlace listo
      </h2>
      <p className="text-muted">
        Envíalo solo al médico: quien tenga el enlace puede ver el resumen. Vence el {formatDateTime(session.expiresAt)}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={link}
          aria-label="Enlace para el médico"
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 rounded-xl border border-line bg-surface/60 px-4 py-2.5 font-mono text-sm ${focusRing}`}
        />
        <button
          type="button"
          onClick={copy}
          className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? 'Enlace copiado al portapapeles' : ''}
      </p>
    </section>
  )
}
