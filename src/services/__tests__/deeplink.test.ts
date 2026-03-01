import { describe, it, expect } from 'vitest';
import {
  parseDeepLink,
  validateCharacterId,
  validateRegistryUrl,
} from '@/services/deeplink';

// --- validateCharacterId ---

describe('validateCharacterId', () => {
  it('accepts simple alphanumeric IDs', () => {
    expect(validateCharacterId('abc123')).toBe(true);
  });

  it('accepts UUIDs', () => {
    expect(validateCharacterId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts IDs with allowed symbols', () => {
    expect(validateCharacterId('char-1_v2.0:draft+final')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateCharacterId('')).toBe(false);
  });

  it('rejects IDs with spaces', () => {
    expect(validateCharacterId('hello world')).toBe(false);
  });

  it('rejects IDs with special chars (XSS attempt)', () => {
    expect(validateCharacterId('<script>alert(1)</script>')).toBe(false);
  });

  it('rejects IDs with path traversal', () => {
    expect(validateCharacterId('../../../etc/passwd')).toBe(false);
  });

  it('rejects IDs longer than 256 chars', () => {
    expect(validateCharacterId('a'.repeat(257))).toBe(false);
  });

  it('accepts IDs at max length (256)', () => {
    expect(validateCharacterId('a'.repeat(256))).toBe(true);
  });
});

// --- validateRegistryUrl ---

describe('validateRegistryUrl', () => {
  it('accepts HTTPS URLs', () => {
    expect(validateRegistryUrl('https://example.com/index.json')).toBe(true);
  });

  it('accepts HTTP URLs', () => {
    expect(validateRegistryUrl('http://example.com/index.json')).toBe(true);
  });

  it('rejects FTP URLs', () => {
    expect(validateRegistryUrl('ftp://example.com/file')).toBe(false);
  });

  it('rejects non-URL strings', () => {
    expect(validateRegistryUrl('not-a-url')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateRegistryUrl('')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(validateRegistryUrl('javascript:alert(1)')).toBe(false);
  });
});

// --- parseDeepLink ---

describe('parseDeepLink', () => {
  const VALID_URL = 'fableforge://character?id=abc-123&registry=https%3A%2F%2Fexample.com%2Findex.json';

  it('parses a valid deep link', () => {
    const result = parseDeepLink(VALID_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe('character');
      expect(result.data.characterId).toBe('abc-123');
      expect(result.data.registryUrl).toBe('https://example.com/index.json');
      expect(result.data.rawUrl).toBe(VALID_URL);
    }
  });

  it('trims whitespace from input', () => {
    const result = parseDeepLink(`  ${VALID_URL}  `);
    expect(result.ok).toBe(true);
  });

  it('normalizes registry URL (trailing slash)', () => {
    const url = 'fableforge://character?id=abc&registry=https%3A%2F%2Fexample.com%2Findex.json%2F';
    const result = parseDeepLink(url);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.registryUrl).toBe('https://example.com/index.json');
    }
  });

  it('returns error for non-fableforge protocol', () => {
    const result = parseDeepLink('https://example.com/page');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WRONG_PROTOCOL');
    }
  });

  it('returns error for unknown host type', () => {
    const result = parseDeepLink('fableforge://unknown?id=a&registry=https%3A%2F%2Fx.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_HOST');
    }
  });

  it('returns error when id param is missing', () => {
    const result = parseDeepLink('fableforge://character?registry=https%3A%2F%2Fx.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_PARAM');
      if (result.error.code === 'MISSING_PARAM') {
        expect(result.error.param).toBe('id');
      }
    }
  });

  it('returns error when registry param is missing', () => {
    const result = parseDeepLink('fableforge://character?id=abc');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_PARAM');
      if (result.error.code === 'MISSING_PARAM') {
        expect(result.error.param).toBe('registry');
      }
    }
  });

  it('returns error for invalid character ID', () => {
    const result = parseDeepLink('fableforge://character?id=<script>&registry=https%3A%2F%2Fx.com%2Fi.json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ID');
    }
  });

  it('returns error for invalid registry URL', () => {
    const result = parseDeepLink('fableforge://character?id=abc&registry=not-a-url');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_REGISTRY');
    }
  });

  it('returns error for totally unparseable input', () => {
    const result = parseDeepLink(';;;not a url at all!!!');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_URL');
    }
  });

  it('returns error for empty string', () => {
    const result = parseDeepLink('');
    expect(result.ok).toBe(false);
  });

  it('handles double-encoded registry URL gracefully', () => {
    // Double-encoded: https%253A%252F%252Fexample.com → decodes to https%3A%2F%2Fexample.com
    // The inner value will be "https%3A%2F%2Fexample.com" which is not a valid URL
    const url = 'fableforge://character?id=abc&registry=https%253A%252F%252Fexample.com%252Findex.json';
    const result = parseDeepLink(url);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_REGISTRY');
    }
  });
});
