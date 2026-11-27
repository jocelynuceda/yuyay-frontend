/**
 * Clave de un intento de guardado: reintentar el mismo contenido repite la clave, para que el
 * servidor reconozca lo que ya guardó; si el contenido cambia, es un intento nuevo.
 */
export function createAttemptKey(newId: () => string) {
  let last: { content: string; id: string } | null = null;
  return (payload: unknown): string => {
    const content = JSON.stringify(payload);
    if (last?.content !== content) last = { content, id: newId() };
    return last.id;
  };
}
