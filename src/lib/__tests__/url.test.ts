import { describe, it, expect } from 'vitest';
import { normalizeUrl, urlsMatch } from '@/lib/url';

describe('normalizeUrl', () => {
  it('lowercases hostname', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/index.json'))
      .toBe('https://example.com/index.json');
  });

  it('removes trailing slash from path', () => {
    expect(normalizeUrl('https://example.com/index.json/'))
      .toBe('https://example.com/index.json');
  });

  it('preserves root path', () => {
    expect(normalizeUrl('https://example.com/'))
      .toBe('https://example.com/');
  });

  it('removes default HTTPS port', () => {
    expect(normalizeUrl('https://example.com:443/index.json'))
      .toBe('https://example.com/index.json');
  });

  it('removes default HTTP port', () => {
    expect(normalizeUrl('http://example.com:80/index.json'))
      .toBe('http://example.com/index.json');
  });

  it('keeps non-default port', () => {
    expect(normalizeUrl('https://example.com:8080/index.json'))
      .toBe('https://example.com:8080/index.json');
  });

  it('preserves query parameters', () => {
    expect(normalizeUrl('https://example.com/api?key=val'))
      .toBe('https://example.com/api?key=val');
  });

  it('preserves fragment', () => {
    expect(normalizeUrl('https://example.com/page#section'))
      .toBe('https://example.com/page#section');
  });

  it('returns invalid URL as-is', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('urlsMatch', () => {
  it('matches identical URLs', () => {
    expect(urlsMatch(
      'https://example.com/index.json',
      'https://example.com/index.json'
    )).toBe(true);
  });

  it('matches URLs differing only by trailing slash', () => {
    expect(urlsMatch(
      'https://example.com/index.json',
      'https://example.com/index.json/'
    )).toBe(true);
  });

  it('matches URLs differing by case in hostname', () => {
    expect(urlsMatch(
      'https://example.com/index.json',
      'https://EXAMPLE.COM/index.json'
    )).toBe(true);
  });

  it('does not match different paths', () => {
    expect(urlsMatch(
      'https://example.com/a.json',
      'https://example.com/b.json'
    )).toBe(false);
  });

  it('does not match different protocols', () => {
    expect(urlsMatch(
      'http://example.com/index.json',
      'https://example.com/index.json'
    )).toBe(false);
  });
});
