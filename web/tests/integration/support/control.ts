import assert from 'node:assert/strict'
import axios from 'axios'

export async function control(path: '/outbox' | '/expire-claim', body: object): Promise<unknown> {
  const key = process.env.YUYAY_QA_CONTROL_KEY
  if (!key || key.length < 32 || process.env.YUYAY_SUMMARY_TEST_URL !== 'http://127.0.0.1:18068') {
    throw new Error('Usa el runner local aislado para ejecutar esta prueba.')
  }
  const response = await fetch('http://127.0.0.1:18069' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-QA-Control': key },
    body: JSON.stringify(body),
  })
  assert.equal(response.status, 200, 'El control local debe responder correctamente')
  return response.json()
}


export async function expectHttpFailure(action: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(action, (error: unknown) => axios.isAxiosError(error)
    && error.response?.status === status
    && (code === undefined || error.response.data?.code === code))
}

export function integrationFailure(error: unknown) {
  // Axios incluye cabeceras y cuerpos en su representación; nunca imprimir el objeto completo.
  const detail = axios.isAxiosError(error)
    ? 'HTTP ' + (error.response?.status ?? 'sin respuesta') + ' ' + (error.response?.data?.code ?? '')
    : error instanceof Error ? error.name : 'Error'
  console.error('FAIL integración local: ' + detail)
  if (error instanceof Error) {
    const frames = error.stack?.split('\n').filter((line) => line.trim().startsWith('at ')).slice(0, 3)
    if (frames?.length) console.error(frames.join('\n'))
  }
  process.exitCode = 1
}
