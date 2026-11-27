/** El DNI devuelve el nombre en mayúsculas; como nombre de usuario se propone con inicial mayúscula. */
export function suggestUserName(fullName: string): string {
  return fullName
    .toLocaleLowerCase('es')
    .split(/([\s'-])/)
    .map((part) => part.charAt(0).toLocaleUpperCase('es') + part.slice(1))
    .join('')
    .slice(0, 120)
    .trim();
}
