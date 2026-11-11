import { useState } from 'react'
import { LoadError } from '../../components/layout/LoadError'
import { getInitials } from '../../components/ui/initials'
import { Modal } from '../../components/ui/Modal'
import { SearchInput } from '../../components/ui/SearchInput'
import { useFetch } from '../../hooks/useFetch'
import { useToast } from '../../hooks/useToast'
import { listCareSubjects } from '../../services/api/careSubjects'
import type { CareSubject } from '../../types'
import { ageFrom } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import type { PeopleParams, PeopleSort } from '../../utils/urlParams'
import { CareSubjectForm } from '../forms/CareSubjectForm'

/** Sin tildes ni mayúsculas, para que "jose" encuentre a "José". */
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function sortSubjects(subjects: CareSubject[], orden: PeopleSort) {
  const byName = (a: CareSubject, b: CareSubject) => a.name.localeCompare(b.name, 'es')
  if (orden === 'nombre') return [...subjects].sort(byName)
  // Por edad, de mayor a menor; sin fecha de nacimiento al final
  return [...subjects].sort((a, b) => {
    const ageA = ageFrom(a.birthDate)
    const ageB = ageFrom(b.birthDate)
    if (ageA === null && ageB === null) return byName(a, b)
    if (ageA === null) return 1
    if (ageB === null) return -1
    return ageB - ageA || byName(a, b)
  })
}

/**
 * /personas: grilla de tarjetas con búsqueda (con espera) y orden. Los filtros viven en la URL:
 * la página los lee con el router y los pasa en `params`; `onParamsChange` avisa para reescribirla.
 */
export function PeopleGrid({
  params,
  onParamsChange,
  onOpen,
}: {
  params: PeopleParams
  onParamsChange: (params: PeopleParams) => void
  onOpen: (subject: CareSubject) => void
}) {
  const { data, error, errorStatus, loading, reload } = useFetch((signal) => listCareSubjects(signal), [])
  const [adding, setAdding] = useState(false)
  const toast = useToast()

  const query = normalize(params.q.trim())
  const subjects = data ?? []
  const visible = sortSubjects(
    query ? subjects.filter((s) => normalize(s.name).includes(query)) : subjects,
    params.orden,
  )

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Personas</h1>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
        >
          Agregar persona
        </button>
      </header>

      <Modal open={adding} onClose={() => setAdding(false)} title="Agregar persona">
        {adding ? (
          <CareSubjectForm
            inModal
            onCancel={() => setAdding(false)}
            onSaved={(subject) => {
              setAdding(false)
              toast.success(`Se agregó a ${subject.name}.`)
              reload()
            }}
          />
        ) : null}
      </Modal>

      <div role="search" className="flex flex-wrap items-end gap-3">
        <SearchInput
          label="Buscar por nombre"
          hideLabel={false}
          value={params.q}
          onSearch={(q) => onParamsChange({ ...params, q })}
          placeholder="Ej. Carmen"
          className="min-w-56 flex-1"
        />
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold">Ordenar por</span>
          <select
            value={params.orden}
            onChange={(e) => onParamsChange({ ...params, orden: e.target.value as PeopleSort })}
            className={`rounded-xl border border-line bg-card px-4 py-2.5 ${focusRing}`}
          >
            <option value="nombre">Nombre (A–Z)</option>
            <option value="edad">Edad (mayor primero)</option>
          </select>
        </label>
      </div>

      {loading && !data ? <p className="text-muted">Cargando personas…</p> : null}
      {error ? <LoadError message={error} status={errorStatus} onRetry={reload} /> : null}

      {data ? (
        <>
          <p aria-live="polite" className="text-sm text-muted">
            {query
              ? `${visible.length} de ${subjects.length} personas coinciden con “${params.q.trim()}”`
              : `${subjects.length} persona${subjects.length === 1 ? '' : 's'}`}
          </p>
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-card p-6 text-muted">
              {subjects.length === 0 ? 'Aún no cuidas a nadie. Agrega a la primera persona.' : 'Nadie coincide con la búsqueda.'}
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((subject) => (
                <li key={subject.id}>
                  <PersonCard subject={subject} onOpen={() => onOpen(subject)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}

function PersonCard({ subject, onOpen }: { subject: CareSubject; onOpen: () => void }) {
  const age = ageFrom(subject.birthDate)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex h-full w-full items-start gap-4 rounded-3xl bg-card p-5 text-left transition hover:shadow-md ${focusRing}`}
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-soft font-semibold text-soft-text">
        {getInitials(subject.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-semibold">{subject.name}</span>
        <span className="block text-sm text-muted">{age !== null ? `${age} años` : 'Edad no registrada'}</span>
        <span className="mt-2 inline-block rounded-full bg-primary-tint px-3 py-0.5 text-xs font-semibold text-primary">
          {subject.myRole === 'PRINCIPAL' ? 'Principal' : 'Cuidador/a'}
        </span>
      </span>
    </button>
  )
}
