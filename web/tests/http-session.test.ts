// Pruebas de comportamiento del cliente HTTP del PR #10 contra un backend simulado
// con las mismas reglas que dbp-yuyay (PR #50): el refresh token es de un solo uso
// y cada /auth/refresh exitoso revoca el anterior y entrega un par nuevo.
import assert from 'node:assert/strict'
import test from 'node:test'

class MemoryStorage {
  data = new Map<string, string>()
  failWrites = false
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { if (this.failWrites) throw new Error('QuotaExceeded'); this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

function fakeBackend() {
  let n = 0
  const refresh = new Map<string, boolean>() // token -> activo
  const access = new Set<string>()
  const calls = { refresh: 0, data: 0 }
  let refreshMode: 'ok' | 'network' | '401' = 'ok'
  let refreshDelay = 20
  let responseDelay = 0
  const issue = () => {
    n += 1
    const pair = { accessToken: `A${n}`, refreshToken: `R${n}`, tokenType: 'Bearer', expiresInSeconds: 3600, user: { id: 1, name: 'Ana' } }
    access.add(pair.accessToken); refresh.set(pair.refreshToken, true)
    return pair
  }
  const err = (config: any, status: number) => Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true, config, response: { status, data: { message: `HTTP ${status}` }, headers: {}, config },
  })
  const adapter = async (config: any) => {
    const url: string = config.url
    if (url.endsWith('/auth/refresh')) {
      calls.refresh += 1
      await new Promise((r) => setTimeout(r, refreshDelay))
      if (refreshMode === 'network') throw Object.assign(new Error('Network Error'), { isAxiosError: true, config, code: 'ERR_NETWORK' })
      const { refreshToken } = JSON.parse(config.data)
      if (refreshMode === '401' || !refresh.get(refreshToken)) throw err(config, 401)
      refresh.set(refreshToken, false)
      const pair = issue()
      await new Promise((r) => setTimeout(r, responseDelay))
      return { status: 200, data: pair, headers: {}, config }
    }
    if (url.endsWith('/auth/logout')) {
      refresh.set(JSON.parse(config.data).refreshToken, false)
      return { status: 204, data: '', headers: {}, config }
    }
    calls.data += 1
    if (url.includes('slow')) await new Promise((r) => setTimeout(r, 80))
    const h = config.headers?.get ? config.headers.get('Authorization') : config.headers?.Authorization
    const token = typeof h === 'string' ? h.replace('Bearer ', '') : ''
    if (!access.has(token)) throw err(config, 401)
    return { status: 200, data: { ok: true, token }, headers: {}, config }
  }
  return {
    adapter, calls, refresh, access, issue,
    expireAccess: () => access.clear(),
    set mode(m: typeof refreshMode) { refreshMode = m },
    set delay(ms: number) { refreshDelay = ms },
    set latency(ms: number) { responseDelay = ms },
    activeRefreshTokens: () => [...refresh].filter(([, a]) => a).map(([t]) => t),
  }
}

let instance = 0
async function setup() {
  const storage = new MemoryStorage()
  ;(globalThis as any).sessionStorage = storage
  ;(globalThis as any).__API_URL = 'http://api.test'
  const http = await import(`../src/services/http.ts?i=${++instance}`)
  const backend = fakeBackend()
  http.api.defaults.adapter = backend.adapter
  http.publicApi.defaults.adapter = backend.adapter
  let expired = 0
  http.setSessionExpiredHandler(() => { expired += 1 })
  const login = () => http.setTokens(backend.issue())
  return { http, backend, storage, expiredCount: () => expired, login }
}

test('1. Tres peticiones con el access vencido hacen UN solo refresh y las tres terminan bien', async () => {
  const { http, backend, login } = await setup()
  login(); backend.expireAccess()
  const results = await Promise.all([http.api.get('/a'), http.api.get('/b'), http.api.get('/c')])
  assert.equal(backend.calls.refresh, 1)
  assert.deepEqual(results.map((r: any) => r.data.ok), [true, true, true])
})

