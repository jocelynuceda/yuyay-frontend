import assert from 'node:assert/strict'
import { test } from 'node:test'
import { avatarId, avatarOptions, defaultAvatar, lionForAge, parseAvatarId } from '../src/utils/avatars'

test('lionForAge: leoncito antes de los 18, abuelo desde los 60 y adulto si no hay edad', () => {
  assert.equal(lionForAge(0), 'cub')
  assert.equal(lionForAge(17), 'cub')
  assert.equal(lionForAge(18), 'adult')
  assert.equal(lionForAge(59), 'adult')
  assert.equal(lionForAge(60), 'elder')
  assert.equal(lionForAge(null), 'adult')
})

test('defaultAvatar elige por edad y alterna león y leona por id', () => {
  assert.deepEqual(defaultAvatar(7, 2), { kind: 'cub', variant: 'lion' })
  assert.deepEqual(defaultAvatar(7, 3), { kind: 'cub', variant: 'lioness' })
  assert.deepEqual(defaultAvatar(40, 3), { kind: 'adult', variant: 'lioness' })
  assert.deepEqual(defaultAvatar(80), { kind: 'elder', variant: 'lion' })
})

test('parseAvatarId acepta solo opciones del selector', () => {
  assert.deepEqual(parseAvatarId('cub-lioness'), { kind: 'cub', variant: 'lioness' })
  assert.deepEqual(parseAvatarId('elder-lioness'), { kind: 'elder', variant: 'lioness' })
  assert.equal(parseAvatarId('dragon'), null)
  assert.equal(parseAvatarId(null), null)
  assert.equal(avatarOptions.length, 6)
  assert.ok(avatarOptions.every((o) => parseAvatarId(avatarId(o)) !== null))
})
