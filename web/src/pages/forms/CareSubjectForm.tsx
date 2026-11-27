import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import type { z } from 'zod'
import {
  careSubjectFields,
  careSubjectSchema,
  careSubjectToForm,
  emptyCareSubject,
  type CareSubjectFormValues,
} from '../../schemas/careSubject'
import { createCareSubject, updateCareSubject } from '../../services/api/careSubjects'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DatePicker } from '../../components/ui/DatePicker'
import { useCareAuthorization } from '../../hooks/useCareAuthorization'
import type { CareSubject, CareSubjectRequest } from '../../types'
import type { CareSubjectCreation } from '../../types/careAuthorization'
import { applyServerErrors, getErrorStatus } from '../../utils/apiErrors'
import { creationOutcomeUncertain, prepareCareSubjectCreation, type CreationAttempt } from '../../utils/careAuthorization'
import { yesterdayIso, MIN_YEAR } from '../../schemas/common'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, GenderField, ServerError } from './fields'
import { CareAuthorizationFields } from './CareAuthorizationFields'

/** Nueva persona (sin `subject`) o editar persona (con `subject`). Pensado para ir dentro de un modal. */
export function CareSubjectForm({
  subject,
  inModal = false,
  onSaved,
  onCancel,
  onCreationLockChange,
}: {
  subject?: CareSubject
  /** Dentro de un modal: sin tarjeta ni título propios, y el foco empieza en el nombre. */
  inModal?: boolean
  onSaved: (subject: CareSubject) => void
  onCancel?: () => void
  onCreationLockChange?: (locked: boolean) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const authorization = useCareAuthorization(!subject)
  const attempt = useRef<CreationAttempt<CareSubjectRequest> | null>(null)
  const posting = useRef(false)
  const [checking, setChecking] = useState(false)
  const [mustCheck, setMustCheck] = useState(false)
  const [leavingUncertain, setLeavingUncertain] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CareSubjectFormValues, unknown, z.output<typeof careSubjectSchema>>({
    resolver: zodResolver(careSubjectSchema),
    defaultValues: subject ? careSubjectToForm(subject) : emptyCareSubject,
    mode: 'onChange',
  })

  const { field: birthDate } = useController({ control, name: 'birthDate' })

  useEffect(() => {
    if (!inModal) return
    // El modal se abre después de montar el formulario
    const frame = requestAnimationFrame(() => setFocus('name'))
    return () => cancelAnimationFrame(frame)
  }, [inModal, setFocus])

  async function submitCreation(request: CareSubjectCreation<CareSubjectRequest>) {
    if (posting.current) return
    posting.current = true
    onCreationLockChange?.(true)
    setServerError(null)
    setChecking(true)
    try {
      const saved = await createCareSubject(request)
      attempt.current = null
      onCreationLockChange?.(false)
      setMustCheck(false)
      onSaved(saved)
    } catch (error) {
      const status = getErrorStatus(error)
      const uncertain = creationOutcomeUncertain(status, attempt.current?.uncertain)
      attempt.current = { request, uncertain }
      setMustCheck(uncertain)
      onCreationLockChange?.(uncertain)
      if (status === 409) authorization.review()
      const message = applyServerErrors(error, setError, careSubjectFields)
      setServerError(uncertain ? 'No pudimos confirmar si la persona se guardó. Comprueba el guardado para continuar.' : message)
    } finally {
      posting.current = false
      setChecking(false)
    }
  }

  async function saveForm(values: z.output<typeof careSubjectSchema>) {
    if (!subject) {
      if (mustCheck || !authorization.declaration) return
      const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
      await submitCreation(prepareCareSubjectCreation(attempt.current, authorization.declaration, values, newId))
      return
    }

    setServerError(null)
    try {
      onSaved(await updateCareSubject(subject.id, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, careSubjectFields))
    }
  }

  return (
    <FormShell
      title={subject ? 'Editar persona' : 'Agregar persona'}
      description={subject ? 'Actualiza los datos de la persona.' : 'Indica quién es la persona y cómo se autoriza el uso de sus datos.'}
      bare={inModal}
      onSubmit={(event) => void handleSubmit(saveForm)(event)}
    >
      <ServerError message={serverError} />
      {!subject && <CareAuthorizationFields authorization={authorization} disabled={checking || mustCheck} />}

      <fieldset disabled={checking || mustCheck} className="grid gap-5">
        <Field id="subject-name" label="Nombre" error={errors.name}>
          <input autoComplete="off" maxLength={120} {...a11yProps('subject-name', errors.name)} {...register('name')} />
        </Field>

        <Field id="subject-birthDate" label="Fecha de nacimiento (opcional)" error={errors.birthDate}>
          <DatePicker value={birthDate.value ?? ''} onChange={birthDate.onChange} onBlur={birthDate.onBlur} min={`${MIN_YEAR}-01-01`} max={yesterdayIso()} {...a11yProps('subject-birthDate', errors.birthDate)} />
        </Field>

        <GenderField field={register('gender')} />

        <Field
          id="subject-notes"
          label="Notas (opcional)"
          hint="Lo que conviene saber de un vistazo: idioma, movilidad, contacto de emergencia…"
          error={errors.notes}
        >
          <textarea rows={3} maxLength={500} {...a11yProps('subject-notes', errors.notes, 'hint')} {...register('notes')} />
        </Field>
      </fieldset>

      {mustCheck ? (
        <div className="flex flex-wrap justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={() => setLeavingUncertain(true)} disabled={checking}>Salir del formulario</Button>
          )}
          <Button type="button" loading={checking} onClick={() => {
            if (attempt.current) void submitCreation(attempt.current.request)
          }}>Comprobar guardado</Button>
        </div>
      ) : (
        <FormActions
          submitting={isSubmitting || checking}
          submitDisabled={!subject && !authorization.declaration}
          submitLabel={subject ? 'Guardar cambios' : 'Agregar persona'}
          onCancel={onCancel}
        />
      )}
      {mustCheck && onCancel && (
        <ConfirmDialog
          open={leavingUncertain}
          title="¿Salir del formulario?"
          message="La persona puede haberse guardado. Revisa la lista de personas antes de intentar agregarla de nuevo."
          confirmLabel="Salir"
          onCancel={() => setLeavingUncertain(false)}
          workingLabel="Saliendo…"
          onConfirm={async () => onCancel()}
        />
      )}
    </FormShell>
  )
}
