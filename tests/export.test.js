import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toDisplayName,
  readManifest,
  compileBookmarklet,
  scanAndCompile,
  generateHTML,
} from '../scripts/export-lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, '.test-export-fixtures');
const BM_DIR = path.join(FIXTURE_DIR, 'bookmarklets');
const DIST_DIR = path.join(FIXTURE_DIR, 'dist-export');
const TEMPLATES_DIR = path.join(FIXTURE_DIR, 'src', 'export-templates');

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

  // Export templates (Handlebars)
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(TEMPLATES_DIR, 'index.html'),
    '<!doctype html><html><body>{{#each groups}}<section class="group"><h2>{{name}}</h2>{{#each bookmarklets}}<div class="bookmarklet"><a class="bm-button" href="{{{url}}}">{{name}}</a>{{#if description}}<p class="bm-desc">{{description}}</p>{{/if}}</div>{{/each}}</section>{{/each}}</body></html>',
  );
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'style.css'), 'body{}');
  fs.writeFileSync(path.join(TEMPLATES_DIR, 'script.js'), '// js');
}

function cleanFixtures() {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
}

describe('toDisplayName', () => {
  it('converts kebab-case filename to title case', () => {
    expect(toDisplayName('highlight-links.js')).toBe('Highlight Links');
  });

  it('handles single-word filenames', () => {
    expect(toDisplayName('cleanup.js')).toBe('Cleanup');
  });

  it('works on folder names (no .js extension)', () => {
    expect(toDisplayName('dev-tools')).toBe('Dev Tools');
  });
});

describe('readManifest', () => {
  beforeEach(() => {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanFixtures();
  });

  it('reads and parses manifest.json', () => {
    fs.writeFileSync(
      path.join(FIXTURE_DIR, 'manifest.json'),
      JSON.stringify({ bookmarklets: { 'a/b.js': { name: 'Test' } } }),
    );
    const result = readManifest(path.join(FIXTURE_DIR, 'manifest.json'));
    expect(result.bookmarklets['a/b.js'].name).toBe('Test');
  });

  it('returns empty manifest when file does not exist', () => {
    const result = readManifest(path.join(FIXTURE_DIR, 'nonexistent.json'));
    expect(result).toEqual({ bookmarklets: {} });
  });
});

describe('compileBookmarklet', () => {
  beforeEach(() => {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanFixtures();
  });

  it('returns a javascript: URL and size', async () => {
    fs.writeFileSync(path.join(FIXTURE_DIR, 'test.js'), 'alert(1);\n');
    const result = await compileBookmarklet(path.join(FIXTURE_DIR, 'test.js'));
    expect(result.url).toMatch(/^javascript:/);
    expect(result.size).toBe(result.url.length);
  });

  it('bundles imports into a single output', async () => {
    fs.mkdirSync(path.join(FIXTURE_DIR, 'lib'), { recursive: true });
    fs.writeFileSync(
      path.join(FIXTURE_DIR, 'lib', 'dep.js'),
      'export function hello() { alert("hello"); }\n',
    );
    fs.writeFileSync(
      path.join(FIXTURE_DIR, 'entry.js'),
      'import { hello } from "./lib/dep.js";\nhello();\n',
    );
    const result = await compileBookmarklet(path.join(FIXTURE_DIR, 'entry.js'));
    const decoded = decodeURIComponent(result.url.replace('javascript:', ''));
    expect(decoded).toContain('hello');
  });
});

