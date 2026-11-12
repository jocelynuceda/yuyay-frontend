import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { parsePeopleParams, peopleSearch } from '../../utils/urlParams'
import type { PeopleParams } from '../../utils/urlParams'
import { PeopleGrid } from './PeopleGrid'

export default function PeopleRoute() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const params = useMemo(() => parsePeopleParams(searchParams), [searchParams])
  const updateParams = useCallback((next: PeopleParams) => {
    const search = peopleSearch(next)
    if (search !== searchParams.toString()) setSearchParams(search, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PeopleGrid
        params={params}
        onParamsChange={updateParams}
        onOpen={(subject) => void navigate(`/people/${subject.id}`)}
      />
    </main>
  )
}
