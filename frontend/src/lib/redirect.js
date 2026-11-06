const BASE = 'http://shop.invalid';

/**
 * Returns the path to follow after signing in. Only a path inside this site passes, so the next
 * parameter cannot send anyone to another origin ("//evil.test", "/\evil.test", "https://...").
 * The normalised path is checked too: "/.//evil.test" comes out as "//evil.test", which the router
 * treats as an absolute URL.
 */
export function safeRedirect(target, fallback = '/') {
  if (typeof target !== 'string' || !target.startsWith('/') || /[\\\s]/.test(target)) return fallback;

  try {
    const url = new URL(target, BASE);
    if (url.origin !== BASE || url.pathname.startsWith('//')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPath(next) {
  return `/login?next=${encodeURIComponent(next)}`;
}
