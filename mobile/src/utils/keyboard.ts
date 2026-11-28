/**
 * Tecla que activa un botón desde el teclado (Enter o Espacio), sin contar las repeticiones de una tecla
 * mantenida. Sirve para los botones que con el dedo se mantienen presionados: con el teclado se abren directo.
 */
export function isActivationKey(event: { key?: string; repeat?: boolean }): boolean {
  if (event.repeat) return false;
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}
