import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { openPendingPerson, pendingPersonPrefix } from '../../utils/pendingPersonDraft'
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
import type { CareSubject, CareSubjectRequest, User } from '../../types'
import type { CareSubjectCreation } from '../../types/careAuthorization'
import { applyServerErrors, getErrorStatus } from '../../utils/apiErrors'
import { creationOutcomeUncertain, prepareCareSubjectCreation, type CreationAttempt, type ProfileKind } from '../../utils/careAuthorization'
import { yesterdayIso, MIN_YEAR } from '../../schemas/common'
import { a11yProps } from './fieldProps'
import { Field, FormActions, FormShell, GenderField, ServerError } from './fields'
import { CareAuthorizationFields } from './CareAuthorizationFields'

const newRequestId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')

/** Nueva persona (sin `subject`) o editar persona (con `subject`). Pensado para ir dentro de un modal. */
export function CareSubjectForm({
  subject,
  account,
  inModal = false,
  onSaved,
  onCancel,
  onCreationLockChange,
}: {
  subject?: CareSubject
  account?: Pick<User, 'id' | 'name' | 'birthDate' | 'gender'> | null
  /** Dentro de un modal: sin tarjeta ni título propios, y el foco empieza en el nombre. */
  inModal?: boolean
  onSaved: (subject: CareSubject) => void
  onCancel?: () => void
  onCreationLockChange?: (locked: boolean) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const draftKey = !subject && account ? `${pendingPersonPrefix}${account.id}` : undefined
  const [draftStore] = useState(() => openPendingPerson(draftKey))
  const savedDraft = draftStore?.draft
  const draftRequestId = useRef(savedDraft?.requestId)
  const authorization = useCareAuthorization(!subject, Boolean(savedDraft))
  const [trackDraft, setTrackDraft] = useState(Boolean(savedDraft))
  const [draftError, setDraftError] = useState<string | null>(null)
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
    getValues,
    subscribe,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CareSubjectFormValues, unknown, z.output<typeof careSubjectSchema>>({
    resolver: zodResolver(careSubjectSchema),
    defaultValues: subject ? careSubjectToForm(subject) : savedDraft ?? emptyCareSubject,
    mode: 'onChange',
  })

  const { field: birthDate } = useController({ control, name: 'birthDate' })
  const savingDraft = trackDraft && authorization.profileKind === 'THIRD_PARTY'
  const updateDraft = useCallback(async (next: string | null) => {
    if (!draftStore) return 'unavailable'
    try {
      const updated = await draftStore.update(next)
      setDraftError(updated ? null : 'El borrador cambió en otra pestaña. Cierra este formulario y vuelve a «Agregar persona» para ver la versión actual.')
      return updated ? 'saved' : 'conflict'
    } catch {
      setDraftError('No pudimos actualizar el borrador en este navegador.')
      return 'unavailable'
    }
  }, [draftStore])
  const persistDraft = useCallback(() => {
    const values = getValues()
    draftRequestId.current ??= newRequestId()
    return updateDraft(JSON.stringify({ ...values, requestId: draftRequestId.current, gender: values.gender || '', birthDate: values.birthDate || '' }))
  }, [getValues, updateDraft])
  useEffect(() => {
    if (!savingDraft) return
    return subscribe({ formState: { values: true }, callback: (change) => { if (change.name) persistDraft() } })
  }, [savingDraft, persistDraft, subscribe])

  function chooseThirdPartyType(next: Parameters<typeof authorization.chooseThirdPartyType>[0]) {
    if (next === 'PENDING') {
      persistDraft()
      setTrackDraft(true)
    }
    authorization.chooseThirdPartyType(next)
  }

  async function discardDraft() {
    if (await updateDraft(null) !== 'saved') return
    setTrackDraft(false)
    delete drafts.current.THIRD_PARTY
    draftRequestId.current = undefined
    attempt.current = null
    reset(emptyCareSubject)
    authorization.chooseThirdPartyType(null)
  }
  const self = !subject && authorization.profileKind === 'SELF'
  const drafts = useRef<Partial<Record<ProfileKind, CareSubjectFormValues>>>({})

  function chooseProfileKind(next: Parameters<typeof authorization.chooseProfileKind>[0]) {
    const previous = authorization.profileKind
    if (previous !== next && (previous || next === 'SELF')) {
      drafts.current[previous ?? 'THIRD_PARTY'] = getValues()
      reset(drafts.current[next] ?? (next === 'SELF' ? {
        name: account?.name ?? '', birthDate: account?.birthDate ?? '', gender: account?.gender ?? '', notes: '',
      } : emptyCareSubject))
    }
    authorization.chooseProfileKind(next)
  }

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
      if (draftKey && savingDraft) {
        setTrackDraft(false)
        await updateDraft(null)
      }
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
      if (savingDraft && await persistDraft() === 'conflict') return
      const requestId = savingDraft ? draftRequestId.current : undefined
      await submitCreation(prepareCareSubjectCreation(attempt.current, authorization.declaration, values, () => requestId ?? newRequestId()))
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
      {!subject && <CareAuthorizationFields authorization={{ ...authorization, chooseProfileKind, chooseThirdPartyType }} disabled={checking || mustCheck} />}

      <fieldset disabled={checking || mustCheck} className="grid gap-5">
        <Field id="subject-name" label="Nombre" error={errors.name}>
          {self ? <>
            <input {...a11yProps('subject-name', errors.name)} readOnly value={`Yo · ${account?.name ?? ''}`} />
            <input type="hidden" {...register('name')} />
          </> : <input autoComplete="off" maxLength={120} {...a11yProps('subject-name', errors.name)} {...register('name')} />}
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

      {savingDraft && draftKey && <div className="grid justify-items-start gap-2">
        <p role="status" className={draftError ? 'text-sm text-danger' : 'text-sm text-muted'}>
          {draftError ?? 'Borrador guardado en este navegador. Puedes retomarlo desde Agregar persona. Se borra al cerrar sesión.'}
        </p>
        {!mustCheck && <Button type="button" variant="secondary" disabled={checking} onClick={discardDraft}>Descartar borrador</Button>}
      </div>}

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
          cancelLabel={savingDraft && !draftError ? 'Cerrar' : 'Cancelar'}
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
