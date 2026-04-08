import { describe, it, expect } from 'vitest';
import { estimateCompiledSize, getSizeLevel } from '../src/lib/compiler.js';

describe('estimateCompiledSize', () => {
  it('wraps source in IIFE and URI-encodes', () => {
    const size = estimateCompiledSize('alert(1)');
    const expected =
      'javascript:'.length +
      encodeURIComponent('(function(){alert(1)})();').length;
    expect(size).toBe(expected);
  });

  it('returns only the javascript: prefix length for empty source', () => {
    const size = estimateCompiledSize('');
    const expected =
      'javascript:'.length +
      encodeURIComponent('(function(){})();').length;
    expect(size).toBe(expected);
  });

  it('accounts for URI-encoding overhead on special characters', () => {
    const plain = estimateCompiledSize('var x=1');
    const special = estimateCompiledSize('var x="hello world"');
    // Spaces and quotes get URI-encoded to multi-char sequences
    expect(special).toBeGreaterThan(plain);
  });
});

describe('getSizeLevel', () => {
  it('returns "ok" for sizes below 1500', () => {
    expect(getSizeLevel(0)).toBe('ok');
    expect(getSizeLevel(1)).toBe('ok');
    expect(getSizeLevel(1499)).toBe('ok');
  });

  it('returns "warn" for sizes from 1500 to 2000', () => {
    expect(getSizeLevel(1500)).toBe('warn');
    expect(getSizeLevel(1750)).toBe('warn');
    expect(getSizeLevel(2000)).toBe('warn');
  });

  it('returns "danger" for sizes above 2000', () => {
    expect(getSizeLevel(2001)).toBe('danger');
    expect(getSizeLevel(10000)).toBe('danger');
  });
});
