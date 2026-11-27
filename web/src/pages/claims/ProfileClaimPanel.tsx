import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LoadError } from '../../components/layout/LoadError'
import { useFetch } from '../../hooks/useFetch'
import { claimInvitationSchema, identityCheckSchema } from '../../schemas/profileClaim'
import { getCareAuthorizationHistory } from '../../services/api/careSubjects'
import { checkSubjectName, emitClaimInvitation, listClaimInvitations, revokeClaimInvitation } from '../../services/api/profileClaims'
import type { CareSubject } from '../../types'
import type { ClaimInvitation, IdentityCheckResponse } from '../../types/profileClaim'
import { applyServerErrors, getErrorMessage, getErrorStatus } from '../../utils/apiErrors'
import { claimInvitationStatus } from '../../utils/profileClaim'
import { formatDateTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { a11yProps, inputClass } from '../forms/fieldProps'
import { Field, ServerError } from '../forms/fields'

const identityMessages = {
  MATCH: 'El nombre declarado coincide con el nombre del documento consultado.',
  MISMATCH: 'El nombre no coincide. Revisa los datos del perfil antes de continuar.',
  NOT_FOUND: 'No se encontró ese DNI. Comprueba el número con su titular.',
  UNAVAILABLE: 'No se pudo consultar el directorio. El nombre no quedó contrastado.',
}

export function ProfileClaimPanel({ subject, onChanged }: { subject: CareSubject; onChanged: () => void }) {
  if (subject.myRole !== 'PRINCIPAL') return null
  return <ClaimManager key={subject.id} subject={subject} onChanged={onChanged} />
}

function ClaimManager({ subject, onChanged }: { subject: CareSubject; onChanged: () => void }) {
  const loaded = useFetch(async (signal) => {
    const [invitations, declarations] = await Promise.all([
      listClaimInvitations(subject.id, signal), getCareAuthorizationHistory(subject.id, signal),
    ])
    return { invitations, declarations }
  }, [subject.id])
  const { reload: reloadClaimState } = loaded
  useEffect(() => {
    const refresh = () => { reloadClaimState(); onChanged() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [reloadClaimState, onChanged])
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [uncertainData, setUncertainData] = useState<typeof loaded.data | undefined>(undefined)
  const [revoking, setRevoking] = useState<ClaimInvitation | null>(null)
  const [dni, setDni] = useState('')
  const [identity, setIdentity] = useState<(IdentityCheckResponse & { name: string }) | null>(null)
  const [checking, setChecking] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [sendGuard] = useState(() => {
    let active = false
    return {
      enter() { if (active) return false; active = true; return true },
      leave() { active = false },
    }
  })
  const checkBusy = useRef(false)
  const { register, handleSubmit, setError, setValue, setFocus, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(claimInvitationSchema), defaultValues: { invitedEmail: '' }, mode: 'onTouched',
  })
  const uncertain = uncertainData !== undefined && uncertainData === loaded.data
  const invitations = loaded.data?.invitations ?? []
  const fictitious = loaded.data?.declarations[0]?.type === 'FICTITIOUS'
  const delivered = invitations.some((invitation) => invitation.exchangedAt !== null)
  const unavailable = !subject.birthDate || fictitious || delivered
  const disabled = unavailable || loaded.loading || !!loaded.error || uncertain
  const shownIdentity = identity?.name === subject.name ? identity : null

  const submit = handleSubmit(async ({ invitedEmail }) => {
    if (!confirmed || disabled || !sendGuard.enter()) return
    setMessage(null)
    setNotice(null)
    try {
      await emitClaimInvitation(subject.id, invitedEmail)
      reset()
      setConfirmed(false)
      setNotice('Invitación emitida. El enlace se envía únicamente al correo destinatario; no se muestra aquí. Su entrega depende del servicio de correo.')
      loaded.reload()
    } catch (error) {
      const status = getErrorStatus(error)
      if (status === undefined || status === 0 || status >= 500 || status === 408) {
        setUncertainData(loaded.data)
        setMessage('No se pudo confirmar la emisión. Consulta el historial antes de volver a emitir una invitación.')
      } else {
        setMessage(applyServerErrors(error, setError, ['invitedEmail']))
      }
    } finally { sendGuard.leave() }
  })

  async function checkName() {
    if (checkBusy.current || disabled) return
    const parsed = identityCheckSchema.safeParse({ dni })
    if (!parsed.success) { setIdentityError(parsed.error.issues[0].message); return }
    checkBusy.current = true
    setChecking(true)
    setIdentityError(null)
    setIdentity(null)
    try {
      const result = await checkSubjectName(subject.id, parsed.data.dni)
      setIdentity({ ...result, name: subject.name })
    } catch (error) { setIdentityError(getErrorMessage(error)) }
    finally {
      setDni('')
      setChecking(false)
      checkBusy.current = false
    }
  }

  return (
    <Card as="section" className="grid gap-5" aria-labelledby="claim-manager-title">
      <header className="grid gap-2">
        <h2 id="claim-manager-title" className="text-xl font-semibold">Entregar perfil a su titular</h2>
        <p>La persona destinataria administrará su propio perfil como principal. Los principales anteriores pasarán a cuidadores y conservarán acceso hasta que el titular lo cambie. Los registros y sus autores se mantienen.</p>
      </header>

      {loaded.error ? <LoadError message={loaded.error} status={loaded.errorStatus} onRetry={loaded.reload} /> : loaded.loading ? (
        <p role="status">Consultando condiciones e invitaciones…</p>
      ) : (
        <>
          <div className="grid gap-2 rounded-2xl border border-line p-4 text-sm">
            <h3 className="font-semibold">Condiciones de entrega</h3>
            {!subject.birthDate ? <p>Registra la fecha de nacimiento antes de emitir una invitación.</p> : null}
            {fictitious ? <p>Un perfil declarado ficticio no se puede entregar a un titular.</p> : null}
            {delivered ? <p>Este perfil ya tiene una entrega completada.</p> : null}
            {!unavailable ? <p>El servidor comprobará que la edad declarada alcance el mínimo configurado y que el perfil todavía no tenga titular al emitir y canjear.</p> : null}
            <p>La fecha de nacimiento es declarada: no está verificada por una consulta de DNI.</p>
          </div>

          {!unavailable ? (
            <details className="rounded-2xl border border-line p-4">
              <summary className={'cursor-pointer font-semibold text-primary ' + focusRing}>Contrastar el nombre con un DNI (opcional)</summary>
              <div className="mt-4 grid gap-3">
                <p className="text-sm">La consulta contrasta el nombre de {subject.name}. No acredita identidad ni verifica edad. Este paso es independiente de la invitación.</p>
                <label htmlFor="claim-dni" className="text-sm font-semibold">DNI del titular</label>
                <input id="claim-dni" value={dni} onChange={(event) => setDni(event.target.value)} inputMode="numeric" autoComplete="off" maxLength={8} className={inputClass(false)}
                  aria-invalid={!!identityError} aria-describedby="claim-dni-hint" disabled={checking || disabled} />
                <p id="claim-dni-hint" className="text-sm text-muted">No se guarda el número; se retira del formulario después de consultar.</p>
                {identityError ? <p role="alert" className="text-sm text-danger">{identityError}</p> : null}
                <Button variant="secondary" loading={checking} disabled={disabled || !dni} onClick={() => void checkName()}>Contrastar nombre</Button>
                {shownIdentity ? <p role="status">{identityMessages[shownIdentity.result]}</p> : null}
              </div>
            </details>
          ) : null}

          <ServerError message={message} />
          {notice ? <p role="status" className="text-sm text-accent-text">{notice}</p> : null}
          {!unavailable ? (
            <form onSubmit={submit} noValidate className="grid gap-4">
              <Field id="claim-email" label="Correo del titular" error={errors.invitedEmail} hint="Solo esta cuenta podrá canjear el enlace recibido en ese buzón.">
                <input type="email" autoComplete="email" {...register('invitedEmail')} {...a11yProps('claim-email', errors.invitedEmail)} disabled={isSubmitting || disabled} />
              </Field>
              <label className="flex items-start gap-3">
                <input type="checkbox" className={'mt-1 size-5 shrink-0 accent-primary ' + focusRing} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={isSubmitting || disabled} />
                <span>Confirmo que el correo corresponde al titular y comprendo el cambio de permisos. Emitir una nueva invitación invalida la anterior.</span>
              </label>
              <Button type="submit" loading={isSubmitting} disabled={!confirmed || disabled}>Enviar invitación de entrega</Button>
            </form>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Invitaciones de entrega</h3>
            <Button variant="secondary" size="sm" disabled={isSubmitting || checking} onClick={() => {
              setMessage(null)
              loaded.reload()
              onChanged()
            }}>Actualizar estado y permisos</Button>
          </div>
          {invitations.length === 0 ? <p className="text-sm text-muted">No hay invitaciones de entrega.</p> : (
            <ul className="grid gap-3">
              {invitations.map((invitation) => {
                const status = claimInvitationStatus(invitation)
                return (
                  <li key={invitation.id} className="grid gap-3 rounded-2xl border border-line p-4">
                    <div>
                      <p className="font-semibold [overflow-wrap:anywhere]">{invitation.invitedEmail}</p>
                      <p className="text-sm">{status} · vigencia hasta {formatDateTime(invitation.validUntil)}</p>
                    </div>
                    {status !== 'Utilizada' && !delivered ? (
                      <div className="flex flex-wrap gap-3">
                        {!unavailable ? <Button variant="secondary" size="sm" disabled={isSubmitting || disabled} onClick={() => {
                          setValue('invitedEmail', invitation.invitedEmail, { shouldValidate: true })
                          setConfirmed(false)
                          setFocus('invitedEmail')
                        }}>Preparar nueva invitación</Button> : null}
                        {status === 'Pendiente' ? <Button variant="secondary" size="sm" disabled={isSubmitting} onClick={() => setRevoking(invitation)}>Revocar invitación</Button> : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog open={!!revoking} title="¿Revocar la invitación de entrega?"
        message="El enlace recibido por correo dejará de permitir la entrega del perfil."
        confirmLabel="Revocar invitación" workingLabel="Revocando…" onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return
          await revokeClaimInvitation(subject.id, revoking.id)
          setRevoking(null)
          setNotice('Invitación revocada.')
          loaded.reload()
        }} />
    </Card>
  )
}
