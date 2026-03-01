// ── URL utilities shared across the extension ──────────────────────────────────

/** File extensions that trigger HMR in common dev servers (Vite, webpack, etc.) */
export const HMR_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx',
  '.vue', '.svelte',
  '.css', '.scss', '.sass', '.less', '.styl',
]);

/** Hostnames considered "localhost" for proxy routing. */
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);


/** Returns true if the URL resolves to a local dev server. */
export function isLocalhostUrl(url: string): boolean {
  try { return LOCALHOST_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

/**
 * Normalises a bare hostname/port into a full URL.
 * e.g. "localhost:3000" → "http://localhost:3000"
 */
export function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url) { return 'about:blank'; }
  if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) { url = 'http://' + url; }
  return url;
}
