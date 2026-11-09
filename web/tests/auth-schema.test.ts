import assert from 'node:assert/strict'
import test from 'node:test'
import { loginSchema, registerSchema, resetPasswordSchema } from '../src/schemas/auth'
import { passwordChecks, passwordError } from '../src/utils/password'

const email = 'ana@example.test'
const name = 'Ana'
const form = (password: string, confirmPassword = password) => ({ name, email, password, confirmPassword })

test('El registro acepta exactamente 72 bytes UTF-8 y rechaza 74 bytes', () => {
  const password = 'A1' + 'ñ'.repeat(35)
  assert.equal(registerSchema.parse(form(password)).password, password)
  assert.equal(registerSchema.safeParse(form(password + 'ñ')).success, false)
})

test('El registro exige ocho caracteres, una letra ASCII y un número', () => {
  for (const password of ['A1corta', 'ñ'.repeat(7) + '1', 'SinNúmero']) {
    assert.equal(registerSchema.safeParse(form(password)).success, false)
  }
  assert.equal(registerSchema.safeParse(form('Clave123')).success, true)
})

test('El registro exige confirmar la misma contraseña', () => {
  const issue = (confirm: string) => registerSchema.safeParse(form('Clave123', confirm)).error?.issues[0].message
  assert.equal(issue(''), 'Confirma tu contraseña.')
  assert.equal(issue('Clave124'), 'Las contraseñas no coinciden.')
})

test('La contraseña nueva usa las mismas reglas y pide un código de 6 dígitos', () => {
  const values = { code: '123456', newPassword: 'Clave123', confirmPassword: 'Clave123' }
  assert.equal(resetPasswordSchema.safeParse(values).success, true)
  assert.equal(resetPasswordSchema.safeParse({ ...values, code: '12345' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ ...values, newPassword: 'corta1', confirmPassword: 'corta1' }).success, false)
  assert.equal(resetPasswordSchema.safeParse({ ...values, confirmPassword: 'Clave124' }).success, false)
})

test('passwordError informa el primer requisito que falta, con el mismo texto que la app móvil', () => {
  assert.equal(passwordError('corta1'), 'Usa al menos 8 caracteres.')
  assert.equal(passwordError('A1' + 'ñ'.repeat(36)), 'La contraseña es demasiado larga. Usa menos caracteres o símbolos.')
  assert.equal(passwordError('ññññ1234'), 'Incluye al menos una letra de la A a la Z.')
  assert.equal(passwordError('SinNumero'), 'Incluye al menos un número.')
  assert.equal(passwordError('Clave123'), null)
})

test('passwordChecks marca cada requisito por separado', () => {
  assert.deepEqual(passwordChecks('ññññ1234').map((c) => c.ok), [true, true, false, true])
  assert.deepEqual(passwordChecks('Clave123').map((c) => c.ok), [true, true, true, true])
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
