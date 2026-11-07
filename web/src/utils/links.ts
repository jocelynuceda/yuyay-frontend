/** Enlace público de la vista del médico (/traspaso/:token). */
export const handoffLink = (token: string) => `${window.location.origin}/traspaso/${encodeURIComponent(token)}`
