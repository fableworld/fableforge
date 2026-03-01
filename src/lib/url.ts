/**
 * URL normalization utilities for consistent registry URL comparison.
 */

/**
 * Normalize a URL for consistent comparison:
 * - Lowercase the protocol and hostname
 * - Remove trailing slash
 * - Remove default ports (80 for http, 443 for https)
 * - Preserve path, query, and fragment as-is
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Lowercase protocol and hostname (URL constructor does this for us)
    let normalized = `${parsed.protocol}//${parsed.hostname}`;

    // Remove default ports
    if (parsed.port && !(
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    )) {
      normalized += `:${parsed.port}`;
    }

    // Add path, removing trailing slash (but keep root "/")
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    normalized += path;

    // Preserve query and fragment
    if (parsed.search) {
      normalized += parsed.search;
    }
    if (parsed.hash) {
      normalized += parsed.hash;
    }

    return normalized;
  } catch {
    // If URL can't be parsed, return as-is
    return url;
  }
}

/**
 * Compare two URLs after normalization.
 */
export function urlsMatch(a: string, b: string): boolean {
  return normalizeUrl(a) === normalizeUrl(b);
}
