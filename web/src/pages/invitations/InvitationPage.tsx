import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { acceptInvitation, listMyPendingInvitations } from '../../services/api/caregivers'
import { getErrorMessage } from '../../utils/apiErrors'
import { careRoleLabels, formatDateTime } from '../../utils/format'
import { linkButtonClass } from '../../utils/styles'
import { parseRouteId } from '../../utils/urlParams'

export default function InvitationPage() {
  const { id: rawId } = useParams()
  const id = parseRouteId(rawId)
  const navigate = useNavigate()
  const toast = useToast()
  const [accepting, setAccepting] = useState(false)
  const { data, error, loading, reload } = useFetch(
    (signal) => (id === null ? Promise.resolve([]) : listMyPendingInvitations(signal)),
    [id],
  )
  const invitation = data?.find((item) => item.id === id) ?? null

  async function accept() {
    if (!invitation) return
    setAccepting(true)
    try {
      await acceptInvitation(invitation.id)
      toast.success('Invitación aceptada.')
      void navigate(`/people/${invitation.careSubjectId}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
      setAccepting(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Invitación"
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Invitación' }]}
      />
      {error && !data ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <Card className="grid max-w-2xl gap-3">
          <p role="status" className="sr-only">
            {loading ? 'Cargando invitación…' : ''}
          </p>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton lines={2} />
        </Card>
      ) : invitation ? (
        <Card as="section" aria-labelledby="invitation-title" className="grid max-w-2xl gap-5">
          <div className="grid gap-2">
            <h2 id="invitation-title" className="text-2xl font-bold">
              Te invitaron a cuidar a {invitation.careSubjectName}
            </h2>
            <p className="text-muted">
              Rol: {careRoleLabels[invitation.role] ?? invitation.role}
              {invitation.relationshipLabel ? ` · ${invitation.relationshipLabel}` : ''}
            </p>
            <p className="text-sm text-muted">Invitación enviada el {formatDateTime(invitation.invitedAt)}.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button loading={accepting} onClick={() => void accept()}>
              Aceptar invitación
            </Button>
            <Button variant="secondary" disabled={accepting} onClick={() => void navigate('/')}>
              Ahora no
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Icon name="mail" className="h-10 w-10" />}
          title="Esta invitación ya no está pendiente"
          description="Puede que ya la hayas aceptado o que haya sido enviada a otra cuenta. Si es así, inicia sesión con el correo al que llegó la invitación."
          action={
            <Link to="/people" className={linkButtonClass}>
              Ir a personas
            </Link>
          }
        />
      )}
    </main>
  )
}
