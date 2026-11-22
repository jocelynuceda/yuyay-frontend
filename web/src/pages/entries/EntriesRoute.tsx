import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useSuccessNotice } from '../../hooks/useSuccessNotice'
import type { CategoryCode, HealthEntry } from '../../types'
import { linkSecondaryClass } from '../../utils/styles'
import { entriesSearch, parseEntriesParams, parseRouteId, type EntriesParams } from '../../utils/urlParams'
import { HealthEntryForm } from '../forms/HealthEntryForm'
import NotFoundPage from '../NotFoundPage'
import { PersonRouteFrame } from '../people/PersonRouteFrame'
import { EntriesPanel } from './EntriesPanel'

export default function EntriesRoute() {
  const { id } = useParams()
  const subjectId = parseRouteId(id)
  useEffect(() => { window.scrollTo(0, 0) }, [subjectId])
  if (subjectId === null) return <NotFoundPage />
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Link to={`/people/${subjectId}?tab=entries`} className={linkSecondaryClass}>
          <span aria-hidden="true">←</span>Regresar al perfil clínico
        </Link>
      </div>
      <PersonRouteFrame key={subjectId} subjectId={subjectId} section="Registros">
        {() => <EntriesPage key={subjectId} subjectId={subjectId} />}
      </PersonRouteFrame>
    </>
  )
}

function EntriesPage({ subjectId }: { subjectId: number }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = parseEntriesParams(searchParams)
  const [newEntry, setNewEntry] = useState<{ category: CategoryCode | null } | null>(null)
  const [revision, setRevision] = useState(0)
  const formRef = useRef<HTMLDivElement>(null)
  const { notify, anchorProps } = useSuccessNotice()

  useEffect(() => { if (newEntry) formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }, [newEntry])

  const updateParams = (next: EntriesParams) => setSearchParams(entriesSearch(next))
  function onSaved(entry: HealthEntry | null) {
    setNewEntry(null)
    if (!entry) return
    updateParams({ ...params, category: params.category ? entry.categoryCode : null, page: 1 })
    setRevision((current) => current + 1)
    notify('Registro guardado.')
  }

  return (
    <div className="grid min-w-0 gap-6">
      <span {...anchorProps} />
      {newEntry ? <div ref={formRef} className="scroll-mt-6">
        <HealthEntryForm key={newEntry.category ?? 'ALL'} subjectId={subjectId}
          initialCategory={newEntry.category ?? undefined} onSaved={onSaved} onCancel={() => setNewEntry(null)} />
      </div> : null}
      <EntriesPanel key={revision} subjectId={subjectId} params={params} headingLevel={1}
        onParamsChange={updateParams} onNewEntry={(category) => setNewEntry({ category })}
        onOpenEntry={(entry) => {
          const search = entriesSearch(params)
          const returnTo = `/people/${subjectId}/entries${search ? `?${search}` : ''}`
          void navigate(`/people/${subjectId}/entries/${entry.id}`, { state: { returnTo } })
        }} />
    </div>
  )
}
