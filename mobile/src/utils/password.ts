export function utf8Bytes(value: string): number {
  return Array.from(value).reduce((total, character) => {
    const point = character.codePointAt(0)!;
    if (point <= 0x7f) return total + 1;
    if (point <= 0x7ff) return total + 2;
    return total + (point <= 0xffff ? 3 : 4);
  }, 0);
}

/** Mismas reglas que el backend: al menos 8 caracteres, hasta 72 bytes UTF-8, una letra y un número. */
export function passwordChecks(password: string) {
  return [
    { ok: password.length >= 8, label: '8 caracteres' },
    { ok: utf8Bytes(password) <= 72, label: 'Longitud admitida' },
    { ok: /[A-Za-z]/.test(password), label: 'Una letra' },
    { ok: /\d/.test(password), label: 'Un número' },
  ];
}
