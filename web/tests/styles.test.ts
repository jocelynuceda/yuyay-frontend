import assert from 'node:assert/strict'
import test from 'node:test'
import { linkActiveClass, linkSecondaryClass } from '../src/utils/styles'

test('el atajo activo cambia el fondo y el texto, y conserva el resto del estilo', () => {
  const classes = (value: string) => value.split(/\s+/)
  assert.ok(classes(linkActiveClass).includes('bg-primary'))
  assert.ok(classes(linkActiveClass).includes('text-white'))
  assert.ok(!classes(linkActiveClass).includes('bg-card'))
  assert.ok(!classes(linkActiveClass).includes('text-ink'))
  assert.equal(linkActiveClass.replace('bg-primary', 'bg-card').replace('text-white', 'text-ink'), linkSecondaryClass)
})
