import { useEffect, useState } from 'react'
import { createMedicalTermMatcher, type MedicalTermMatcher, type MedicalTermsData } from '../utils/medicalTermMatcher'

let cached: Promise<MedicalTermMatcher> | null = null

function loadMatcher(): Promise<MedicalTermMatcher> {
  cached ??= import('../data/medicalTerms.json')
    .then((module) => createMedicalTermMatcher(module.default as MedicalTermsData))
    .catch((error: unknown) => {
      cached = null
      throw error
    })
  return cached
}

/** Carga el diccionario médico bajo demanda. Devuelve null mientras carga o si falla. */
export function useMedicalTermMatcher(): MedicalTermMatcher | null {
  const [matcher, setMatcher] = useState<MedicalTermMatcher | null>(null)
  useEffect(() => {
    let active = true
    loadMatcher().then(
      (loaded) => {
        if (active) setMatcher(loaded)
      },
      () => {},
    )
    return () => {
      active = false
    }
  }, [])
  return matcher
}
