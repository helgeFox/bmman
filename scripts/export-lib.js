import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';
import esbuild from 'esbuild';
import Handlebars from 'handlebars';

export function toDisplayName(filename) {
  return filename
    .replace(/\.js$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function readManifest(manifestPath) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return { bookmarklets: {} };
  }
}

export async function compileBookmarklet(filePath) {
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

export async function scanAndCompile(rootDir, opts = {}) {
  const bookmarkletsDir = path.join(rootDir, 'bookmarklets');
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = readManifest(manifestPath);
  const groups = [];

  if (!fs.existsSync(bookmarkletsDir)) {
    return groups;
  }

  const entries = fs.readdirSync(bookmarkletsDir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_')) continue;
    if (opts.groups && !opts.groups.includes(entry.name)) continue;

    const groupDir = path.join(bookmarkletsDir, entry.name);
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

export function generateHTML(groups, rootDir) {
  const today = new Date().toISOString();

  const templatesDir = path.join(rootDir, 'src', 'export-templates');
  const distDir = path.join(rootDir, 'dist-export');

  const templateSource = fs.readFileSync(path.join(templatesDir, 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(templatesDir, 'style.css'), 'utf-8');
  const js = fs.readFileSync(path.join(templatesDir, 'script.js'), 'utf-8');

  const template = Handlebars.compile(templateSource);
  const html = template({ groups, today });

  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
  fs.writeFileSync(path.join(distDir, 'assets', 'style.css'), css);
  fs.writeFileSync(path.join(distDir, 'assets', 'script.js'), js);
}
