/** El DNI devuelve el nombre en mayúsculas; como nombre de usuario se propone con inicial mayúscula. */
export function suggestUserName(fullName: string): string {
  return fullName
    .toLocaleLowerCase('es')
    .replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase('es'))
    .slice(0, 120)
    .trim()
}
