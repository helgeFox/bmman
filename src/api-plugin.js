import fs from 'node:fs';
import path from 'node:path';

const BOOKMARKLETS_DIR = path.resolve('bookmarklets');
const MANIFEST_PATH = path.resolve('manifest.json');

function toDisplayName(filename) {
  return filename
    .replace(/\.js$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return { bookmarklets: {} };
  }
}

function writeManifest(data) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2) + '\n');
}

function scanBookmarklets() {
  const groups = [];
  if (!fs.existsSync(BOOKMARKLETS_DIR)) return groups;

  const manifest = readManifest();
  const entries = fs.readdirSync(BOOKMARKLETS_DIR, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const isShared = entry.name.startsWith('_');

    const groupDir = path.join(BOOKMARKLETS_DIR, entry.name);
    const files = fs.readdirSync(groupDir).filter(f => f.endsWith('.js')).sort();

    const bookmarklets = files.map(file => {
      const relPath = `${entry.name}/${file}`;
      const source = fs.readFileSync(path.join(groupDir, file), 'utf-8');
      const meta = manifest.bookmarklets?.[relPath] || {};
      return {
        id: relPath,
        filename: file,
        name: meta.name || toDisplayName(file),
        description: meta.description || '',
        tags: meta.tags || [],
        icon: meta.icon || '',
        source,
      };
    });

    groups.push({
      id: entry.name,
      name: isShared ? entry.name : toDisplayName(entry.name),
      shared: isShared,
      bookmarklets,
    });
  }

  return groups;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status = 400) {
  sendJson(res, { error: message }, status);
}

export function apiPlugin() {
  return {
    name: 'bmman-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');

        // GET /api/bookmarklets — list all groups and bookmarklets
        if (req.method === 'GET' && url.pathname === '/api/bookmarklets') {
          return sendJson(res, scanBookmarklets());
        }

        // POST /api/bookmarklets — create a new bookmarklet
        if (req.method === 'POST' && url.pathname === '/api/bookmarklets') {
          try {
            const { group, filename, source, description } = await parseBody(req);
            if (!group || !filename) return sendError(res, 'group and filename required');

            const safeName = filename.endsWith('.js') ? filename : filename + '.js';
            const groupDir = path.join(BOOKMARKLETS_DIR, group);
            const filePath = path.join(groupDir, safeName);

            fs.mkdirSync(groupDir, { recursive: true });
            fs.writeFileSync(filePath, source || '');

            if (description) {
              const manifest = readManifest();
              manifest.bookmarklets[`${group}/${safeName}`] = { description };
              writeManifest(manifest);
            }

            return sendJson(res, { id: `${group}/${safeName}` }, 201);
          } catch (e) {
            return sendError(res, e.message);
          }
        }

        // PUT /api/bookmarklets/:group/:file — update source
        if (req.method === 'PUT' && url.pathname.startsWith('/api/bookmarklets/')) {
          const relPath = url.pathname.replace('/api/bookmarklets/', '');
          const filePath = path.join(BOOKMARKLETS_DIR, relPath);

          if (!fs.existsSync(filePath)) return sendError(res, 'Not found', 404);

          try {
            const { source } = await parseBody(req);
            fs.writeFileSync(filePath, source);
            return sendJson(res, { ok: true });
          } catch (e) {
            return sendError(res, e.message);
          }
        }

        // DELETE /api/bookmarklets/:group/:file
        if (req.method === 'DELETE' && url.pathname.startsWith('/api/bookmarklets/')) {
          const relPath = url.pathname.replace('/api/bookmarklets/', '');
          const filePath = path.join(BOOKMARKLETS_DIR, relPath);

          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

          // Clean up manifest entry
          const manifest = readManifest();
          delete manifest.bookmarklets[relPath];
          writeManifest(manifest);

          // Remove empty group directory
          const groupDir = path.dirname(filePath);
          if (fs.existsSync(groupDir) && fs.readdirSync(groupDir).length === 0) {
            fs.rmdirSync(groupDir);
          }

          return sendJson(res, { ok: true });
        }

        // GET /api/manifest
        if (req.method === 'GET' && url.pathname === '/api/manifest') {
          return sendJson(res, readManifest());
        }

        // PUT /api/manifest/:group/:file — update metadata for one bookmarklet
        if (req.method === 'PUT' && url.pathname.startsWith('/api/manifest/')) {
          const relPath = url.pathname.replace('/api/manifest/', '');
          try {
            const meta = await parseBody(req);
            const manifest = readManifest();
            manifest.bookmarklets[relPath] = {
              ...manifest.bookmarklets[relPath],
              ...meta,
            };
            writeManifest(manifest);
            return sendJson(res, { ok: true });
          } catch (e) {
            return sendError(res, e.message);
          }
        }

        next();
      });
    },
  };
}
