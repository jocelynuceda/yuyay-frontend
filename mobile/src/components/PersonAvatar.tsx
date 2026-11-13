import { useAvatar } from '../hooks/useAvatar';
import { ageFrom } from '../utils/format';
import { LionAvatar } from './LionAvatar';

/** Avatar de una persona cuidada: el que se eligió en su perfil o el automático por edad. */
export function SubjectAvatar({
  subject,
  size,
  animated,
}: {
  subject: { id: number; birthDate: string | null };
  size: number;
  animated?: boolean;
}) {
  const { avatar } = useAvatar({ type: 'subject', id: subject.id, age: ageFrom(subject.birthDate) });
  return <LionAvatar kind={avatar.kind} variant={avatar.variant} size={size} animated={animated} />;
}

/** Avatar del usuario con sesión iniciada. */
export function MyAvatar({ size, animated }: { size: number; animated?: boolean }) {
  const { avatar } = useAvatar({ type: 'me' });
  return <LionAvatar kind={avatar.kind} variant={avatar.variant} size={size} animated={animated} />;
}
