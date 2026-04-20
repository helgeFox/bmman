function ensureOk(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchBookmarklets() {
  const res = ensureOk(await fetch('/api/bookmarklets'));
  return res.json();
}

export async function saveSource(id, source) {
  ensureOk(await fetch(`/api/bookmarklets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  }));
}

export async function saveMeta(id, meta) {
  ensureOk(await fetch(`/api/manifest/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  }));
}

export async function createBookmarklet({ group, filename, source, description }) {
  const res = ensureOk(await fetch('/api/bookmarklets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, filename, source, description }),
  }));
  return res.json();
}

export async function deleteBookmarklet(id) {
  ensureOk(await fetch(`/api/bookmarklets/${id}`, { method: 'DELETE' }));
}

export async function checkHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
