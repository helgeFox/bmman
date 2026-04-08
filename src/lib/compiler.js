/**
 * Estimates the compiled bookmarklet size without actually running Terser
 * (Terser runs server-side at export time). This gives a rough preview.
 */
export function estimateCompiledSize(source) {
  // Rough estimate: IIFE wrapper + URI encoding overhead (~1.3x for special chars)
  const wrapped = `(function(){${source}})();`;
  const encoded = encodeURIComponent(wrapped);
  return 'javascript:'.length + encoded.length;
}

export function getSizeLevel(charCount) {
  if (charCount < 1500) return 'ok';
  if (charCount <= 2000) return 'warn';
  return 'danger';
}
