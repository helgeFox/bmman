import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPORT_SCRIPT = path.join(ROOT, 'scripts', 'export.js');
const FIXTURE_DIR = path.join(ROOT, '.test-export-fixtures');
const BM_DIR = path.join(FIXTURE_DIR, 'bookmarklets');
const DIST_DIR = path.join(FIXTURE_DIR, 'dist-export');
const TEMPLATES_DIR = path.join(FIXTURE_DIR, 'src', 'export-templates');

// The export script uses __dirname-relative paths, so we can't just chdir.
// Instead we create a self-contained copy of the script that points to our fixtures.
function createFixtureScript() {
  const script = `
import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';
import esbuild from 'esbuild';

const ROOT = ${JSON.stringify(FIXTURE_DIR)};
const BOOKMARKLETS_DIR = path.join(ROOT, 'bookmarklets');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const DIST_DIR = path.join(ROOT, 'dist-export');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'export-templates');

function toDisplayName(filename) {
  return filename
    .replace(/\\.js$/, '')
    .replace(/-/g, ' ')
    .replace(/\\b\\w/g, c => c.toUpperCase());
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return { bookmarklets: {} };
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { groups: null, include: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--groups' && args[i + 1]) {
      opts.groups = args[++i].split(',').map(s => s.trim());
    } else if (args[i] === '--include' && args[i + 1]) {
      opts.include = args[++i].split(',').map(s => s.trim());
    }
  }
  return opts;
}

async function compileBookmarklet(filePath) {
  const bundled = await esbuild.build({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'esnext',
  });
  const bundledCode = bundled.outputFiles[0].text;
  const result = await minify(bundledCode, {
    compress: { passes: 2 },
    mangle: true,
  });
  const encoded = encodeURIComponent(result.code);
  return {
    url: 'javascript:' + encoded,
    size: 'javascript:'.length + encoded.length,
  };
}

async function scanAndCompile(opts) {
  const manifest = readManifest();
  const groups = [];
  if (!fs.existsSync(BOOKMARKLETS_DIR)) {
    console.error('No bookmarklets/ directory found.');
    process.exit(1);
  }
  const entries = fs.readdirSync(BOOKMARKLETS_DIR, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    if (opts.groups && !opts.groups.includes(entry.name)) continue;
    const groupDir = path.join(BOOKMARKLETS_DIR, entry.name);
    const files = fs.readdirSync(groupDir).filter(f => f.endsWith('.js')).sort();
    const bookmarklets = [];
    for (const file of files) {
      const relPath = entry.name + '/' + file;
      if (opts.include && !opts.include.includes(relPath)) continue;
      const fullPath = path.join(groupDir, file);
      const meta = manifest.bookmarklets?.[relPath] || {};
      const compiled = await compileBookmarklet(fullPath);
      const sizeLabel = compiled.size > 2000
        ? compiled.size + ' chars [WARNING: exceeds 2000 char limit]'
        : compiled.size + ' chars';
      console.log('  ' + relPath + ' — ' + sizeLabel);
      const displayName = meta.name || toDisplayName(file);
      const icon = meta.icon || '';
      bookmarklets.push({
        id: relPath,
        name: icon ? icon + ' ' + displayName : displayName,
        description: meta.description || '',
        url: compiled.url,
        size: compiled.size,
      });
    }
    if (bookmarklets.length > 0) {
      groups.push({ name: toDisplayName(entry.name), bookmarklets });
    }
  }
  return groups;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function generateHTML(groups) {
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(TEMPLATES_DIR, 'style.css'), 'utf-8');
  const js = fs.readFileSync(path.join(TEMPLATES_DIR, 'script.js'), 'utf-8');
  let sectionsHTML = '';
  for (const group of groups) {
    sectionsHTML += '    <section class="group">\\n';
    sectionsHTML += '      <h2>' + escapeHTML(group.name) + '</h2>\\n';
    for (const bm of group.bookmarklets) {
      sectionsHTML += '      <div class="bookmarklet">\\n';
      sectionsHTML += '        <a class="bm-button" href="' + escapeAttr(bm.url) + '">' + escapeHTML(bm.name) + '</a>\\n';
      if (bm.description) {
        sectionsHTML += '        <p class="bm-desc">' + escapeHTML(bm.description) + '</p>\\n';
      }
      sectionsHTML += '      </div>\\n';
    }
    sectionsHTML += '    </section>\\n';
  }
  const html = template.replace('{{CONTENT}}', sectionsHTML);
  fs.mkdirSync(path.join(DIST_DIR, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(DIST_DIR, 'assets', 'style.css'), css);
  fs.writeFileSync(path.join(DIST_DIR, 'assets', 'script.js'), js);
}

async function main() {
  const opts = parseArgs();
  console.log('Compiling bookmarklets...\\n');
  const groups = await scanAndCompile(opts);
  if (groups.length === 0) {
    console.log('No bookmarklets matched the given filters.');
    process.exit(0);
  }
  generateHTML(groups);
  const total = groups.reduce((n, g) => n + g.bookmarklets.length, 0);
  console.log('\\nExported ' + total + ' bookmarklet(s) in ' + groups.length + ' group(s) to dist-export/');
}

main().catch(err => { console.error(err); process.exit(1); });
`;
  const scriptPath = path.join(FIXTURE_DIR, 'export-test.mjs');
  fs.writeFileSync(scriptPath, script);
  return scriptPath;
}

