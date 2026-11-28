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
  const ownProfile = await publicApi.get('/care-subjects', { headers: { Authorization: 'Bearer ' + session.accessToken } })
  assert.equal(ownProfile.data.length, 1, 'El registro crea exactamente un perfil propio')
  const self = ownProfile.data[0]
  assert.equal(self.name, body.name)
  assert.equal(self.myRole, 'PRINCIPAL')
  assert.equal(self.birthDate, session.user.birthDate ?? null, 'El perfil copia la fecha proporcionada por el registro')
  assert.equal(self.notes, null)
  const firstSessionProfile = await publicApi.get('/care-subjects', { headers: { Authorization: 'Bearer ' + registered.data.accessToken } })
  assert.equal(firstSessionProfile.data[0].id, self.id, 'Iniciar sesión no duplica el perfil')
  return session
}
