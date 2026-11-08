import assert from 'node:assert/strict'
import test from 'node:test'
import { loginSchema, registerSchema } from '../src/schemas/auth'

const email = 'ana@example.test'
const name = 'Ana'

test('El registro acepta exactamente 72 bytes UTF-8 y rechaza 74 bytes', () => {
  const password = 'A1' + 'ñ'.repeat(35)
  assert.equal(registerSchema.parse({ name, email, password }).password, password)
  const overLimit = registerSchema.safeParse({ name, email, password: password + 'ñ' })
  assert.equal(overLimit.success, false)
})

test('El registro exige ocho caracteres, una letra ASCII y un número', () => {
  for (const password of ['A1corta', 'ñ'.repeat(7) + '1', 'SinNúmero']) {
    assert.equal(registerSchema.safeParse({ name, email, password }).success, false)
  }
  assert.equal(registerSchema.safeParse({ name, email, password: 'Clave123' }).success, true)
})

test('El login acepta una credencial previa y conserva sus espacios', () => {
  const password = ' ñ '
  assert.equal(loginSchema.parse({ email, password }).password, password)
})

test('El login rechaza una contraseña vacía o compuesta solo por espacios', () => {
  for (const password of ['', '   ', '\t\n\r']) {
    assert.equal(loginSchema.safeParse({ email, password }).success, false)
  }
})
