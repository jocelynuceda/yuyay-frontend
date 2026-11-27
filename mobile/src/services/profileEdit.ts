import type { Gender, User } from '../types';

type UpdateProfile = (name: string, gender: Gender | null, birthDate?: string | null) => Promise<User>;

/** Cierra el editor solo cuando el servidor confirma la fecha solicitada. */
export async function saveProfileEdit(
  draft: { name: string; gender: Gender | null; birthDate: string | null },
  previousBirthDate: User['birthDate'],
  update: UpdateProfile,
  onSaved: (user: User) => void,
  onBirthDateError: (message: string) => void,
) {
  const changed = draft.birthDate !== (previousBirthDate ?? null);
  const user = await update(draft.name.trim(), draft.gender, changed ? draft.birthDate : undefined);
  if (changed && user.birthDate !== draft.birthDate) {
    onBirthDateError('No pudimos guardar el cambio de la fecha de nacimiento.');
    return;
  }
  onSaved(user);
}
