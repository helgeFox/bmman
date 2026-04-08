import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// We test the API by importing the plugin and wiring it to a real HTTP server.
// The plugin expects bookmarklets/ and manifest.json at cwd, so we create a
// temp fixture directory and run from there.

const FIXTURE_DIR = path.join(ROOT, '.test-fixtures');
const BM_DIR = path.join(FIXTURE_DIR, 'bookmarklets');
const MANIFEST_PATH = path.join(FIXTURE_DIR, 'manifest.json');

// apiPlugin resolves paths relative to cwd, so we override cwd during tests
let originalCwd;

function setupFixtures() {
  fs.mkdirSync(path.join(BM_DIR, 'utils'), { recursive: true });
  fs.mkdirSync(path.join(BM_DIR, '_shared'), { recursive: true });
  fs.mkdirSync(path.join(BM_DIR, 'tools'), { recursive: true });

  fs.writeFileSync(path.join(BM_DIR, 'utils', 'highlight.js'), 'alert("hi")');
  fs.writeFileSync(path.join(BM_DIR, 'utils', 'cleanup.js'), 'document.body.innerHTML=""');
  fs.writeFileSync(path.join(BM_DIR, '_shared', 'helpers.js'), 'export function h(){}');
  fs.writeFileSync(path.join(BM_DIR, 'tools', 'debug.js'), 'console.log("debug")');

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({
      bookmarklets: {
        'utils/highlight.js': {
          name: 'Highlight All',
          description: 'Highlights stuff',
          tags: ['dom'],
          icon: '🔍',
        },
      },
    }),
  );
}

function cleanFixtures() {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
}

