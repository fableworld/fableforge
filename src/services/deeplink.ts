/**
 * Deep link parser & validator for fableforge:// protocol.
 *
 * Supported formats:
 *   fableforge://character?id=<id>&registry=<encoded_url>
 */

import { normalizeUrl } from '@/lib/url';

// --- Types ---

export interface DeepLinkRequest {
  type: 'character';
  characterId: string;
  registryUrl: string;
  rawUrl: string;
}

export type DeepLinkParseError =
  | { code: 'INVALID_URL'; message: string }
  | { code: 'WRONG_PROTOCOL'; message: string }
  | { code: 'UNKNOWN_HOST'; message: string }
  | { code: 'MISSING_PARAM'; param: string; message: string }
  | { code: 'INVALID_ID'; message: string }
  | { code: 'INVALID_REGISTRY'; message: string };

export type DeepLinkParseResult =
  | { ok: true; data: DeepLinkRequest }
  | { ok: false; error: DeepLinkParseError };

// --- Validation ---

/**
 * Valid character ID: alphanumeric plus -_.:+
 * Must be 1–256 chars, non-empty.
 */
const CHARACTER_ID_REGEX = /^[a-zA-Z0-9\-_.:+]{1,256}$/;

export function validateCharacterId(id: string): boolean {
  return CHARACTER_ID_REGEX.test(id);
}

/**
 * Validate a registry URL: must be a valid http(s) URL.
 */
export function validateRegistryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// --- Parser ---

/**
 * Parse a raw deep link URL string into a structured request.
 *
 * Expected format: fableforge://character?id=<id>&registry=<url>
 * The `registry` parameter should be percent-encoded.
 */
export function parseDeepLink(rawUrl: string): DeepLinkParseResult {
  // Trim whitespace
  const trimmed = rawUrl.trim();

  // Parse as URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_URL',
        message: `Non è possibile analizzare l'URL: ${trimmed}`,
      },
    };
  }

  // Check protocol
  if (parsed.protocol !== 'fableforge:') {
    return {
      ok: false,
      error: {
        code: 'WRONG_PROTOCOL',
        message: `Protocollo non supportato: ${parsed.protocol}`,
      },
    };
  }

  // The "host" for fableforge://character is "character"
  // In URL parsing, fableforge://character?... -> hostname = "character"
  const host = parsed.hostname;
  if (host !== 'character') {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_HOST',
        message: `Tipo di deep link sconosciuto: ${host}`,
      },
    };
  }

  // Extract parameters
  const id = parsed.searchParams.get('id');
  const registry = parsed.searchParams.get('registry');

  if (!id) {
    return {
      ok: false,
      error: {
        code: 'MISSING_PARAM',
        param: 'id',
        message: 'Parametro "id" mancante nel deep link.',
      },
    };
  }

  if (!registry) {
    return {
      ok: false,
      error: {
        code: 'MISSING_PARAM',
        param: 'registry',
        message: 'Parametro "registry" mancante nel deep link.',
      },
    };
  }

  // Validate character ID
  if (!validateCharacterId(id)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ID',
        message: `ID personaggio non valido: "${id}". Sono ammessi solo caratteri alfanumerici e i simboli -_.:+`,
      },
    };
  }

  // Validate registry URL (it comes already decoded from URLSearchParams)
  if (!validateRegistryUrl(registry)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_REGISTRY',
        message: `URL del registry non valido: "${registry}"`,
      },
    };
  }

  return {
    ok: true,
    data: {
      type: 'character',
      characterId: id,
      registryUrl: normalizeUrl(registry),
      rawUrl: trimmed,
    },
  };
}
