import { useState } from 'react'
import { getCareAuthorizationPolicy } from '../services/api/careSubjects'
import { makeCareDeclaration, type ProfileKind, type ThirdPartyType } from '../utils/careAuthorization'
import { useFetch } from './useFetch'

export function useCareAuthorization(enabled = true, resumePending = false) {
  const [profileKind, setProfileKind] = useState<ProfileKind | null>(resumePending ? 'THIRD_PARTY' : null)
  const [thirdPartyType, setThirdPartyType] = useState<ThirdPartyType | null>(resumePending ? 'PENDING' : null)
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null)
  const policy = useFetch((signal) => enabled ? getCareAuthorizationPolicy(signal) : Promise.resolve(null), [enabled])
  const selectedType = profileKind === 'THIRD_PARTY' ? thirdPartyType : profileKind
  const canRead = !policy.loading && !policy.error
  const document = canRead ? policy.data : null
  const option = document?.options.find((candidate) => candidate.type === selectedType)
  const declaration = makeCareDeclaration(document, selectedType, acceptedVersion)

  function chooseProfileKind(next: ProfileKind) {
    if (next === profileKind) return
    setProfileKind(next)
    setThirdPartyType(null)
    setAcceptedVersion(null)
  }

  function chooseThirdPartyType(next: ThirdPartyType | null) {
    if (next === thirdPartyType) return
    setThirdPartyType(next)
    setAcceptedVersion(null)
  }

  function confirm(checked: boolean) {
    setAcceptedVersion(checked ? document?.textVersion ?? null : null)
  }

  function review() {
    setAcceptedVersion(null)
    policy.reload()
  }

  return {
    document, profileKind, thirdPartyType, option, declaration, chooseProfileKind,
    chooseThirdPartyType, confirm, review, loading: policy.loading, error: policy.error,
  }
}
