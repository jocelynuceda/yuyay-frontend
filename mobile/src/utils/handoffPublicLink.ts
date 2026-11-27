const DEPLOYED_WEB_ORIGIN = 'https://yuyay-frontend.vercel.app';

/** La URL pública usa la web oficial o su configuración explícita; nunca se infiere del host API. */
export function handoffPublicOrigin(configuredWebUrl?: string, development = false): string {
  const candidate = configuredWebUrl?.trim() || DEPLOYED_WEB_ORIGIN;
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('No está disponible el enlace público de esta aplicación.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || /^(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname);
  if ((url.protocol !== 'https:' && !(development && local && url.protocol === 'http:'))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('No está disponible el enlace público de esta aplicación.');
  }
  return url.origin;
}

export function handoffPublicLink(origin: string, token: string): string {
  return `${origin}/handoff/${encodeURIComponent(token)}`;
}