// Helper to make requests against the plugin server
function request(server, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opts = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Create a minimal server using the plugin's middleware
async function createServer() {
  // Dynamic import so cwd() is already changed
  const { apiPlugin } = await import('../src/api-plugin.js?t=' + Date.now());
  const plugin = apiPlugin();

  // The plugin provides configureServer which takes a server-like object with middlewares
  // We create a simple middleware stack
  const middlewares = [];
  middlewares.use = (fn) => middlewares.push(fn);

  plugin.configureServer({ middlewares });

  const server = http.createServer(async (req, res) => {
    for (const mw of middlewares) {
      let called = false;
      const next = () => { called = true; };
      await mw(req, res, next);
      if (!called) return; // middleware handled it
    }
    // If no middleware handled, 404
    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('API plugin', () => {
  let server;

  beforeEach(async () => {
    cleanFixtures();
    setupFixtures();
    originalCwd = process.cwd();
    process.chdir(FIXTURE_DIR);
    server = await createServer();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise((resolve) => server.close(resolve));
    cleanFixtures();
  });

  describe('GET /api/bookmarklets', () => {
    it('returns all groups with bookmarklets', async () => {
      const { status, body } = await request(server, 'GET', '/api/bookmarklets');
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);

      const groupIds = body.map((g) => g.id);
      expect(groupIds).toContain('utils');
      expect(groupIds).toContain('tools');
    });

    it('includes _shared groups with shared flag', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const shared = body.find((g) => g.id === '_shared');
      expect(shared).toBeDefined();
      expect(shared.shared).toBe(true);
      expect(shared.bookmarklets.length).toBe(1);
      expect(shared.bookmarklets[0].filename).toBe('helpers.js');
    });

    it('regular groups have shared=false', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      expect(utils.shared).toBe(false);
    });

    it('groups are sorted alphabetically', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const ids = body.map((g) => g.id);
      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    });

    it('bookmarklets within a group are sorted alphabetically', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const filenames = utils.bookmarklets.map((b) => b.filename);
      expect(filenames).toEqual(['cleanup.js', 'highlight.js']);
    });

    it('applies manifest metadata to matching bookmarklets', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const highlight = utils.bookmarklets.find((b) => b.filename === 'highlight.js');
      expect(highlight.name).toBe('Highlight All');
      expect(highlight.description).toBe('Highlights stuff');
      expect(highlight.tags).toEqual(['dom']);
      expect(highlight.icon).toBe('🔍');
    });

    it('uses filesystem-derived defaults when no manifest entry', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const cleanup = utils.bookmarklets.find((b) => b.filename === 'cleanup.js');
      expect(cleanup.name).toBe('Cleanup');
      expect(cleanup.description).toBe('');
      expect(cleanup.tags).toEqual([]);
      expect(cleanup.icon).toBe('');
    });

    it('includes source code for each bookmarklet', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const highlight = utils.bookmarklets.find((b) => b.filename === 'highlight.js');
      expect(highlight.source).toBe('alert("hi")');
    });

    it('sets bookmarklet id to relative path', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const highlight = utils.bookmarklets.find((b) => b.filename === 'highlight.js');
      expect(highlight.id).toBe('utils/highlight.js');
    });
  });

  describe('POST /api/bookmarklets', () => {
    it('creates a new bookmarklet file', async () => {
      const { status, body } = await request(server, 'POST', '/api/bookmarklets', {
        group: 'utils',
        filename: 'new-one',
        source: '// new',
      });
      expect(status).toBe(201);
      expect(body.id).toBe('utils/new-one.js');

      const content = fs.readFileSync(path.join(BM_DIR, 'utils', 'new-one.js'), 'utf-8');
      expect(content).toBe('// new');
    });

    it('appends .js extension if missing', async () => {
      const { body } = await request(server, 'POST', '/api/bookmarklets', {
        group: 'utils',
        filename: 'no-ext',
        source: '',
      });
      expect(body.id).toBe('utils/no-ext.js');
      expect(fs.existsSync(path.join(BM_DIR, 'utils', 'no-ext.js'))).toBe(true);
    });

    it('does not double .js if already present', async () => {
      const { body } = await request(server, 'POST', '/api/bookmarklets', {
        group: 'utils',
        filename: 'has-ext.js',
        source: '',
      });
      expect(body.id).toBe('utils/has-ext.js');
    });

    it('creates group directory if it does not exist', async () => {
      await request(server, 'POST', '/api/bookmarklets', {
        group: 'brand-new',
        filename: 'first.js',
        source: 'hello',
      });
      expect(fs.existsSync(path.join(BM_DIR, 'brand-new', 'first.js'))).toBe(true);
    });

    it('saves description to manifest when provided', async () => {
      await request(server, 'POST', '/api/bookmarklets', {
        group: 'utils',
        filename: 'described.js',
        source: '',
        description: 'Does things',
      });
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(manifest.bookmarklets['utils/described.js'].description).toBe('Does things');
    });

    it('returns 400 when group is missing', async () => {
      const { status, body } = await request(server, 'POST', '/api/bookmarklets', {
        filename: 'no-group.js',
      });
      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('returns 400 when filename is missing', async () => {
      const { status, body } = await request(server, 'POST', '/api/bookmarklets', {
        group: 'utils',
      });
      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });
  });

  describe('PUT /api/bookmarklets/:group/:file', () => {
    it('updates source of an existing bookmarklet', async () => {
      const { status, body } = await request(server, 'PUT', '/api/bookmarklets/utils/highlight.js', {
        source: 'alert("updated")',
      });
      expect(status).toBe(200);
      expect(body.ok).toBe(true);

      const content = fs.readFileSync(path.join(BM_DIR, 'utils', 'highlight.js'), 'utf-8');
      expect(content).toBe('alert("updated")');
    });

    it('returns 404 for non-existent bookmarklet', async () => {
      const { status } = await request(server, 'PUT', '/api/bookmarklets/utils/nonexistent.js', {
        source: 'x',
      });
      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/bookmarklets/:group/:file', () => {
    it('deletes the file and removes manifest entry', async () => {
      const { status, body } = await request(server, 'DELETE', '/api/bookmarklets/utils/highlight.js');
      expect(status).toBe(200);
      expect(body.ok).toBe(true);

      expect(fs.existsSync(path.join(BM_DIR, 'utils', 'highlight.js'))).toBe(false);

      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(manifest.bookmarklets['utils/highlight.js']).toBeUndefined();
    });

    it('removes empty group directory after deleting last file', async () => {
      // tools/ has one file: debug.js
      await request(server, 'DELETE', '/api/bookmarklets/tools/debug.js');
      expect(fs.existsSync(path.join(BM_DIR, 'tools'))).toBe(false);
    });

    it('does not remove group directory if other files remain', async () => {
      // utils/ has two files
      await request(server, 'DELETE', '/api/bookmarklets/utils/highlight.js');
      expect(fs.existsSync(path.join(BM_DIR, 'utils'))).toBe(true);
    });

    it('succeeds even if file does not exist (idempotent)', async () => {
      const { status } = await request(server, 'DELETE', '/api/bookmarklets/utils/ghost.js');
      expect(status).toBe(200);
    });
  });

  describe('GET /api/manifest', () => {
    it('returns the full manifest', async () => {
      const { status, body } = await request(server, 'GET', '/api/manifest');
      expect(status).toBe(200);
      expect(body.bookmarklets).toBeDefined();
      expect(body.bookmarklets['utils/highlight.js'].name).toBe('Highlight All');
    });
  });

  describe('PUT /api/manifest/:group/:file', () => {
    it('updates metadata for a bookmarklet', async () => {
      const { status } = await request(server, 'PUT', '/api/manifest/utils/cleanup.js', {
        description: 'Cleans up the DOM',
        tags: ['cleanup', 'dom'],
      });
      expect(status).toBe(200);

      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(manifest.bookmarklets['utils/cleanup.js'].description).toBe('Cleans up the DOM');
      expect(manifest.bookmarklets['utils/cleanup.js'].tags).toEqual(['cleanup', 'dom']);
    });

    it('merges with existing metadata', async () => {
      await request(server, 'PUT', '/api/manifest/utils/highlight.js', {
        tags: ['updated'],
      });

      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      // Original fields preserved
      expect(manifest.bookmarklets['utils/highlight.js'].name).toBe('Highlight All');
      // New field merged
      expect(manifest.bookmarklets['utils/highlight.js'].tags).toEqual(['updated']);
    });
  });

  describe('display name derivation', () => {
    it('derives name from kebab-case filename', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const utils = body.find((g) => g.id === 'utils');
      const cleanup = utils.bookmarklets.find((b) => b.filename === 'cleanup.js');
      expect(cleanup.name).toBe('Cleanup');
    });

    it('derives group name from kebab-case folder', async () => {
      // Create a kebab-case group
      const groupDir = path.join(BM_DIR, 'my-tools');
      fs.mkdirSync(groupDir, { recursive: true });
      fs.writeFileSync(path.join(groupDir, 'test.js'), '');

      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const myTools = body.find((g) => g.id === 'my-tools');
      expect(myTools.name).toBe('My Tools');
    });

    it('keeps raw folder name for shared groups', async () => {
      const { body } = await request(server, 'GET', '/api/bookmarklets');
      const shared = body.find((g) => g.id === '_shared');
      expect(shared.name).toBe('_shared');
    });
  });

  describe('non-API requests', () => {
    it('passes through to next middleware for unknown paths', async () => {
      const { status, body } = await request(server, 'GET', '/not-an-api-route');
      expect(status).toBe(404);
      expect(body).toBe('Not found');
    });
  });
});
