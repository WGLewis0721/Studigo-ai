/** The credential-free synthetic sandbox must never become a production auth bypass. */
export function localBetaAllowed(request: Request, env: { NODE_ENV?: string; STUDIGO_LOCAL_BETA?: string } = process.env): boolean {
  if (env.NODE_ENV !== 'development' || env.STUDIGO_LOCAL_BETA !== '1') return false;
  const url = new URL(request.url);
  if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return false;
  const host = request.headers.get('host');
  if (host && host !== url.host) return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return false;
  if (['cross-site','same-site'].includes(request.headers.get('sec-fetch-site') ?? '')) return false;
  return true;
}