describe('scanAndCompile', () => {
  beforeEach(() => {
    cleanFixtures();
    setupFixtures();
  });

  afterEach(() => {
    cleanFixtures();
  });

  it('returns all non-shared groups', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    const names = groups.map(g => g.name);
    expect(names).toContain('Utils');
    expect(names).toContain('Dev Tools');
  });

  it('excludes _ prefixed shared groups', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    const names = groups.map(g => g.name);
    expect(names).not.toContain('_shared');
    expect(names).not.toContain('Shared');
  });

  it('applies manifest metadata', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    const utils = groups.find(g => g.name === 'Utils');
    const highlight = utils.bookmarklets.find(b => b.id === 'utils/highlight.js');
    expect(highlight.name).toBe('🔍 Highlight Links');
    expect(highlight.description).toBe('Highlights all links.');
  });

  it('uses filesystem-derived name when no manifest entry', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    const utils = groups.find(g => g.name === 'Utils');
    const withImport = utils.bookmarklets.find(b => b.id === 'utils/with-import.js');
    expect(withImport.name).toBe('With Import');
  });

  it('filters by --groups', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR, { groups: ['utils'] });
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Utils');
  });

  it('filters by --include', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR, { include: ['utils/highlight.js'] });
    expect(groups).toHaveLength(1);
    expect(groups[0].bookmarklets).toHaveLength(1);
    expect(groups[0].bookmarklets[0].id).toBe('utils/highlight.js');
  });

  it('returns empty array when bookmarklets dir is missing', async () => {
    const emptyDir = path.join(FIXTURE_DIR, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const groups = await scanAndCompile(emptyDir);
    expect(groups).toEqual([]);
  });

  it('warns when bookmarklet exceeds 2000 chars', async () => {
    const lines = [];
    for (let i = 0; i < 300; i++) {
      lines.push(`console.log("unique_string_${i}_${'x'.repeat(10)}");`);
    }
    fs.writeFileSync(path.join(BM_DIR, 'utils', 'big.js'), lines.join('\n') + '\n');

    const groups = await scanAndCompile(FIXTURE_DIR);
    const utils = groups.find(g => g.name === 'Utils');
    const big = utils.bookmarklets.find(b => b.id === 'utils/big.js');
    expect(big.size).toBeGreaterThan(2000);
  });
});

describe('generateHTML', () => {
  beforeEach(() => {
    cleanFixtures();
    setupFixtures();
  });

  afterEach(() => {
    cleanFixtures();
  });

  it('generates dist-export/ with index.html and assets', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);

    expect(fs.existsSync(path.join(DIST_DIR, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(DIST_DIR, 'assets', 'style.css'))).toBe(true);
    expect(fs.existsSync(path.join(DIST_DIR, 'assets', 'script.js'))).toBe(true);
  });

  it('exported HTML contains group headings', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

    expect(html).toContain('Utils');
    expect(html).toContain('Dev Tools');
  });

  it('bookmarklet URLs start with javascript:', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    const hrefMatches = html.match(/href="(javascript:[^"]+)"/g);
    expect(hrefMatches).not.toBeNull();
    for (const match of hrefMatches) {
      expect(match).toMatch(/^href="javascript:/);
    }
  });

  it('includes icon prefix in button text', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    expect(html).toContain('🔍 Highlight Links');
  });

  it('includes descriptions from manifest', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    expect(html).toContain('Highlights all links.');
    expect(html).toContain('Opens console.');
  });

  it('omits description paragraph when empty', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    // with-import has no description — should not have an empty <p>
    const withImportSection = html.split('With Import')[1].split('</div>')[0];
    expect(withImportSection).not.toContain('bm-desc');
  });

  it('inlines shared imports into bookmarklet URL', async () => {
    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');

    const withImportMatch = html.match(/href="(javascript:[^"]+)"[^>]*>With Import/);
    expect(withImportMatch).not.toBeNull();

    const decoded = decodeURIComponent(withImportMatch[1].replace('javascript:', ''));
    expect(decoded).toContain('Hello');
  });

  it('escapes HTML special characters in names and descriptions', async () => {
    // Inject dangerous manifest entries
    fs.writeFileSync(
      path.join(FIXTURE_DIR, 'manifest.json'),
      JSON.stringify({
        bookmarklets: {
          'dev-tools/console.js': {
            name: 'Test <script>',
            description: 'A "dangerous" & <bold> desc',
          },
        },
      }),
    );

    const groups = await scanAndCompile(FIXTURE_DIR);
    generateHTML(groups, FIXTURE_DIR);
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf-8');
    expect(html).toContain('Test &lt;script&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;bold&gt;');
    // Raw <script> tag must not appear unescaped
    expect(html).not.toMatch(/<script>(?!src)/);
  });
});
