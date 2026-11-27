import assert from 'node:assert/strict'
import axios from 'axios'
import { api, publicApi, setTokens, clearTokens } from '../../src/services/http'
import { prepareConsultation, confirmConsultation } from '../../src/services/api/consultations'
import { getHandoff, createHandoffSession, openHandoffSession, listHandoffSessions } from '../../src/services/api/handoffs'
import { createSummaryReview } from '../../src/utils/summaryReview'

import { getHandoffAccessCode } from '../../src/services/security/handoffAccess'
import { advanceClock, expectHttpFailure, integrationFailure } from './support/control'
import { registerTestAccount } from './support/auth'

async function main() {
const origin = process.env.YUYAY_SUMMARY_TEST_URL
if (origin !== 'http://127.0.0.1:18068') throw new Error('Esta prueba requiere la instancia local aislada en el puerto 18068.')
api.defaults.baseURL = origin + '/api/v1'
publicApi.defaults.baseURL = origin + '/api/v1'
setTokens(await registerTestAccount('summary51'))
try {
  const subject = (await api.post('/care-subjects', {
    requestId: crypto.randomUUID(), name: 'Persona ficticia',
    declaration: { type: 'FICTITIOUS', textVersion: '1', confirmed: true },
  })).data
  const appointment = (await api.post(`/care-subjects/${subject.id}/consultations`, {
    date: '2027-01-15', reason: 'Control ficticio',
  })).data
  assert.deepEqual((await prepareConsultation(appointment.id)).categories, [])
  const entry = (await api.post(`/care-subjects/${subject.id}/health-entries`, {
    categoryCode: 'ALLERGY', title: 'Registro ficticio inicial', confidenceLevel: 'CONFIRMED',
  })).data
  const review = createSummaryReview({
    prepare: () => prepareConsultation(appointment.id),
    confirm: (body) => confirmConsultation(appointment.id, body),
    newId: () => crypto.randomUUID(),
    status: (error) => axios.isAxiosError(error) ? error.response?.status : undefined,
    errorMessage: (error) => String(error),
  })
  await review.load()
  review.edit({ questions: 'Pregunta ficticia revisada' })
  review.review()
  await api.patch(`/care-subjects/${subject.id}/health-entries/${entry.id}`, {
    title: 'Registro ficticio actualizado', confidenceLevel: 'CONFIRMED',
  })
  await review.save()
  assert.equal(review.getSnapshot().phase, 'editing')
  assert.match(review.getSnapshot().message ?? '', /información cambió/)
  assert.equal(review.getSnapshot().questions, 'Pregunta ficticia revisada')
  assert.equal(review.getSnapshot().preparation?.categories[0].entries[0].version.title, 'Registro ficticio actualizado')
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'saved')
  const saved = review.getSnapshot().saved!
  assert.equal(saved.questions, 'Pregunta ficticia revisada')
  assert.equal(saved.items[0].title, 'Registro ficticio actualizado')
  assert.deepEqual(await listHandoffSessions(saved.id), [])
  assert.deepEqual(await getHandoff(saved.id), saved)
  await api.patch(`/care-subjects/${subject.id}/health-entries/${entry.id}`, {
    title: 'Cambio ficticio posterior', confidenceLevel: 'CONFIRMED',
  })
  const link = await createHandoffSession(saved.id, { expiresInHours: 1, sessionWindowMinutes: 15, allowDownload: true })
  const visitor = { visitorName: 'Medico ficticio', visitorRole: 'DOCTOR' }
  const initialCode = await getHandoffAccessCode(link.id)
  assert.equal(initialCode.consumed, false)
  await expectHttpFailure(openHandoffSession(link.token, visitor), 403, 'HANDOFF_CODE_REQUIRED')
  const incorrectCode = initialCode.code === '000000' ? '111111' : '000000'
  await expectHttpFailure(openHandoffSession(link.token, { ...visitor, accessCode: incorrectCode }), 403, 'HANDOFF_CODE_INVALID')
  await advanceClock(31)
  let currentCode = await getHandoffAccessCode(link.id)
  for (let i = 0; currentCode.code === initialCode.code && i < 10; i++) {
    await advanceClock(31)
    currentCode = await getHandoffAccessCode(link.id)
  }
  assert.notEqual(currentCode.code, initialCode.code, 'El reloj debe alcanzar un código distinto')
  await expectHttpFailure(openHandoffSession(link.token, { ...visitor, accessCode: initialCode.code! }), 403, 'HANDOFF_CODE_INVALID')
  const shared = await openHandoffSession(link.token, { ...visitor, accessCode: currentCode.code! })
  assert.deepEqual(shared.items, saved.items)
  assert.equal((await getHandoffAccessCode(link.id)).consumed, true)
  await expectHttpFailure(openHandoffSession(link.token, { ...visitor, accessCode: currentCode.code! }), 403, 'HANDOFF_CODE_USED')
  const pdfPath = '/public/handoff-sessions/' + encodeURIComponent(link.token) + '/summary.pdf'
  await expectHttpFailure(publicApi.get(pdfPath), 403, 'HANDOFF_ACCESS_GRANT_REQUIRED')
  const pdf = await publicApi.get<ArrayBuffer>(pdfPath, {
    responseType: 'arraybuffer', headers: { 'X-Handoff-Access': shared.accessGrant! },
  })
  assert.equal(pdf.headers['content-type'], 'application/pdf')
  assert.equal(Buffer.from(pdf.data).subarray(0, 5).toString(), '%PDF-')
  await advanceClock(31)
  const reopenCode = await getHandoffAccessCode(link.id)
  const reopened = await openHandoffSession(link.token, { ...visitor, accessCode: reopenCode.code! })
  assert.deepEqual(reopened.items, saved.items)
  assert.equal(reopened.accessExpiresAt, shared.accessExpiresAt, 'Reabrir no prolonga la lectura')
  await api.delete('/handoff-sessions/' + link.id)
  await expectHttpFailure(openHandoffSession(link.token, { ...visitor, accessCode: reopenCode.code! }), 410)
  await expectHttpFailure(publicApi.get(pdfPath, { headers: { 'X-Handoff-Access': shared.accessGrant! } }), 410)

  const shortLink = await createHandoffSession(saved.id, { expiresInMinutes: 3, sessionWindowMinutes: 1, allowDownload: true })
  const shortCode = await getHandoffAccessCode(shortLink.id)
  const shortRead = await openHandoffSession(shortLink.token, { ...visitor, accessCode: shortCode.code! })
  assert.equal(Date.parse(shortRead.accessExpiresAt!) - Date.parse(shortRead.serverTime!), 60_000)
  await advanceClock(61)
  await expectHttpFailure(openHandoffSession(shortLink.token, visitor), 410)
  await expectHttpFailure(publicApi.get('/public/handoff-sessions/' + encodeURIComponent(shortLink.token) + '/summary.pdf',
    { headers: { 'X-Handoff-Access': shortRead.accessGrant! } }), 410)

  const expiredLink = await createHandoffSession(saved.id, { expiresInMinutes: 1, sessionWindowMinutes: 1 })
  await advanceClock(61)
  await expectHttpFailure(openHandoffSession(expiredLink.token, visitor), 410)
  await expectHttpFailure(getHandoffAccessCode(expiredLink.id), 410)

  const noDownload = await createHandoffSession(saved.id, { expiresInMinutes: 3, sessionWindowMinutes: 1, allowDownload: false })
  const noDownloadCode = await getHandoffAccessCode(noDownload.id)
  const noDownloadRead = await openHandoffSession(noDownload.token, { ...visitor, accessCode: noDownloadCode.code! })
  await expectHttpFailure(publicApi.get('/public/handoff-sessions/' + encodeURIComponent(noDownload.token) + '/summary.pdf',
    { headers: { 'X-Handoff-Access': noDownloadRead.accessGrant! } }), 403)
  console.log('PASS seguridad HTTP: códigos ausente, incorrecto, vencido, válido y consumido; PDF, reapertura, lectura y enlaces vencidos/revocados.')
  // Pérdida de respuesta simulada en el cliente, después de un guardado HTTP real.
  let sent: string | null = null
  let attempts = 0
  const uncertain = createSummaryReview({
    prepare: () => prepareConsultation(appointment.id),
    confirm: async (body) => {
      if (sent) assert.equal(JSON.stringify(body), sent)
      sent = JSON.stringify(body)
      const result = await confirmConsultation(appointment.id, body)
      if (++attempts === 1) throw new Error('Respuesta descartada para probar recuperación')
      return result
    },
    newId: () => crypto.randomUUID(),
    status: () => undefined,
    errorMessage: () => 'Respuesta descartada',
  })
  await uncertain.load()
  uncertain.review()
  await uncertain.save()
  assert.equal(uncertain.getSnapshot().phase, 'uncertain')
  await uncertain.save()
  assert.equal(uncertain.getSnapshot().phase, 'saved')
  assert.equal(attempts, 2)
  console.log('PASS integración HTTP real: preparación vacía y con registros, 409, nueva revisión, guardado, reapertura, contenido público congelado y reintento idempotente.')
  console.log('La pérdida de respuesta se simuló en el cliente después de un POST real exitoso.')
} finally {
  clearTokens()
}

}
void main().catch(integrationFailure)
