import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../../components/ui/Modal'
import { registrationIdentitySchema } from '../../schemas/auth'
import type { RegistrationIdentity } from '../../types/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { FormActions, FormShell, ServerError } from '../forms/fields'
import { RegistrationIdentityFields } from './RegistrationIdentityFields'

export function GoogleRegistrationDialog({ error, saving, onFinish }: {
  error?: unknown
  saving: boolean
  onFinish: (identity: RegistrationIdentity | null) => void
}) {
  const { register, handleSubmit, setError, setFocus, formState: { errors } } = useForm({
    resolver: zodResolver(registrationIdentitySchema),
    defaultValues: { dni: '', fullName: '', name: '' },
    mode: 'onTouched',
  })
  useEffect(() => { setFocus('dni') }, [setFocus])
  useEffect(() => {
    if (!error) return
    const message = applyServerErrors(error, setError, ['dni', 'fullName', 'name'])
    if (message) setError('root.server', { type: 'server', message })
  }, [error, setError])

  // El botón de Google vive en el formulario de contraseña. Este diálogo envía su propio formulario.
  return createPortal(
    <Modal open title="Completa tu cuenta de Yuyay" onClose={() => onFinish(null)} dismissible={!saving}>
      <FormShell bare title="Completa tu cuenta de Yuyay" onSubmit={(event) => {
        event.stopPropagation()
        void handleSubmit(onFinish)(event)
      }}>
        <ServerError message={errors.root?.server?.message ?? null} />
        <fieldset className="grid gap-4" disabled={saving}>
          <RegistrationIdentityFields prefix="google-signup" dni={register('dni')} fullName={register('fullName')} name={register('name')} errors={errors} />
        </fieldset>
        <FormActions submitting={saving} submittingLabel="Creando cuenta…" submitLabel="Crear cuenta con Google" onCancel={() => onFinish(null)} />
      </FormShell>
    </Modal>, document.body,
  )
}
