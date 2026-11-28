import { z } from 'zod'
import { email } from './common'

export const claimInvitationSchema = z.object({ invitedEmail: email() })
export const identityCheckSchema = z.object({ dni: z.string().regex(/^[0-9]{8}$/, 'Escribe un DNI de ocho dígitos.') })
