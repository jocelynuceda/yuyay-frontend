/**
 * Indica si un texto no cabe en `maxLines` líneas. Cuenta los saltos de línea y estima
 * cuántas líneas ocupa cada tramo según `charsPerLine` caracteres por línea.
 */
export function isLongText(text: string, maxLines = 3, charsPerLine = 45): boolean {
  const lines = text.split('\n');
  if (lines.length > maxLines) return true;
  const total = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return total > maxLines;
}
