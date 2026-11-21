import assert from 'node:assert/strict'
import axios from 'axios'
import { api, publicApi, setTokens, clearTokens } from '../../src/services/http'
import { prepareConsultation, confirmConsultation } from '../../src/services/api/consultations'
import { getHandoff, createHandoffSession, openHandoffSession, listHandoffSessions } from '../../src/services/api/handoffs'
import { createSummaryReview } from '../../src/utils/summaryReview'

const origin = process.env.YUYAY_SUMMARY_TEST_URL
if (origin !== 'http://127.0.0.1:18068') throw new Error('Esta prueba requiere la instancia local aislada en el puerto 18068.')
api.defaults.baseURL = origin + '/api/v1'
publicApi.defaults.baseURL = origin + '/api/v1'
const response = await fetch(origin + '/api/v1/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: `summary51.${crypto.randomUUID()}@example.invalid`, name: 'Usuario ficticio',
    password: 'Ficticia123', termsAccepted: true, termsVersion: '1.0',
  }),
})
assert.equal(response.status, 201)
setTokens(await response.json())
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
  const link = await createHandoffSession(saved.id, { expiresInHours: 1, sessionWindowMinutes: 15 })
  const shared = await openHandoffSession(link.token, { visitorName: 'Medico ficticio', visitorRole: 'DOCTOR' })
  assert.deepEqual(shared.items, saved.items)
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
