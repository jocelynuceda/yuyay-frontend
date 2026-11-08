import { useState } from 'react'
import { listDelegations, revokeDelegation } from '../../services/api/delegations'
import type { Delegation, DelegationCreated } from '../../types'
import { categoryLabels, formatDateTime } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { DelegationForm } from '../forms/DelegationForm'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useLoad } from './useLoad'

function delegationStatus(d: Delegation) {
  if (d.revokedAt) return { label: `Revocado el ${formatDateTime(d.revokedAt)}`, tone: 'text-muted' }
  if (!d.active) return { label: 'Vencido', tone: 'text-muted' }
  if (d.exchangedAt) return { label: `En uso desde el ${formatDateTime(d.exchangedAt)}`, tone: 'text-accent-text' }
  return { label: 'Enlace sin abrir', tone: 'text-soft-text' }
}

/**
 * Accesos delegados de una persona: crear (solo principal), copiar el enlace y revocar con confirmación.
 */
export function DelegationsPanel({ subjectId, isPrincipal }: { subjectId: number; isPrincipal: boolean }) {
  const { state, reload } = useLoad(() => listDelegations(subjectId), subjectId)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<DelegationCreated | null>(null)
  const [revoking, setRevoking] = useState<Delegation | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (state.status === 'loading') return <p className="p-6 text-muted">Cargando accesos…</p>
  if (state.status === 'error') {
    return (
      <p role="alert" className="rounded-2xl bg-danger-bg p-6 text-danger">
        {state.message}
      </p>
    )
  }

  return (
    <section aria-labelledby="delegations-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="delegations-title" className="text-2xl font-semibold">
          Accesos delegados
        </h2>
        {isPrincipal && !creating ? (
          <button
            type="button"
            onClick={() => {
              setNotice(null)
              setCreated(null)
              setCreating(true)
            }}
            className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
          >
            Delegar acceso
          </button>
        ) : null}
      </div>

      {notice ? (
        <p role="status" className="rounded-xl bg-accent-tint p-4 font-semibold text-accent-text">
          {notice}
        </p>
      ) : null}

      {creating ? (
        <DelegationForm
          subjectId={subjectId}
          onCancel={() => setCreating(false)}
          onSaved={(result) => {
            setCreating(false)
            setCreated(result)
            reload()
          }}
        />
      ) : null}

      {created ? <ShareDelegation created={created} onClose={() => setCreated(null)} /> : null}

      <ul className="grid gap-3">
        {state.data.map((d) => {
          const status = delegationStatus(d)
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4">
              <div className="min-w-0">
                <p className="font-semibold">{d.granteeName}</p>
                <p className="truncate text-sm text-muted">{d.granteeEmail}</p>
                <p className="mt-1 text-sm">
                  {d.categoryCodes.map((c) => categoryLabels[c]?.plural ?? c).join(', ')}
                  {' · hasta el '}
                  {formatDateTime(d.validUntil)}
                </p>
                <p className={`text-sm font-semibold ${status.tone}`}>{status.label}</p>
              </div>
              {isPrincipal && d.active ? (
                <button
                  type="button"
                  onClick={() => setRevoking(d)}
                  aria-label={`Revocar el acceso de ${d.granteeName}`}
                  className={`rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-bg ${focusRing}`}
                >
                  Revocar
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {state.data.length === 0 ? <p className="text-muted">No hay accesos delegados.</p> : null}

      <ConfirmDialog
        open={!!revoking}
        title={`¿Revocar el acceso de ${revoking?.granteeName ?? ''}?`}
        message="Dejará de ver los registros de inmediato, aunque ya haya abierto el enlace. Para volver a darle acceso habrá que crear uno nuevo."
        confirmLabel="Revocar acceso"
        workingLabel="Revocando…"
        cancelLabel="Volver"
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return
          await revokeDelegation(revoking.id)
          setNotice(`Acceso de ${revoking.granteeName} revocado.`)
          setRevoking(null)
          reload()
        }}
      />
    </section>
  )
}

/** El token solo se muestra una vez, al crear: hay que copiar el enlace en ese momento. */
function ShareDelegation({ created, onClose }: { created: DelegationCreated; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="grid gap-3 rounded-3xl bg-white p-6" aria-labelledby="share-delegation-title">
      <h3 id="share-delegation-title" className="text-xl font-semibold">
        Acceso creado para {created.delegation.granteeName}
      </h3>
      <p className="text-muted">
        También se envía por correo a {created.delegation.granteeEmail}. Si quieres compartirlo por otro medio, cópialo
        ahora: por seguridad no se vuelve a mostrar. Solo se puede abrir una vez y el acceso se cierra cuando la persona
        cierra la pestaña.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={created.shareLink}
          aria-label="Enlace de acceso delegado"
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 rounded-xl border border-line bg-surface/60 px-4 py-2.5 font-mono text-sm ${focusRing}`}
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(created.shareLink)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
          className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </button>
        <button type="button" onClick={onClose} className={`rounded-xl border border-line px-5 py-2.5 font-semibold ${focusRing}`}>
          Listo
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? 'Enlace copiado al portapapeles' : ''}
      </p>
    </section>
  )
}
