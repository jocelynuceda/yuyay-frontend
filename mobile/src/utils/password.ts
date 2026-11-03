export function utf8Bytes(value: string): number {
  return Array.from(value).reduce((total, character) => {
    const point = character.codePointAt(0)!;
    if (point <= 0x7f) return total + 1;
    if (point <= 0x7ff) return total + 2;
    return total + (point <= 0xffff ? 3 : 4);
  }, 0);
}
