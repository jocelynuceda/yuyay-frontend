import { z } from 'zod'
import type { HandoffRequest, HandoffSessionRequest, OpenHandoffRequest } from '../types'
import { optionalText, requiredText } from './common'

/** Nuevo traspaso: paso 1 elige registros, paso 2 motivo y preguntas, paso 3 revisa. */
export const handoffSchema = z.object({
  healthEntryIds: z.array(z.number().int()).min(1, 'Elige al menos un registro.'),
  reason: requiredText('Escribe el motivo del traspaso.'),
  questions: optionalText(),
}) satisfies z.ZodType<HandoffRequest, unknown>

export type HandoffFormValues = z.input<typeof handoffSchema>
export const handoffFields = Object.keys(handoffSchema.shape) as (keyof HandoffFormValues)[]

/** Campos a validar (`trigger`) antes de pasar al siguiente paso. */
export const handoffStepFields: (keyof HandoffFormValues)[][] = [['healthEntryIds'], ['reason', 'questions'], []]

export const emptyHandoff: HandoffFormValues = { healthEntryIds: [], reason: '', questions: '' }

/** Enlace temporal para el médico. */
export const handoffSessionSchema = z.object({
  expiresInHours: z.coerce
    .number<string | number>('Escribe un número.')
    .int('Debe ser un número entero.')
    .min(1, 'Mínimo 1 hora.')
    .max(72, 'Máximo 72 horas.'),
  sessionWindowMinutes: z.coerce
    .number<string | number>('Escribe un número.')
    .int('Debe ser un número entero.')
    .min(1, 'Mínimo 1 minuto.'),
}) satisfies z.ZodType<HandoffSessionRequest, unknown>

export type HandoffSessionFormValues = z.input<typeof handoffSessionSchema>
export const emptyHandoffSession: HandoffSessionFormValues = { expiresInHours: 24, sessionWindowMinutes: 30 }

/** Vista pública /traspaso/:token: el visitante se identifica antes de ver los datos. */
export const openHandoffSchema = z.object({
  visitorName: requiredText('Ingrese su nombre.', 120),
  visitorRole: requiredText('Ingrese su rol.', 80),
}) satisfies z.ZodType<OpenHandoffRequest, unknown>

export type OpenHandoffFormValues = z.input<typeof openHandoffSchema>
export const openHandoffFields = Object.keys(openHandoffSchema.shape) as (keyof OpenHandoffFormValues)[]
export const emptyOpenHandoff: OpenHandoffFormValues = { visitorName: '', visitorRole: '' }
