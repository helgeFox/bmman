import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanAndCompile, generateHTML } from './export-lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

async function main() {
  const opts = parseArgs();

  console.log('Compiling bookmarklets...\n');
  const groups = await scanAndCompile(ROOT, opts);

  if (groups.length === 0) {
    console.log('No bookmarklets matched the given filters.');
    process.exit(0);
  }

  generateHTML(groups, ROOT);

  const total = groups.reduce((n, g) => n + g.bookmarklets.length, 0);
  console.log(`\nExported ${total} bookmarklet(s) in ${groups.length} group(s) to dist-export/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
