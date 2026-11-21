import assert from 'node:assert/strict';
import test from 'node:test';
import { createSummaryReview } from '../src/utils/summaryReview.ts';
import { newSummaryRequestId } from '../src/utils/summaryRequestId.ts';
import type { ConsultationPreparation, ConfirmPreparation } from '../src/types/consultationPreparation.ts';
import type { HandoffDetail } from '../src/types/index.ts';

const version = {
  id: 31, versionNumber: 1, changeType: 'CREATED' as const, title: 'Registro ficticio',
  details: 'Detalle revisado', dose: null, frequency: null, occurredOn: null,
  confidenceLevel: 'CONFIRMED' as const, notes: 'Nota revisada', declaredBy: { id: 1, name: 'Ficticio' },
  declaredAt: '2026-11-21T00:00:00Z', sourceAttachmentId: null,
}
const preparation: ConsultationPreparation = {
  consultationId: 5, careSubjectId: 2, reason: 'Control ficticio', preparationToken: 'token-original',
  categories: [{ categoryCode: 'ALLERGY', entries: [{ entryId: 12, versionId: 31, version }] }],
}
const saved: HandoffDetail = {
  id: 9, careSubjectId: 2, createdByUserId: 1, reason: 'Guardado', questions: 'Pregunta guardada',
  createdAt: '2026-11-21T00:00:00Z',
  items: [{ ...version, healthEntryId: 12, healthEntryVersionId: 31, categoryCode: 'ALLERGY' }],
}
function model(confirm: (body: ConfirmPreparation) => Promise<HandoffDetail>, prepare = async () => preparation) {
  return createSummaryReview({
    prepare, confirm, newId: () => crypto.randomUUID(),
    status: (error) => (error as { status?: number }).status,
    errorMessage: () => 'Error ficticio',
  })
}
test('conserva la versiÃ³n visible, selecciÃ³n, campos y cuerpo exacto ante un resultado incierto', async () => {
  const bodies: ConfirmPreparation[] = []
  const review = model(async (body) => {
    bodies.push(body)
    if (bodies.length === 1) throw { status: 503 }
    return saved
  })
  await review.load()
  review.edit({ reason: 'Motivo editado', questions: 'Preguntas editadas' })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'uncertain')
  review.edit({ reason: 'Cambio prohibido' })
  assert.equal(review.cancel(), false)
  await review.save()
  assert.equal(bodies[0], bodies[1])
  assert.deepEqual(bodies[1].entries, [{ entryId: 12, versionId: 31 }])
  assert.equal(bodies[1].preparationToken, 'token-original')
  assert.equal(bodies[1].reason, 'Motivo editado')
  assert.equal(review.getSnapshot().saved, saved)
})
test('409 recarga las versiones sin perder el texto y exige una nueva revisiÃ³n', async () => {
  let reads = 0
  const bodies: ConfirmPreparation[] = []
  const review = model(async (body) => {
    bodies.push(body)
    if (bodies.length === 1) throw { status: 409 }
    return saved
  }, async () => ++reads === 1 ? preparation : {
    ...preparation, preparationToken: 'token-nuevo',
    categories: [{ categoryCode: 'ALLERGY', entries: [{ entryId: 12, versionId: 32, version: { ...version, id: 32, title: 'Actualizado' } }] }],
  })
  await review.load()
  review.edit({ reason: 'Mi motivo', questions: 'Mi pregunta' })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'editing')
  assert.equal(review.getSnapshot().reason, 'Mi motivo')
  assert.equal(review.getSnapshot().questions, 'Mi pregunta')
  await review.save()
  assert.equal(bodies.length, 1)
  review.review()
  await review.save()
  assert.notEqual(bodies[0].requestId, bodies[1].requestId)
  assert.equal(bodies[1].preparationToken, 'token-nuevo')
  assert.deepEqual(bodies[1].entries, [{ entryId: 12, versionId: 32 }])
})
test('cancelar y desmarcar no escriben; preparaciÃ³n vacÃ­a permite guardar', async () => {
  let writes = 0
  const review = model(async () => { writes++; return saved })
  await review.load()
  review.edit({ selected: [] })
  assert.equal(review.cancel(), true)
  await review.save()
  assert.equal(writes, 0)
  const empty = model(async (body) => { assert.deepEqual(body.entries, []); return saved }, async () => ({ ...preparation, categories: [] }))
  await empty.load()
  empty.review()
  await empty.save()
  assert.equal(empty.getSnapshot().phase, 'saved')
})
test('403 borra los datos privados y 400 permite corregir el formulario', async () => {
  for (const status of [400, 401, 403, 404]) {
    const review = model(async () => { throw { status } })
    await review.load()
    review.review()
    await review.save()
    assert.equal(review.getSnapshot().phase, status === 400 ? 'editing' : 'error')
    if (status !== 400) assert.equal(review.getSnapshot().preparation, null)
  }
})


test('requestId es un UUID v4 y cambia entre operaciones', () => {
  const first = newSummaryRequestId()
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(first, newSummaryRequestId())
})

test('un fallo al recargar tras 409 conserva el borrador para volver a intentar la preparación', async () => {
  let reads = 0
  const review = model(async () => { throw { status: 409 } }, async () => {
    if (++reads === 2) throw { status: 503 }
    return preparation
  })
  await review.load()
  review.edit({ reason: 'Motivo conservado', questions: 'Pregunta conservada', selected: [] })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'error')
  await review.load()
  assert.equal(review.getSnapshot().reason, 'Motivo conservado')
  assert.equal(review.getSnapshot().questions, 'Pregunta conservada')
  assert.deepEqual(review.getSnapshot().selected, [])
  assert.equal(review.getSnapshot().phase, 'editing')
})

test('pulsar guardar dos veces comparte la escritura y cancelar una carga no guarda', async () => {
  let writes = 0
  let release!: () => void
  const review = model(async () => {
    writes++
    await new Promise<void>((resolve) => { release = resolve })
    return saved
  })
  await review.load()
  review.review()
  const first = review.save()
  await review.save()
  assert.equal(writes, 1)
  release()
  await first
  assert.equal(review.getSnapshot().phase, 'saved')
  let finishLoad!: (value: ConsultationPreparation) => void
  const cancelled = model(async () => { throw new Error('No debe guardar') },
    () => new Promise<ConsultationPreparation>((resolve) => { finishLoad = resolve }))
  const loading = cancelled.load()
  assert.equal(cancelled.cancel(), true)
  finishLoad(preparation)
  await loading
  assert.equal(cancelled.getSnapshot().preparation, null)
})
