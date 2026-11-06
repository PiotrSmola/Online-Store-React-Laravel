const BASE = 'http://shop.invalid';

/**
 * Returns the path to follow after signing in. Only a path inside this site passes, so the next
 * parameter cannot send anyone to another origin ("//evil.test", "/\evil.test", "https://...").
 */
export function safeRedirect(target, fallback = '/') {
  if (typeof target !== 'string' || !target.startsWith('/') || /[\\\s]/.test(target)) return fallback;

  try {
    const url = new URL(target, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

export function loginPath(next) {
  return `/login?next=${encodeURIComponent(next)}`;
}
