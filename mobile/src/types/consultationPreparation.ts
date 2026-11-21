import type { HealthEntryVersion } from './index'

export interface ConsultationPreparation {
  consultationId: number
  careSubjectId: number
  reason: string
  preparationToken: string
  categories: {
    categoryCode: string
    entries: { entryId: number; versionId: number; version: HealthEntryVersion }[]
  }[]
}

export interface ConfirmPreparation {
  requestId: string
  preparationToken: string
  reason: string
  questions: string | null
  entries: { entryId: number; versionId: number }[]
}
