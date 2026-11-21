import { useId, useRef, type ReactNode, type RefObject } from 'react'
import type { useAccountTerms } from '../hooks/useAccountTerms'
import { focusRing, linkClass } from '../utils/styles'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

const title = 'Términos de uso y aviso de privacidad'
type AccountTermsState = ReturnType<typeof useAccountTerms>

export function TermsCheckbox({
  terms, disabled = false, describedBy, invalid,
}: {
  terms: AccountTermsState
  disabled?: boolean
  describedBy?: string
  invalid?: boolean
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className={`mt-0.5 size-4 shrink-0 accent-primary ${focusRing}`}
        checked={Boolean(terms.acceptance)}
        disabled={disabled || terms.loading || !terms.document || Boolean(terms.error)}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => terms.setAccepted(event.currentTarget.checked)}
      />
      Acepto los términos de uso y el aviso de privacidad de mi cuenta.
    </label>
  )
}

export function AccountTermsDialog({
  terms, returnFocusRef, onClose = terms.close, children,
}: {
  terms: AccountTermsState
  returnFocusRef?: RefObject<HTMLElement | null>
  onClose?: () => void
  children?: ReactNode
}) {
  const [heading, ...body] = terms.document?.text.split('\n') ?? []
  const readingHeight = children ? 'max-h-[min(46dvh,30rem)]' : 'max-h-[min(65dvh,38rem)]'
  return (
    <Modal
      open={terms.open}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      title={heading || title}
      className="bg-white! text-black! [&_button[aria-label=Cerrar]]:text-black!"
    >
      {terms.error ? (
        <div className="grid justify-items-start gap-3">
          <p role="alert">{terms.error}</p>
          <Button type="button" className="border border-black/20 bg-white! text-black!" onClick={terms.reload}>
            Volver a cargar el documento
          </Button>
        </div>
      ) : terms.loading || !terms.document ? (
        <p role="status">Cargando el documento…</p>
      ) : (
        <div tabIndex={0} className={`${readingHeight} overflow-y-auto whitespace-pre-wrap wrap-break-word pr-2 text-sm leading-relaxed ${focusRing}`}>
          {body.join('\n').trimStart()}
        </div>
      )}
      {children}
    </Modal>
  )
}

export function AccountTerms({
  terms, requireAcceptance = false, disabled = false, validationError,
}: {
  terms: AccountTermsState
  requireAcceptance?: boolean
  disabled?: boolean
  validationError?: string | null
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const feedbackId = useId()
  const instructionsId = useId()
  const needsDocument = !terms.document || Boolean(terms.error)
  const describedBy = [needsDocument ? instructionsId : '', validationError ? feedbackId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid justify-items-start gap-2">
      <button type="button" className={linkClass} ref={trigger} onClick={terms.show} disabled={disabled}>
        Leer los términos de uso y el aviso de privacidad
      </button>
      {requireAcceptance ? (
        <>
          {needsDocument ? <p id={instructionsId} className="text-sm text-muted">Abre el documento para poder aceptar.</p> : null}
          <TermsCheckbox terms={terms} disabled={disabled} describedBy={describedBy} invalid={Boolean(validationError)} />
          {validationError ? <p id={feedbackId} role="alert" className="text-sm text-danger">{validationError}</p> : null}
        </>
      ) : null}
      <AccountTermsDialog terms={terms} returnFocusRef={trigger} />
    </div>
  )
}
