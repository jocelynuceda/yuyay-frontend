import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import { createClaimAttempt } from '../../src/utils/profileClaim'
import { api, publicApi, setTokens, clearTokens } from '../../src/services/http'
import type { AuthResponse, CareSubject } from '../../src/types'
import { getCareAuthorizationHistory, getCareSubject } from '../../src/services/api/careSubjects'
import { checkSubjectName, emitClaimInvitation, exchangeProfileClaim, listClaimInvitations, revokeClaimInvitation } from '../../src/services/api/profileClaims'
import { control, expectHttpFailure, integrationFailure } from './support/control'

async function main() {
  const origin = process.env.YUYAY_SUMMARY_TEST_URL
  if (origin !== 'http://127.0.0.1:18068') throw new Error('Usa la instancia local aislada.')
  api.defaults.baseURL = publicApi.defaults.baseURL = origin + '/api/v1'
  async function account(): Promise<AuthResponse> {
    const response = await fetch(origin + '/api/v1/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'claim.' + crypto.randomUUID() + '@example.invalid', name: 'Cuenta ficticia QA',
        password: 'Ficticia123', termsAccepted: true, termsVersion: '1.0' }),
    })
    assert.equal(response.status, 201)
    return response.json()
  }
  async function subject(type = 'LEGAL_REPRESENTATION', birthDate: string | null = '2000-01-01'): Promise<CareSubject> {
    return (await api.post('/care-subjects', { requestId: crypto.randomUUID(), name: 'Persona ficticia QA', birthDate,
      declaration: { type, textVersion: '1', confirmed: true } })).data
  }
  async function tokenFromMail(email: string, count: number) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const messages = await control('/outbox', { email }) as string[]
      const links = messages.flatMap((html) => [...html.matchAll(/\/entrega\/([A-Za-z0-9_-]+)/g)].map((match) => match[1]))
      if (messages.filter((html) => html.includes('/entrega/')).length >= count && links.length) return links.at(-1)!
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('No llegó la invitación al buzón local de pruebas.')
  }
  const caregiver = await account()
  const recipient = await account()
  const outsider = await account()
  try {
    setTokens(caregiver)
    const person = await subject()
    const entry = (await api.post('/care-subjects/' + person.id + '/health-entries',
      { categoryCode: 'ALLERGY', title: 'Registro enteramente ficticio', confidenceLevel: 'CONFIRMED' })).data
    assert.equal((await checkSubjectName(person.id, '00000000')).result, 'UNAVAILABLE')
    const invitation = await emitClaimInvitation(person.id, recipient.user.email)
    assert.equal(invitation.pending, true)
    assert.equal('token' in invitation, false)
    assert.equal('claimLink' in invitation, false)
    const firstToken = await tokenFromMail(recipient.user.email, 1)

    setTokens(outsider)
    await expectHttpFailure(exchangeProfileClaim(firstToken), 403)
    await expectHttpFailure(getCareSubject(person.id), 403)
    await expectHttpFailure(emitClaimInvitation(person.id, outsider.user.email), 403)

    setTokens(caregiver)
    const second = await emitClaimInvitation(person.id, recipient.user.email)
    const secondToken = await tokenFromMail(recipient.user.email, 2)
    assert.notEqual(firstToken, secondToken, 'Reemitir debe crear otra llave')
    setTokens(recipient)
    await expectHttpFailure(exchangeProfileClaim(firstToken), 409)
    await expectHttpFailure(exchangeProfileClaim('enlace-inexistente-para-pruebas'), 404)
    setTokens(caregiver)
    await revokeClaimInvitation(person.id, second.id)
    assert.ok((await listClaimInvitations(person.id)).find((item) => item.id === second.id)?.revokedAt)
    setTokens(recipient)
    await expectHttpFailure(exchangeProfileClaim(secondToken), 409)

    setTokens(caregiver)
    const expired = await emitClaimInvitation(person.id, recipient.user.email)
    const expiredToken = await tokenFromMail(recipient.user.email, 3)
    await control('/expire-claim', { invitationId: expired.id })
    setTokens(recipient)
    await expectHttpFailure(exchangeProfileClaim(expiredToken), 409)

    setTokens(caregiver)
    await emitClaimInvitation(person.id, recipient.user.email)
    const validToken = await tokenFromMail(recipient.user.email, 4)
    setTokens(recipient)
    const result = await exchangeProfileClaim(validToken)
    assert.equal(result.careSubjectId, person.id)
    assert.equal(result.role, 'PRINCIPAL')
    assert.ok(result.claimedAt)
    assert.equal((await getCareSubject(person.id)).myRole, 'PRINCIPAL')
    const declarations = await getCareAuthorizationHistory(person.id)
    assert.equal(declarations[0].type, 'SELF')
    assert.equal(declarations[0].declaredByUserId, recipient.user.id)
    const stored = (await api.get('/care-subjects/' + person.id + '/health-entries/' + entry.id)).data
    assert.equal(stored.latestVersion.id, entry.latestVersion.id)
    await expectHttpFailure(exchangeProfileClaim(validToken), 409)

    setTokens(caregiver)
    assert.equal((await getCareSubject(person.id)).myRole, 'CAREGIVER')
    await expectHttpFailure(emitClaimInvitation(person.id, recipient.user.email), 403)
    const notice = (await api.get('/notifications', { params: { size: 100 } })).data
    const notifications = Array.isArray(notice) ? notice : notice.content
    assert.ok(notifications.some((item: { type: string; careSubjectId: number }) => item.type === 'PROFILE_CLAIMED' && item.careSubjectId === person.id))

    const anotherRecipient = await account()
    setTokens(caregiver)
    const uncertainPerson = await subject()
    await emitClaimInvitation(uncertainPerson.id, anotherRecipient.user.email)
    const uncertainToken = await tokenFromMail(anotherRecipient.user.email, 1)
    setTokens(anotherRecipient)
    let exchanges = 0
    const attempt = createClaimAttempt(async () => {
      exchanges++
      await exchangeProfileClaim(uncertainToken)
      throw new AxiosError('Respuesta descartada después del canje real', 'ERR_NETWORK')
    }, uncertainToken)
    await attempt.submit()
    await attempt.submit()
    assert.equal(attempt.getSnapshot().phase, 'uncertain')
    assert.equal(exchanges, 1, 'Un canje incierto no debe volver a enviarse')
    assert.equal((await getCareSubject(uncertainPerson.id)).myRole, 'PRINCIPAL')
    attempt.dispose()
    console.log('PASS pérdida de respuesta de canje: transferencia HTTP real completada, estado incierto y segundo envío bloqueado.')
    setTokens(caregiver)

    const fictitious = await subject('FICTITIOUS')
    await expectHttpFailure(emitClaimInvitation(fictitious.id, recipient.user.email), 409)
    const noDate = await subject('LEGAL_REPRESENTATION', null)
    await expectHttpFailure(emitClaimInvitation(noDate.id, recipient.user.email), 400)
    console.log('PASS entrega HTTP real: buzón local, emisión, reemisión, revocación, vencimiento, cuenta ajena, canje único, declaración SELF, roles, historial y aviso.')
  } finally { clearTokens() }
}
void main().catch(integrationFailure)
