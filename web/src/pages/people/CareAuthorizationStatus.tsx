import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useFetch } from '../../hooks/useFetch'
import { getCareAuthorizationHistory } from '../../services/api/careSubjects'
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
    <Card as="section" className="grid gap-2">
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
            <summary className="cursor-pointer text-sm font-semibold text-primary">Ver historial de declaraciones</summary>
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
        <p className="text-sm text-muted">Sin declaración registrada</p>
      )}
    </Card>
  )
}
