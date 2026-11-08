import { useState } from 'react'
import { listCaregivers, removeCaregiver } from '../../services/api/caregivers'
import type { CareRelationship, CareRole, CareStatus } from '../../types'
import { formatDate } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { InviteCaregiverForm } from '../forms/InviteCaregiverForm'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useLoad } from './useLoad'
import { useSuccessNotice } from '../shared/useSuccessNotice'

const roleLabels: Record<CareRole, string> = { PRINCIPAL: 'Principal', CAREGIVER: 'Cuidador/a' }
const statusLabels: Record<CareStatus, string> = { PENDING: 'Invitación pendiente', ACTIVE: 'Activo', REVOKED: 'Quitado' }

/**
 * Pestaña "Cuidadores" del detalle de persona: lista, invitar y quitar con confirmación.
 * Solo el principal puede invitar y quitar.
 */
export function CaregiversPanel({
  subjectId,
  isPrincipal,
  onChanged,
}: {
  subjectId: number
  isPrincipal: boolean
  /** Se llama al quitar un cuidador, para actualizar lo que dependa de la lista. */
  onChanged?: () => void
}) {
  const { state, reload } = useLoad(() => listCaregivers(subjectId), subjectId)
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<CareRelationship | null>(null)
  const { notify, anchorProps } = useSuccessNotice()

  if (state.status === 'loading') return <p className="p-6 text-muted">Cargando cuidadores…</p>
  if (state.status === 'error') {
    return (
      <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">
        {state.message}
      </p>
    )
  }

  const visible = state.data.filter((r) => r.status !== 'REVOKED')
  // El backend no deja quitar al único principal activo
  const activePrincipals = visible.filter((r) => r.role === 'PRINCIPAL' && r.status === 'ACTIVE').length
  const canRemove = (r: CareRelationship) => !(r.role === 'PRINCIPAL' && r.status === 'ACTIVE' && activePrincipals <= 1)

  return (
    <section aria-labelledby="caregivers-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="caregivers-title" className="text-2xl font-semibold">
          Cuidadores
        </h2>
        {isPrincipal && !inviting ? (
          <button
            type="button"
            onClick={() => {
              setInviting(true)
            }}
            className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
          >
            Invitar cuidador
          </button>
        ) : null}
      </div>

      <span {...anchorProps} />

      {inviting ? (
        <InviteCaregiverForm
          subjectId={subjectId}
          onCancel={() => setInviting(false)}
          onSaved={(relationship) => {
            setInviting(false)
            notify(`Invitación enviada a ${relationship.user.email}.`)
            reload()
          }}
        />
      ) : null}

      <ul className="grid gap-3">
        {visible.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                {r.user.name}
                {r.relationshipLabel ? <span className="font-normal text-muted"> · {r.relationshipLabel}</span> : null}
              </p>
              <p className="truncate text-sm text-muted">{r.user.email}</p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{roleLabels[r.role]}</span>
                {' · '}
                <span className={r.status === 'PENDING' ? 'text-soft-text' : 'text-accent-text'}>
                  {statusLabels[r.status]}
                </span>
                {r.status === 'PENDING' ? ` desde el ${formatDate(r.invitedAt)}` : null}
              </p>
            </div>
            {isPrincipal && canRemove(r) ? (
              <button
                type="button"
                onClick={() => setRemoving(r)}
                aria-label={r.status === 'PENDING' ? `Cancelar la invitación a ${r.user.email}` : `Quitar a ${r.user.name}`}
                className={`rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
              >
                {r.status === 'PENDING' ? 'Cancelar invitación' : 'Quitar'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="text-muted">Aún no hay cuidadores.</p> : null}

      <ConfirmDialog
        open={!!removing}
        title={removing?.status === 'PENDING' ? '¿Cancelar la invitación?' : `¿Quitar a ${removing?.user.name ?? ''}?`}
        message={
          removing?.status === 'PENDING'
            ? `${removing.user.email} ya no podrá aceptar la invitación.`
            : 'Dejará de ver y editar los registros de esta persona. Su historial de cambios se conserva.'
        }
        confirmLabel={removing?.status === 'PENDING' ? 'Cancelar invitación' : 'Quitar cuidador'}
        workingLabel="Quitando…"
        cancelLabel="Volver"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await removeCaregiver(subjectId, removing.id)
          notify(
            removing.status === 'PENDING'
              ? `Invitación a ${removing.user.email} cancelada.`
              : `${removing.user.name} ya no es cuidador/a.`,
          )
          setRemoving(null)
          reload()
          onChanged?.()
        }}
      />
    </section>
  )
}
