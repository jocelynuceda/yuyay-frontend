import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import {
  declareAuthorization,
  getAuthorizationPolicy,
  listAuthorizationDeclarations,
} from '../../services/api/careSubjects'
import type { CareAuthorizationDeclaration, CareAuthorizationPolicy } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import {
  buildDeclaration,
  declarationLabel,
  emptyAuthorizationChoice,
  findOption,
  isConflict,
  type AuthorizationChoice,
} from '../../utils/authorization'
import { formatDate } from '../../utils/format'
import { linkClass } from '../../utils/styles'
import { AuthorizationDeclarationField } from '../forms/AuthorizationDeclarationField'
import { FormActions, FormShell, ServerError } from '../forms/fields'

/**
 * Lo que la cuenta declaró sobre el perfil, tal como lo guardó el backend. Solo el cuidador
 * principal lo ve. Un perfil anterior aparece «Sin declaración registrada» y se puede completar.
 */
export function AuthorizationStatus({ subjectId }: { subjectId: number }) {
  const history = useFetch((signal) => listAuthorizationDeclarations(subjectId, signal), [subjectId])
  const policy = useFetch((signal) => getAuthorizationPolicy(signal), [])
  const [editing, setEditing] = useState(false)
  const toast = useToast()

  if (history.error || !history.data) return null
  const current = history.data[0] ?? null
  const label = current ? (policy.data ? findOption(policy.data, current.type)?.label : null) : null

  return (
    <>
      <p className="mt-2 text-sm">
        <span className="font-semibold">Autorización: </span>
        {current ? (
          <>
            declaraste «{label ?? declarationLabel(current.text)}» el {formatDate(current.declaredAt)}
            <span className="text-muted"> (declaración, no verificada)</span>
          </>
        ) : (
          'Sin declaración registrada'
        )}
        {policy.data ? (
          <>
            {' · '}
            <button type="button" onClick={() => setEditing(true)} className={linkClass}>
              {current ? 'Cambiar' : 'Registrar declaración'}
            </button>
          </>
        ) : null}
      </p>
      <Modal open={editing} onClose={() => setEditing(false)} title="Declaración de autorización">
        {editing && policy.data ? (
          <DeclarationForm
            subjectId={subjectId}
            policy={policy.data}
            current={current}
            onCancel={() => setEditing(false)}
            onConflict={() => {
              history.reload()
              policy.reload()
            }}
            onSaved={() => {
              setEditing(false)
              toast.success('Declaración registrada.')
              history.reload()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}

function DeclarationForm({
  subjectId,
  policy,
  current,
  onCancel,
  onConflict,
  onSaved,
}: {
  subjectId: number
  policy: CareAuthorizationPolicy
  current: CareAuthorizationDeclaration | null
  onCancel: () => void
  onConflict: () => void
  onSaved: () => void
}) {
  const [choice, setChoice] = useState<AuthorizationChoice>(emptyAuthorizationChoice)
  const [choiceError, setChoiceError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <FormShell
      title="Declaración de autorización"
      bare
      onSubmit={async (event) => {
        event.preventDefault()
        setServerError(null)
        const result = buildDeclaration(policy, choice)
        if (!result.ok) {
          setChoiceError(result.error)
          return
        }
        setSubmitting(true)
        try {
          await declareAuthorization(subjectId, { ...result.declaration, previousDeclarationId: current?.id ?? null })
          onSaved()
        } catch (error) {
          setServerError(getErrorMessage(error))
          if (isConflict(error)) {
            setChoice((value) => ({ ...value, confirmed: false }))
            onConflict()
          }
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <ServerError message={serverError} />
      <AuthorizationDeclarationField
        policy={policy}
        value={choice}
        onChange={(next) => {
          setChoice(next)
          setChoiceError(null)
        }}
        error={choiceError}
      />
      <FormActions submitting={submitting} submitLabel="Registrar declaración" onCancel={onCancel} />
    </FormShell>
  )
}
