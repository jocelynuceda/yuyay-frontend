import { useRef, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { focusRing } from '../../utils/styles'

/** El checkbox solo se activa tras confirmar las condiciones del PDF. */
export function DownloadPermission({ allowed, onChange, disabled }: {
  allowed: boolean
  onChange: (allowed: boolean) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLInputElement>(null)
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 font-semibold">Permiso de descarga</legend>
      <label className="flex items-start gap-3">
        <input ref={trigger} type="checkbox" checked={allowed} disabled={disabled}
          aria-haspopup="dialog" aria-describedby="download-permission-hint"
          className={`mt-1 size-5 shrink-0 accent-primary ${focusRing}`}
          onChange={() => allowed ? onChange(false) : setOpen(true)} />
        <span>Permitir que el lector descargue este resumen en PDF</span>
      </label>
      <Modal open={open} onClose={() => setOpen(false)} title="Condiciones de descarga" returnFocusRef={trigger}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto !bg-white !text-[#27243f] [&_button[aria-label=Cerrar]]:!text-[#27243f]">
        <div className="grid gap-3 text-sm leading-relaxed">
          <p>Al autorizar la descarga, permites que quien acceda a este enlace con el código guarde una copia del resumen para su consulta. El PDF incluirá los registros que seleccionaste al preparar el resumen.</p>
          <h3 className="font-semibold">Si compartes datos de otra persona</h3>
          <p>Confirma que tienes su autorización para entregar esta copia a quien atenderá la consulta, o que cuentas con facultades legales para hacerlo en su representación.</p>
          <h3 className="font-semibold">Una copia descargada permanece en el dispositivo</h3>
          <p>El vencimiento o la revocación del enlace impiden nuevos accesos en Yuyay. Una copia que ya se descargó seguirá en manos del lector.</p>
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <button type="button" className={`rounded-xl border border-[#d3d2df] bg-white px-4 py-3 ${focusRing}`} onClick={() => setOpen(false)}>Volver</button>
            <button type="button" className={`rounded-xl bg-primary px-4 py-3 font-semibold text-white ${focusRing}`} onClick={() => { onChange(true); setOpen(false) }}>Autorizar descarga</button>
          </div>
        </div>
      </Modal>
    </fieldset>
  )
}
