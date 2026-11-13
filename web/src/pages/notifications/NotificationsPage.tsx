import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadError } from '../../components/layout/LoadError'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon } from '../../components/ui/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { useFetch } from '../../hooks/useFetch'
import { usePagination } from '../../hooks/usePagination'
import { useToast } from '../../hooks/useToast'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { listMyPendingInvitations } from '../../services/api/caregivers'
import { listNotifications, markNotificationRead } from '../../services/api/notifications'
import { getErrorMessage } from '../../utils/apiErrors'
import { formatDateTime, formatRelative, notificationTypeLabels } from '../../utils/format'
import { linkClass, linkButtonClass } from '../../utils/styles'
import { getNotificationLink, type PendingInvitations } from './notificationLink'

const FILTER_PARAM = 'filter'
const UNREAD_VALUE = 'unread'

export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { page, size, apiPage, setPage, setSize } = usePagination()
  const toast = useToast()
  const unreadCount = useUnreadCount()
  const onlyUnread = searchParams.get(FILTER_PARAM) === UNREAD_VALUE
  const [markedRead, setMarkedRead] = useState<ReadonlySet<number>>(new Set())
  const [pendingId, setPendingId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { data, error, loading, reload } = useFetch(
    (signal) => listNotifications({ unread: onlyUnread ? true : undefined, page: apiPage, size }, signal),
    [onlyUnread, apiPage, size],
  )

  // Independiente de la lista: su carga o error no bloquea los avisos
  const invitations = useFetch((signal) => listMyPendingInvitations(signal), [])
  const pending = useMemo<PendingInvitations>(
    () => ({
      status: invitations.data ? 'ready' : invitations.error ? 'error' : 'loading',
      bySubject: new Map((invitations.data ?? []).map((rel) => [rel.careSubjectId, rel.id])),
    }),
    [invitations.data, invitations.error],
  )

  const setFilter = useCallback(
    (unread: boolean) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        params.delete('page')
        if (unread) params.set(FILTER_PARAM, UNREAD_VALUE)
        else params.delete(FILTER_PARAM)
        return params
      })
    },
    [setSearchParams],
  )

  const lastValidPage = data ? Math.max(1, data.totalPages) : null
  useEffect(() => {
    if (lastValidPage === null || page <= lastValidPage) return
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (lastValidPage > 1) params.set('page', String(lastValidPage))
        else params.delete('page')
        return params
      },
      { replace: true },
    )
  }, [lastValidPage, page, setSearchParams])

  async function markRead(id: number) {
    setPendingId(id)
    try {
      await markNotificationRead(id)
      setMarkedRead((current) => new Set(current).add(id))
      toast.success('Aviso marcado como leído.')
      unreadCount.refresh()
      listRef.current?.focus()
      if (onlyUnread) reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPendingId(null)
    }
  }

  const items = data?.content ?? []
  const outOfRange = lastValidPage !== null && page > lastValidPage
  const initialLoading = (loading && !data) || outOfRange

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Avisos"
        description="Cambios en los registros de salud e invitaciones."
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Avisos' }]}
        actions={
          <div role="group" aria-label="Filtrar avisos" className="flex gap-2">
            <Button variant={onlyUnread ? 'secondary' : 'primary'} size="sm" aria-pressed={!onlyUnread} onClick={() => setFilter(false)}>
              Todas
            </Button>
            <Button variant={onlyUnread ? 'primary' : 'secondary'} size="sm" aria-pressed={onlyUnread} onClick={() => setFilter(true)}>
              Sin leer
            </Button>
          </div>
        }
      />

      {error && !data ? (
        <LoadError message={error} onRetry={reload} />
      ) : initialLoading ? (
        <div className="grid gap-3">
          <p role="status" className="sr-only">
            Cargando avisos…
          </p>
          {[0, 1, 2].map((key) => (
            <Card key={key} padding="sm">
              <Skeleton lines={3} />
            </Card>
          ))}
        </div>
      ) : (
        <div ref={listRef} tabIndex={-1} aria-busy={loading} className="grid gap-4 outline-none">
          {error ? <LoadError message={error} onRetry={reload} /> : null}
          {items.length === 0 ? (
            <EmptyState
              icon={<Icon name="bell" className="h-10 w-10" />}
              title={onlyUnread ? 'No tienes avisos sin leer' : 'No tienes avisos'}
              description={
                onlyUnread
                  ? 'Estás al día. Cuando haya novedades aparecerán aquí.'
                  : 'Te avisaremos cuando alguien cambie un registro de salud o te invite a cuidar a una persona.'
              }
              action={
                onlyUnread ? (
                  <Button variant="secondary" onClick={() => setFilter(false)}>
                    Ver todos los avisos
                  </Button>
                ) : (
                  <Link to="/people" className={linkButtonClass}>
                    Ver personas
                  </Link>
                )
              }
            />
          ) : (
            <ul className={`grid gap-3 ${loading ? 'opacity-60' : ''}`}>
              {items.map((item) => {
                const read = item.read || markedRead.has(item.id)
                const link = getNotificationLink(item, pending)
                return (
                  <li key={item.id}>
                    <Card as="article" padding="sm" className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {read ? null : (
                            <>
                              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />
                              <span className="sr-only">Sin leer.</span>
                            </>
                          )}
                          <h2 className="font-sans text-base font-semibold">{item.title}</h2>
                          <Badge>{notificationTypeLabels[item.type] ?? item.type}</Badge>
                        </div>
                        <p className="text-muted">{item.body}</p>
                        <p className="text-sm text-muted">
                          <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                            {formatRelative(item.createdAt)}
                          </time>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {link ? (
                          <Link to={link.to} className={linkClass}>
                            {link.label}
                          </Link>
                        ) : null}
                        {read ? null : (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={pendingId === item.id}
                            disabled={pendingId !== null}
                            onClick={() => void markRead(item.id)}
                          >
                            Marcar como leído
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
          {data && data.totalElements > 0 ? (
            <Pagination
              page={page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              size={size}
              onPageChange={setPage}
              onSizeChange={setSize}
            />
          ) : null}
        </div>
      )}
    </main>
  )
}
