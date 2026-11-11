// Origins the frontend may legitimately be served from in development:
// localhost, private network IPs and nip.io wildcard DNS.
const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/[\d.]+\.nip\.io(:\d+)?$/
];

export function isAllowedOrigin(origin) {
  if (DEV_ORIGIN_PATTERNS.some(pattern => pattern.test(origin))) return true;
  return Boolean(process.env.FRONTEND_URL) && origin === process.env.FRONTEND_URL;
}

// Returns `target` if it is safe to redirect to after login, otherwise null.
// Safe means an http(s) URL on an allowed origin or on the host serving this
// request (so other apps on the same domain, e.g. /roadmap/, are accepted).
export function safeRedirectTarget(target, requestHost) {
  if (typeof target !== 'string') return null;
  let url;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (isAllowedOrigin(url.origin)) return url.href;
  const sameHost = (h) => (h || '').toLowerCase().replace(/:\d+$/, '');
  if (requestHost && sameHost(url.host) === sameHost(requestHost)) return url.href;
  return null;
}
