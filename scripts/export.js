import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BOOKMARKLETS_DIR = path.join(ROOT, 'bookmarklets');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const DIST_DIR = path.join(ROOT, 'dist-export');
const TEMPLATES_DIR = path.join(ROOT, 'src', 'export-templates');

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
  // Bundle with esbuild — resolves imports, tree-shakes, outputs IIFE
  const bundled = await esbuild.build({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'esnext',
  });
  const bundledCode = bundled.outputFiles[0].text;

  // Minify with Terser
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
      const relPath = `${entry.name}/${file}`;
      if (opts.include && !opts.include.includes(relPath)) continue;

      const fullPath = path.join(groupDir, file);
      const meta = manifest.bookmarklets?.[relPath] || {};
      const compiled = await compileBookmarklet(fullPath);

      const sizeLabel = compiled.size > 2000
        ? `${compiled.size} chars [WARNING: exceeds 2000 char limit]`
        : `${compiled.size} chars`;

      console.log(`  ${relPath} — ${sizeLabel}`);

      const displayName = meta.name || toDisplayName(file);
      const icon = meta.icon || '';
      bookmarklets.push({
        id: relPath,
        name: icon ? `${icon} ${displayName}` : displayName,
        description: meta.description || '',
        url: compiled.url,
        size: compiled.size,
      });
    }

    if (bookmarklets.length > 0) {
      groups.push({
        name: toDisplayName(entry.name),
        bookmarklets,
      });
    }
  }

  return groups;
}

function generateHTML(groups) {
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(TEMPLATES_DIR, 'style.css'), 'utf-8');
  const js = fs.readFileSync(path.join(TEMPLATES_DIR, 'script.js'), 'utf-8');

  let sectionsHTML = '';
  for (const group of groups) {
    sectionsHTML += `    <section class="group">\n`;
    sectionsHTML += `      <h2>${escapeHTML(group.name)}</h2>\n`;
    for (const bm of group.bookmarklets) {
      sectionsHTML += `      <div class="bookmarklet">\n`;
      sectionsHTML += `        <a class="bm-button" href="${escapeAttr(bm.url)}">${escapeHTML(bm.name)}</a>\n`;
      if (bm.description) {
        sectionsHTML += `        <p class="bm-desc">${escapeHTML(bm.description)}</p>\n`;
      }
      sectionsHTML += `      </div>\n`;
    }
    sectionsHTML += `    </section>\n`;
  }

  const html = template.replace('{{CONTENT}}', sectionsHTML);

  // Write output
  fs.mkdirSync(path.join(DIST_DIR, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  fs.writeFileSync(path.join(DIST_DIR, 'assets', 'style.css'), css);
  fs.writeFileSync(path.join(DIST_DIR, 'assets', 'script.js'), js);
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function main() {
  const opts = parseArgs();

  console.log('Compiling bookmarklets...\n');
  const groups = await scanAndCompile(opts);

  if (groups.length === 0) {
    console.log('No bookmarklets matched the given filters.');
    process.exit(0);
  }

  generateHTML(groups);

  const total = groups.reduce((n, g) => n + g.bookmarklets.length, 0);
  console.log(`\nExported ${total} bookmarklet(s) in ${groups.length} group(s) to dist-export/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