test('2. Refresh rechazado con 401 (token vencido o revocado): borra la sesión y avisa una vez', async () => {
  const { http, backend, storage, expiredCount, login } = await setup()
  login(); backend.expireAccess(); backend.mode = '401'
  const r = await Promise.allSettled([http.api.get('/a'), http.api.get('/b')])
  assert.ok(r.every((x) => x.status === 'rejected'))
  assert.equal(backend.calls.refresh, 1)
  assert.equal(storage.getItem('yuyay.refreshToken'), null)
  assert.equal(expiredCount(), 1)
})

test('3. Refresh sin red: la petición falla pero la sesión se conserva para reintentar', async () => {
  const { http, backend, storage, expiredCount, login } = await setup()
  login(); backend.expireAccess(); backend.mode = 'network'
  await assert.rejects(http.api.get('/a'))
  assert.equal(storage.getItem('yuyay.refreshToken'), 'R1')
  assert.equal(expiredCount(), 0)
  backend.mode = 'ok'
  const ok = await http.api.get('/a')
  assert.equal(ok.data.ok, true)
})

test('4. Un 401 tardío del access viejo no dispara un segundo refresh', async () => {
  const { http, backend, login } = await setup()
  login(); backend.expireAccess()
  // /slow sale con A1 y su 401 llega DESPUÉS de que /fast ya renovó a A2
  const [slow, fast] = await Promise.all([http.api.get('/slow'), http.api.get('/fast')])
  assert.equal(backend.calls.refresh, 1)
  assert.equal(fast.data.token, 'A2')
  assert.equal(slow.data.token, 'A2', 'reintentó con el access nuevo sin pedir otro refresh')
})

test('5. Recarga de página: refreshAuthSession inicial y peticiones tempranas comparten el mismo refresh', async () => {
  const { http, backend, storage } = await setup()
  backend.issue() // R1 queda activo en el servidor
  storage.setItem('yuyay.refreshToken', 'R1') // sesión guardada, access aún no existe en memoria
  const [session, data] = await Promise.all([http.refreshAuthSession(), http.api.get('/temprana')])
  assert.equal(backend.calls.refresh, 1)
  assert.equal(session.user.name, 'Ana')
  assert.equal(data.data.ok, true)
})

test('6. Logout durante un refresh en vuelo: el refresh nuevo queda revocado', async () => {
  const { http, backend, login } = await setup()
  login(); backend.expireAccess(); backend.delay = 0; backend.latency = 50
  const pending = http.api.get('/a').catch(() => 'rechazada')
  await new Promise((r) => setTimeout(r, 10))
  const token = http.getRefreshToken()
  http.clearTokens()
  await http.publicApi.post('/auth/logout', { refreshToken: token }).catch(() => {})
  assert.equal(await pending, 'rechazada')
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(backend.activeRefreshTokens(), [], 'R2 debe quedar revocado')
})

test('7. Si sessionStorage falla al guardar tras rotar, la sesión sigue funcionando desde memoria', async () => {
  const { http, backend, storage, expiredCount, login } = await setup()
  login(); backend.expireAccess()
  storage.failWrites = true
  const a = await http.api.get('/a')
  assert.equal(a.data.token, 'A2')
  backend.expireAccess()
  const b = await http.api.get('/b')
  assert.equal(b.data.token, 'A3', 'usó R2 desde memoria')
  assert.equal(expiredCount(), 0)
})

test('8. Un fallo de removeItem y de revocación no vuelve a autenticar la pestaña tras logout', async () => {
  const { http, backend, storage, login } = await setup()
  login()
  const refreshToken = http.getRefreshToken()
  storage.removeItem = () => { throw new Error('Storage cannot remove this key') }
  http.publicApi.defaults.adapter = async (config: Parameters<typeof backend.adapter>[0]) => {
    if (config.url.endsWith('/auth/logout')) throw new Error('Network Error')
    return backend.adapter(config)
  }

  http.clearTokens()
  await assert.rejects(http.publicApi.post('/auth/logout', { refreshToken }))
  assert.equal(storage.getItem('yuyay.refreshToken'), 'R1', 'la copia persistida no se pudo borrar')

  const result = await http.api.get('/after-logout').then(
    (response: { data: { token: string } }) => response.data.token,
    (error: { response?: { status: number } }) => error.response?.status,
  )
  assert.equal(result, 401, 'una petición protegida no debe renovar el token después del logout local')
  assert.equal(backend.calls.refresh, 0)
  assert.equal(http.getAccessToken(), null)
})

