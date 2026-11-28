import { useRef, useState } from 'react'
import { useCareAuthorization } from '../../hooks/useCareAuthorization'
import { CareAuthorizationFields } from '../forms/CareAuthorizationFields'
import { getErrorMessage, getErrorStatus } from '../../utils/apiErrors'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useFetch } from '../../hooks/useFetch'
import { getCareAuthorizationHistory, registerFirstDeclaration } from '../../services/api/careSubjects'
import { declarationLabels, scopeLabels } from '../../utils/careAuthorization'
import { formatDateTime } from '../../utils/format'

export function CareAuthorizationStatus({ subjectId }: { subjectId: number }) {
  const { data, error, errorStatus, loading, reload } = useFetch(
    (signal) => getCareAuthorizationHistory(subjectId, signal),
    [subjectId],
  )
  if (errorStatus === 403) return null

  const latest = data?.[0]
  return (
    <Card as="section" className="@container grid gap-2">
      <h2 className="font-semibold">Declaración de autorización</h2>
      {loading ? (
        <p role="status" className="text-sm text-muted">Consultando la declaración…</p>
      ) : error ? (
        <div className="grid justify-items-start gap-2">
          <p role="alert" className="text-sm text-danger">{error}</p>
          <Button variant="secondary" onClick={reload}>Volver a consultar</Button>
        </div>
      ) : latest ? (
        <>
          <p className="text-sm">Declaración registrada · {declarationLabels[latest.type]}</p>
          <p className="text-sm text-muted">Yuyay registra la declaración sin verificar la autorización.</p>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary-fg">Ver historial de declaraciones</summary>
            <ol className="mt-3 grid gap-4">
              {data?.map((declaration) => (
                <li key={declaration.id} className="grid gap-1 rounded-xl border border-line p-3">
                  <p className="text-sm font-semibold">{declarationLabels[declaration.type]}</p>
                  <p className="text-xs text-muted">{scopeLabels[declaration.scope]} · Versión {declaration.textVersion}</p>
                  <time className="text-xs text-muted" dateTime={declaration.declaredAt}>{formatDateTime(declaration.declaredAt)}</time>
                  <p className="whitespace-pre-line text-sm">{declaration.text}</p>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : (
        <FirstDeclaration key={subjectId} subjectId={subjectId} reload={reload} />
      )}
    </Card>
  )
}
function FirstDeclaration({ subjectId, reload }: { subjectId: number; reload: () => void }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const posting = useRef(false)
  const authorization = useCareAuthorization(editing)

  async function save() {
    if (!authorization.declaration || posting.current) return
    posting.current = true
    setSaving(true)
    setError('')
    try {
      await registerFirstDeclaration(subjectId, authorization.declaration)
      reload()
    } catch (e) {
      if ([403, 409].includes(getErrorStatus(e) ?? 0)) reload()
      else setError(getErrorMessage(e))
    } finally {
      posting.current = false
      setSaving(false)
    }
  }

  if (!editing) return <>
    <p className="text-sm text-muted">Sin declaración registrada</p>
    <Button variant="secondary" className="justify-self-start @md:col-start-2 @md:row-span-2 @md:row-start-1 @md:self-center @md:justify-self-end" onClick={() => setEditing(true)}>
      Registrar declaración
    </Button>
  </>

  return <div className="grid justify-items-start gap-3">
    <p className="text-sm text-muted">Sin declaración registrada</p>
    <CareAuthorizationFields authorization={authorization} disabled={saving} existing />
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={!authorization.declaration || saving} onClick={save}>Guardar declaración</Button>
      <Button variant="secondary" disabled={saving} onClick={() => { setEditing(false); authorization.confirm(false); setError('') }}>Cancelar</Button>
    </div>
  </div>
}
