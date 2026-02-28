import { describe, it, expect } from 'vitest';
import { normalizeUrl, isLocalhostUrl, HMR_EXTENSIONS } from '../../src/utils/urlUtils';

// ── normalizeUrl ─────────────────────────────────────────────────────────────

describe('normalizeUrl', () => {
  it('prepends http:// to bare host', () => {
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000');
  });

  it('prepends http:// to hostname without port', () => {
    expect(normalizeUrl('example.com')).toBe('http://example.com');
  });

  it('leaves already-full http URLs unchanged', () => {
    expect(normalizeUrl('http://localhost:3000/path')).toBe('http://localhost:3000/path');
  });

  it('leaves https URLs unchanged', () => {
    expect(normalizeUrl('https://example.com/page?q=1')).toBe('https://example.com/page?q=1');
  });

  it('returns about:blank for empty input', () => {
    expect(normalizeUrl('')).toBe('about:blank');
  });

  it('returns about:blank for whitespace-only input', () => {
    expect(normalizeUrl('   ')).toBe('about:blank');
  });

  it('trims surrounding whitespace before normalising', () => {
    expect(normalizeUrl('  localhost:4200  ')).toBe('http://localhost:4200');
  });
});

// ── isLocalhostUrl ───────────────────────────────────────────────────────────

describe('isLocalhostUrl', () => {
  it('returns true for http://localhost', () => {
    expect(isLocalhostUrl('http://localhost:3000')).toBe(true);
  });

  it('returns true for http://127.0.0.1', () => {
    expect(isLocalhostUrl('http://127.0.0.1:8080')).toBe(true);
  });

  it('returns true for http://::1', () => {
    expect(isLocalhostUrl('http://[::1]:5173')).toBe(true);
  });

  it('returns false for an external domain', () => {
    expect(isLocalhostUrl('https://example.com')).toBe(false);
  });

  it('returns false for a malformed URL', () => {
    expect(isLocalhostUrl('not a url')).toBe(false);
  });

  it('returns false for about:blank', () => {
    expect(isLocalhostUrl('about:blank')).toBe(false);
  });
});

// ── HMR_EXTENSIONS ───────────────────────────────────────────────────────────

describe('HMR_EXTENSIONS', () => {
  it('includes common JS/TS extensions', () => {
    for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
      expect(HMR_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  it('includes Vue and Svelte', () => {
    expect(HMR_EXTENSIONS.has('.vue')).toBe(true);
    expect(HMR_EXTENSIONS.has('.svelte')).toBe(true);
  });

  it('includes CSS preprocessors', () => {
    for (const ext of ['.css', '.scss', '.sass', '.less', '.styl']) {
      expect(HMR_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  it('does not include .html or .json', () => {
    expect(HMR_EXTENSIONS.has('.html')).toBe(false);
    expect(HMR_EXTENSIONS.has('.json')).toBe(false);
  });
});
