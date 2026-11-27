/** El servidor negó el acceso al recurso o este ya no está disponible. */
export function isAccessLost(status: number | undefined): status is 403 | 404 | 410 {
  return status === 403 || status === 404 || status === 410
}
