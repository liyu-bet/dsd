export function resolveAppUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');

  const forwardedProto = req.headers.get('x-forwarded-proto');
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host');
  const proto = forwardedProto || 'https';

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  try {
    return new URL(req.url).origin.replace(/\/+$/, '');
  } catch {
    return 'http://localhost:3000';
  }
}
