import { z } from 'zod'
import type { HandoffRequest, HandoffSessionRequest, OpenHandoffRequest } from '../types'
import { defaultHandoffExpiry, defaultHandoffReading, handoffDurations } from '../utils/accessDurations'
import { optionalText, requiredText } from './common'
import { durationSchema } from './duration'

/** Nuevo traspaso: paso 1 elige registros, paso 2 motivo y preguntas, paso 3 revisa. */
export const handoffSchema = z.object({
  healthEntryIds: z.array(z.number().int()).min(1, 'Elige al menos un registro.'),
  reason: requiredText('Escribe el motivo del traspaso.', 200),
  questions: optionalText(500),
}) satisfies z.ZodType<HandoffRequest, unknown>

export type HandoffFormValues = z.input<typeof handoffSchema>
export const handoffFields = Object.keys(handoffSchema.shape) as (keyof HandoffFormValues)[]

/** Campos a validar (`trigger`) antes de pasar al siguiente paso. */
export const handoffStepFields: (keyof HandoffFormValues)[][] = [['healthEntryIds'], ['reason', 'questions'], []]

export const emptyHandoff: HandoffFormValues = { healthEntryIds: [], reason: '', questions: '' }

/** Enlace temporal para el médico. */
export const handoffSessionSchema = z
  .object({ expiry: durationSchema, reading: durationSchema })
  .transform(({ expiry, reading }, ctx) => {
    const result = handoffDurations(expiry, reading)
    if (result.request) return result.request
    for (const [field, message] of Object.entries(result.errors)) {
      if (message) ctx.addIssue({ code: 'custom', path: [field, 'amount'], message })
    }
    return z.NEVER
  }) satisfies z.ZodType<HandoffSessionRequest, unknown>

export type HandoffSessionFormValues = z.input<typeof handoffSessionSchema>
export const emptyHandoffSession: HandoffSessionFormValues = { expiry: defaultHandoffExpiry, reading: defaultHandoffReading }

/** Vista pública /handoff/:token: el visitante se identifica antes de ver los datos. */
export const openHandoffSchema = z.object({
  accessCode: z.string().regex(/^(?:[0-9]{6})?$/, 'Introduce los 6 dígitos del código.').optional().transform((value) => value || undefined),
  visitorName: requiredText('Ingrese su nombre.', 120),
  visitorRole: requiredText('Ingrese su rol.', 80),
}) satisfies z.ZodType<OpenHandoffRequest, unknown>

export type OpenHandoffFormValues = z.input<typeof openHandoffSchema>
export const openHandoffFields = Object.keys(openHandoffSchema.shape) as (keyof OpenHandoffFormValues)[]
export const emptyOpenHandoff: OpenHandoffFormValues = { visitorName: '', visitorRole: '', accessCode: '' }
