import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { emptyHandoffSession, handoffSessionSchema, type HandoffSessionFormValues } from '../../schemas/handoff'
import { HandoffAccessCode } from '../../components/security/HandoffAccessCode'
import { createHandoffSession, revokeHandoffSession } from '../../services/api/handoffs'
import type { HandoffDetail, HandoffSessionCreated } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { formatDateTime } from '../../utils/format'
import { handoffLink } from '../../utils/links'
import { focusRing, linkButtonClass, linkSecondaryClass } from '../../utils/styles'
import { DurationField } from '../forms/DurationField'
import { FormActions, FormShell, ServerError } from '../forms/fields'

/** Después de guardar, cada acción continúa en su propia página. */
export function HandoffLinkStep({ handoff, subjectName }: { handoff: HandoffDetail; subjectName?: string }) {
  return (
    <div className="grid gap-6">
      <p role="status" className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-text">
        Resumen creado{subjectName ? ` para ${subjectName}` : ''} con {handoff.items.length} registro
        {handoff.items.length === 1 ? '' : 's'}.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to={`/people/${handoff.careSubjectId}/handoffs/${handoff.id}`} className={linkSecondaryClass}>Ver resumen</Link>
        <Link to={`/people/${handoff.careSubjectId}/handoffs/${handoff.id}/share`} className={linkButtonClass}>Generar enlace y código</Link>
        <Link to={`/people/${handoff.careSubjectId}?tab=handoffs`} className={linkSecondaryClass}>Regresar</Link>
      </div>
    </div>
  )
}

/** Formulario del enlace temporal; una vez creado, muestra el enlace para copiarlo. */
export function CreateHandoffLink({ handoffId, onCreated }: { handoffId: number; onCreated?: () => void }) {
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
      const created = await createHandoffSession(handoffId, values)
      if (created.accessCodeRequired !== true) {
        try {
          await revokeHandoffSession(created.id)
        } catch {
          // El token no se muestra ni se copia aunque no se pueda revocar.
        }
        setServerError('El servidor todavía no permite crear enlaces protegidos con código. Inténtalo cuando el servicio esté actualizado.')
        onCreated?.()
        return
      }
      setSession(created)
      onCreated?.()
    } catch (error) {
      setServerError(applyServerErrors(error, setError, [], {
        expiresInMinutes: 'expiry.amount',
        expiresInHours: 'expiry.amount',
        sessionWindowMinutes: 'reading.amount',
      }))
    }
  })

  if (session) return <ShareLink session={session} />

  return (
    <FormShell
      title="Generar enlace y código"
      description="El lector puede abrirlo sin cuenta. Su nombre y rol quedan en la bitácora."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />
      <div className="grid gap-5">
        <DurationField
          id={`session-expiry-${handoffId}`}
          label="El enlace vence en"
          hint="Límite máximo: 3 días. Después de ese momento, el enlace y el permiso caducan."
          error={errors.expiry?.amount}
          amountField={register('expiry.amount', { deps: ['reading.amount'] })}
          unitField={register('expiry.unit', { deps: ['expiry.amount', 'reading.amount'] })}
          disabled={isSubmitting}
        />
        <DurationField
          id={`session-window-${handoffId}`}
          label="Tiempo de lectura desde la primera apertura"
          hint="Empieza al abrir el enlace de resumen correctamente."
          error={errors.reading?.amount}
          amountField={register('reading.amount')}
          unitField={register('reading.unit', { deps: ['reading.amount'] })}
          disabled={isSubmitting}
        />
      </div>
      <div aria-hidden={!errors.expiry?.amount && !errors.reading?.amount} className={`grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out motion-reduce:transition-none ${errors.expiry?.amount || errors.reading?.amount ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <p className="rounded-xl bg-accent-tint p-4 text-accent-text">Ajusta los tiempos para continuar.</p>
        </div>
      </div>
      <FormActions submitting={isSubmitting} submitDisabled={!!(errors.expiry?.amount || errors.reading?.amount)} submitLabel="Generar enlace y código" submittingLabel="Creando…" />
    </FormShell>
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
    <section className="grid gap-4 rounded-3xl bg-card p-6 sm:p-8" aria-labelledby="share-title">
      <h2 id="share-title" className="text-xl font-semibold">
        Enlace listo
      </h2>
      <p className="text-muted">
        Envía el enlace solo al médico y comparte el código por separado. Vence el {formatDateTime(session.expiresAt)}.
      </p>
      <HandoffAccessCode sessionId={session.id} />
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