function setupFixtures() {
  // Bookmarklets
  fs.mkdirSync(path.join(BM_DIR, 'utils'), { recursive: true });
  fs.mkdirSync(path.join(BM_DIR, '_shared'), { recursive: true });
  fs.mkdirSync(path.join(BM_DIR, 'dev-tools'), { recursive: true });

  fs.writeFileSync(
    path.join(BM_DIR, '_shared', 'helpers.js'),
    'export function greet(name) { alert("Hello " + name); }\n',
  );

  fs.writeFileSync(
    path.join(BM_DIR, 'utils', 'highlight.js'),
    'document.querySelectorAll("a").forEach(a => a.style.outline = "2px solid red");\n',
  );

  fs.writeFileSync(
    path.join(BM_DIR, 'utils', 'with-import.js'),
    'import { greet } from "../_shared/helpers.js";\ngreet("world");\n',
  );

  fs.writeFileSync(
    path.join(BM_DIR, 'dev-tools', 'console.js'),
    'console.log("dev");\n',
  );

  // Manifest
  fs.writeFileSync(
    path.join(FIXTURE_DIR, 'manifest.json'),
    JSON.stringify({
      bookmarklets: {
        'utils/highlight.js': {
          name: 'Highlight Links',
          description: 'Highlights all links.',
          icon: '🔍',
        },
        'dev-tools/console.js': {
          description: 'Opens console.',
        },
      },
    }),
  );

  // Export templates
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TEMPLATES_DIR, 'index.html'),
    '<!doctype html><html><body>{{CONTENT}}</body></html>',
  );
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'style.css'), 'body{}');
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'script.js'), '// js');
}

function cleanFixtures() {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
}

async function runExport(args = []) {
  const scriptPath = createFixtureScript();
  const { stdout, stderr } = await exec('node', [scriptPath, ...args], {
    cwd: FIXTURE_DIR,
  });
  return { stdout, stderr };
}

describe('Export pipeline', () => {
  beforeEach(() => {
    cleanFixtures();
    setupFixtures();
  });

  afterEach(() => {
    cleanFixtures();
  });

  describe('full export', () => {
    it('generates dist-export/ with index.html and assets', async () => {
      await runExport();

      expect(fs.existsSync(path.join(DIST_DIR, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(DIST_DIR, 'assets', 'style.css'))).toBe(true);
      expect(fs.existsSync(path.join(DIST_DIR, 'assets', 'script.js'))).toBe(true);
    });

    it('exported HTML contains all non-shared groups', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

      expect(html).toContain('Utils');
      expect(html).toContain('Dev Tools');
      // Shared groups excluded
      expect(html).not.toContain('_shared');
      expect(html).not.toContain('helpers');
    });

    it('bookmarklet URLs start with javascript:', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      const hrefMatches = html.match(/href="(javascript:[^"]+)"/g);
      expect(hrefMatches).not.toBeNull();
      for (const match of hrefMatches) {
        expect(match).toMatch(/^href="javascript:/);
      }
    });

    it('applies manifest display name and icon', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      // Icon + name combo
      expect(html).toContain('🔍 Highlight Links');
    });

    it('includes descriptions from manifest', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('Highlights all links.');
      expect(html).toContain('Opens console.');
    });

    it('uses filesystem-derived name when no manifest entry', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('With Import');
    });
  });

  describe('shared dependency bundling', () => {
    it('inlines imported shared code into the bookmarklet', async () => {
      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

      // Find the href for with-import bookmarklet
      const withImportMatch = html.match(/href="(javascript:[^"]+)"[^>]*>With Import/);
      expect(withImportMatch).not.toBeNull();

      const url = withImportMatch[1];
      const decoded = decodeURIComponent(url.replace('javascript:', ''));
      // The shared function body should be inlined
      expect(decoded).toContain('Hello');
    });
  });

  describe('--groups filter', () => {
    it('exports only the specified groups', async () => {
      await runExport(['--groups', 'utils']);
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('Utils');
      expect(html).not.toContain('Dev Tools');
    });
  });

  describe('--include filter', () => {
    it('exports only the specified bookmarklets', async () => {
      await runExport(['--include', 'utils/highlight.js']);
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('Highlight Links');
      expect(html).not.toContain('With Import');
      expect(html).not.toContain('Console');
    });
  });

  describe('size warnings', () => {
    it('prints size in output for each bookmarklet', async () => {
      const { stdout } = await runExport();
      expect(stdout).toContain('chars');
      expect(stdout).toContain('utils/highlight.js');
    });

    it('warns when bookmarklet exceeds 2000 chars', async () => {
      // Write a large bookmarklet that can't be minified away
      // Use many unique console.log calls so Terser can't collapse them
      const lines = [];
      for (let i = 0; i < 300; i++) {
        lines.push(`console.log("unique_string_${i}_${'x'.repeat(10)}");`);
      }
      fs.writeFileSync(path.join(BM_DIR, 'utils', 'big.js'), lines.join('\n') + '\n');

      const { stdout } = await runExport();
      expect(stdout).toContain('WARNING');
      expect(stdout).toContain('exceeds 2000 char limit');
    });
  });

  describe('HTML escaping', () => {
    it('escapes HTML special characters in names and descriptions', async () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf-8'));
      manifest.bookmarklets['dev-tools/console.js'] = {
        name: 'Test <script>',
        description: 'A "dangerous" & <bold> desc',
      };
      fs.writeFileSync(path.join(FIXTURE_DIR, 'manifest.json'), JSON.stringify(manifest));

      await runExport();
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('Test &lt;script&gt;');
      expect(html).toContain('A &quot;dangerous&quot; &amp; &lt;bold&gt; desc');
      expect(html).not.toContain('<script>');
    });
  });

  describe('display name derivation', () => {
    it('converts kebab-case to title case', async () => {
      const { stdout } = await runExport();
      // dev-tools group becomes "Dev Tools" heading
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
      expect(html).toContain('Dev Tools');
    });
  });
});
