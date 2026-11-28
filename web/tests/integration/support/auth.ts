import assert from 'node:assert/strict'
import { publicApi } from '../../../src/services/http'
import type { AuthResponse, RegisterRequest, TermsDocument } from '../../../src/types/auth'

/** Solo se usa contra el backend H2 del runner, con su directorio sintético de pruebas. */
export async function registerTestAccount(prefix: string): Promise<AuthResponse> {
  if (process.env.YUYAY_SUMMARY_TEST_URL !== 'http://127.0.0.1:18068'
    || publicApi.defaults.baseURL !== 'http://127.0.0.1:18068/api/v1') {
    throw new Error('El alta de fixtures solo se permite en la instancia local aislada.')
  }
  const { data: terms } = await publicApi.get<TermsDocument>('/auth/terms')
  assert.ok(terms.version && terms.text, 'Se consultan los términos vigentes del backend')
  const body: RegisterRequest = {
    email: prefix + '.' + crypto.randomUUID() + '@example.invalid',
    password: 'Ficticia123', name: 'Alias ficticio QA', fullName: 'Persona Sintetica',
    dni: '12345678', termsAccepted: true, termsVersion: terms.version,
  }
  const registered = await publicApi.post<AuthResponse>('/auth/register', body)
  assert.equal(registered.status, 201)
  assert.equal(registered.data.user.name, body.name)
  assert.equal(registered.data.user.fullName, body.fullName)
  assert.equal('dni' in registered.data.user, false)
  const { data: session } = await publicApi.post<AuthResponse>('/auth/login', { email: body.email, password: body.password })
  assert.equal(session.user.id, registered.data.user.id)
  assert.equal(session.user.fullName, body.fullName)
  return session
}
