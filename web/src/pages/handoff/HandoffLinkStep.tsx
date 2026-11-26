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
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'

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
        // Un servidor anterior puede ignorar requireAccessCode: nunca ofrecer ese enlace como protegido.
        try { await revokeHandoffSession(created.id) } catch { /* No se muestra ni se copia el token. */ }
        setServerError('El servidor todavía no permite crear enlaces protegidos con código. No compartas este enlace. Inténtalo cuando el servicio esté actualizado.')
        onCreated?.()
        return
      }
      setSession(created)
      onCreated?.()
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['expiresInHours', 'sessionWindowMinutes']))
    }
  })

  if (session) return <ShareLink session={session} />

  return (
    <FormShell
      title="Crear enlace para el médico"
      description="El médico lo abre sin cuenta. Le pedirá su nombre, rol y un código de acceso. La consulta queda en la bitácora."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`session-hours-${handoffId}`} label="Vence en (horas)" hint="Entre 1 y 72." error={errors.expiresInHours}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={72}
            {...a11yProps(`session-hours-${handoffId}`, errors.expiresInHours, 'hint')}
            {...register('expiresInHours')}
          />
        </Field>
        <Field
          id={`session-window-${handoffId}`}
          label="Minutos de consulta"
          hint="Tiempo para leerlo desde que lo abre."
          error={errors.sessionWindowMinutes}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            {...a11yProps(`session-window-${handoffId}`, errors.sessionWindowMinutes, 'hint')}
            {...register('sessionWindowMinutes')}
          />
        </Field>
      </div>
      <FormActions submitting={isSubmitting} submitLabel="Crear enlace" submittingLabel="Creando…" />
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
        Envía el enlace solo al médico y comparte el código por separado. Vence el {formatDateTime(session.expiresAt)}
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
