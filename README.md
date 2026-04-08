# bmman

A local tool for authoring, organizing, and exporting browser bookmarklets. Write clean JavaScript, manage metadata in a UI, and export drag-and-drop install pages.

## Quick Start

```bash
npm install
npm run dev        # Start the manager UI at http://localhost:5173
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Svelte manager UI (Vite dev server) |
| `npm run export` | Compile all bookmarklets and generate `dist-export/` |
| `npm run serve-export` | Serve the exported page locally for preview |
| `npm run build` | Build the manager UI for production |

### Export Options

```bash
# Export only specific groups
npm run export -- --groups utilities,dev-tools

# Export specific bookmarklets
npm run export -- --include utilities/highlight-links.js
```

## Project Structure

```
bookmarklets/               Source files
  _shared/                  Shared modules (importable, not exported)
  <group-folder>/           Folder name = group name
    <bookmarklet>.js        One file per bookmarklet
manifest.json               Metadata (names, descriptions, tags)
scripts/export.js           CLI export pipeline
src/                        Svelte manager UI
dist-export/                Generated export output (gitignored)
```

## How It Works

### Writing Bookmarklets

Add `.js` files under `bookmarklets/<group>/`. The filename becomes the display name (kebab-case to Title Case). Override names and add descriptions in `manifest.json`:

```json
{
  "bookmarklets": {
    "utilities/highlight-links.js": {
      "name": "Highlight All Links",
      "description": "Outlines every link on the page in red."
    }
  }
}
```

### Shared Code

Bookmarklets can import shared modules from `_`-prefixed folders:

```js
// bookmarklets/my-site/do-task.js
import { highlight } from '../_shared/dom.js';

highlight('a');
```

At export time, esbuild bundles and tree-shakes imports into each bookmarklet. Each compiled bookmarklet is fully self-contained.

### Compilation Pipeline

1. **Bundle** -- esbuild resolves imports and outputs a single IIFE
2. **Minify** -- Terser compresses and mangles
3. **Encode** -- URI-encode and prepend `javascript:`

The manager UI shows a live size estimate. Bookmarklets exceeding ~2000 characters get a warning (some browsers truncate `javascript:` URLs at that length).

### Exported Page

`npm run export` generates a static HTML page in `dist-export/` with styled drag-and-drop buttons grouped by folder. Share the page with others so they can drag bookmarklets to their bookmark bar.

## Manager UI

The dev server UI provides:

- File tree sidebar with group/bookmarklet navigation
- CodeMirror 6 editor with JS syntax highlighting
- Metadata editor (name, description, tags)
- Live compiled size indicator (green/yellow/red)
- Create and delete bookmarklets
- Ctrl+S to save immediately

## Tech Stack

Svelte + Vite (UI), CodeMirror 6 (editor), esbuild (bundling), Terser (minification).
