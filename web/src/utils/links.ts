/** Enlace público de la vista del médico (/handoff/:token). */
export const handoffLink = (token: string) => `${window.location.origin}/handoff/${encodeURIComponent(token)}`
