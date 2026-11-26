import { z } from 'zod'
import { durationUnits } from '../utils/accessDurations'

export const durationSchema = z.object({ amount: z.string(), unit: z.enum(durationUnits) })
