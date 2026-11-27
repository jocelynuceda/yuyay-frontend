import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveProfileEdit } from '../src/services/profileEdit.ts';
import type { User } from '../src/types';
import { ageFrom } from '../src/utils/format.ts';

const profile: User = {
  id: 1, name: 'Ana', role: 'USER', email: 'ana@example.invalid',
  birthDate: '1981-05-10', createdAt: '2026-01-01',
};
const draft = { name: profile.name, gender: null, birthDate: null };

test('el borrado confirmado actualiza el perfil y elimina la edad', async () => {
  let saved: User | undefined;
  await saveProfileEdit(draft, profile.birthDate, async (_name, _gender, date) => {
    assert.equal(date, null);
    return { ...profile, birthDate: null };
  }, (user) => { saved = user; }, assert.fail);
  assert.ok(saved);
  assert.equal(ageFrom(saved.birthDate), null);
});

test('una fecha anterior conserva el editor y entrega el aviso del campo de fecha', async () => {
  let dateError: string | undefined;
  await saveProfileEdit(draft, profile.birthDate, async (_name, _gender, date) => {
    assert.equal(date, null);
    return profile;
  }, () => assert.fail('Se aceptó una fecha distinta y se cerró el editor'), (message) => { dateError = message; });
  assert.equal(dateError, 'No pudimos guardar el cambio de la fecha de nacimiento.');
});

test('editar solo el nombre omite la fecha y acepta la respuesta', async () => {
  const renamed = { ...profile, name: 'Ana T.' };
  let saved: User | undefined;
  await saveProfileEdit({ ...draft, name: renamed.name, birthDate: profile.birthDate! }, profile.birthDate,
    async (name, _gender, date) => {
      assert.equal(date, undefined);
      assert.equal(name, renamed.name);
      return renamed;
    }, (user) => { saved = user; }, assert.fail);
  assert.equal(saved, renamed);
});
