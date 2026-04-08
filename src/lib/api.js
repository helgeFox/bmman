export async function fetchBookmarklets() {
  const res = await fetch('/api/bookmarklets');
  return res.json();
}

export async function saveSource(id, source) {
  await fetch(`/api/bookmarklets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
}

export async function saveMeta(id, meta) {
  await fetch(`/api/manifest/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

export async function createBookmarklet({ group, filename, source, description }) {
  const res = await fetch('/api/bookmarklets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, filename, source, description }),
  });
  return res.json();
}

export async function deleteBookmarklet(id) {
  await fetch(`/api/bookmarklets/${id}`, { method: 'DELETE' });
}
