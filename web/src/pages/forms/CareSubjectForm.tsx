import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import {
  careSubjectFields,
  careSubjectSchema,
  careSubjectToForm,
  emptyCareSubject,
  type CareSubjectFormValues,
} from '../../schemas/careSubject'
import { LoadError } from '../../components/layout/LoadError'
import { useFetch } from '../../hooks/useFetch'
import { createCareSubject, getAuthorizationPolicy, updateCareSubject } from '../../services/api/careSubjects'
import type { CareSubject } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import {
  buildDeclaration,
  createRequestIdTracker,
  emptyAuthorizationChoice,
  isConflict,
  type AuthorizationChoice,
} from '../../utils/authorization'
import { yesterdayIso, MIN_YEAR } from '../../schemas/common'
import { AuthorizationDeclarationField } from './AuthorizationDeclarationField'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, GenderField, ServerError } from './fields'

/** Nueva persona (sin `subject`) o editar persona (con `subject`). Pensado para ir dentro de un modal. */
export function CareSubjectForm({
  subject,
  inModal = false,
  onSaved,
  onCancel,
}: {
  subject?: CareSubject
  /** Dentro de un modal: sin tarjeta ni título propios, y el foco empieza en el nombre. */
  inModal?: boolean
  onSaved: (subject: CareSubject) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const creating = !subject
  // Al crear, la persona declara cómo está autorizada (backend #69). Editar no la vuelve a pedir.
  const policy = useFetch((signal) => (creating ? getAuthorizationPolicy(signal) : Promise.resolve(null)), [creating])
  const [choice, setChoice] = useState<AuthorizationChoice>(emptyAuthorizationChoice)
  const [choiceError, setChoiceError] = useState<string | null>(null)
  const [requestIdFor] = useState(() => createRequestIdTracker())
  const {
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

  useEffect(() => {
    if (!inModal) return
    // El modal se abre después de montar el formulario
    const frame = requestAnimationFrame(() => setFocus('name'))
    return () => cancelAnimationFrame(frame)
  }, [inModal, setFocus])

  const declarationFor = (current: AuthorizationChoice) => {
    if (!policy.data) {
      setChoiceError('Todavía se está cargando la declaración. Inténtalo en un momento.')
      return null
    }
    const result = buildDeclaration(policy.data, current)
    setChoiceError(result.ok ? null : result.error)
    return result.ok ? result.declaration : null
  }

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    if (subject) {
      try {
        onSaved(await updateCareSubject(subject.id, values))
      } catch (error) {
        setServerError(applyServerErrors(error, setError, careSubjectFields))
      }
      return
    }
    const declaration = declarationFor(choice)
    if (!declaration) return
    try {
      const body = { ...values, declaration }
      onSaved(await createCareSubject({ ...body, requestId: requestIdFor(body) }))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, careSubjectFields))
      if (isConflict(error)) {
        // Puede haber cambiado el texto: se vuelve a cargar y se pide confirmar de nuevo
        setChoice((current) => ({ ...current, confirmed: false }))
        policy.reload()
      }
    }
  })

  const onSubmit: typeof submit = (event) => {
    // Avisa de la declaración aunque falte otro campo, para corregir todo de una vez
    if (creating) declarationFor(choice)
    return submit(event)
  }

  return (
    <FormShell
      title={subject ? 'Editar persona' : 'Agregar persona'}
      description="La persona a la que cuidan. Solo el nombre es obligatorio."
      bare={inModal}
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />

      <Field id="subject-name" label="Nombre" error={errors.name}>
        <input autoComplete="off" maxLength={120} {...a11yProps('subject-name', errors.name)} {...register('name')} />
      </Field>

      <Field id="subject-birthDate" label="Fecha de nacimiento (opcional)" error={errors.birthDate}>
        <input type="date" min={`${MIN_YEAR}-01-01`} max={yesterdayIso()} {...a11yProps('subject-birthDate', errors.birthDate)} {...register('birthDate')} />
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

      {creating ? (
        policy.error ? (
          <LoadError message={policy.error} status={policy.errorStatus} onRetry={policy.reload} />
        ) : policy.data ? (
          <AuthorizationDeclarationField
            policy={policy.data}
            value={choice}
            onChange={(next) => {
              setChoice(next)
              setChoiceError(null)
            }}
            error={choiceError}
          />
        ) : (
          <p className="text-sm text-muted">Cargando la declaración de autorización…</p>
        )
      ) : null}

      <FormActions
        submitting={isSubmitting}
        submitLabel={subject ? 'Guardar cambios' : 'Agregar persona'}
        onCancel={onCancel}
      />
    </FormShell>
  )
}
