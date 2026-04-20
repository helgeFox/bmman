# bmman — Bookmarklet Manager

## Overview

A local development tool for authoring, organizing, and exporting browser bookmarklets. Users write clean JavaScript source files; the tool compiles them into `javascript:` URLs and exports curated collections as static HTML pages with drag-and-drop install buttons.

## Architecture

```
bmman/
├── bookmarklets/           # Source files (the "library")
│   ├── _shared/            # Shared modules (underscore prefix = not a group)
│   │   └── site-helpers.js # Importable by any bookmarklet
│   ├── group-folder/       # Folder name = group name
│   │   ├── snippet.js      # One bookmarklet per file
│   │   └── snippet2.js
│   └── another-group/
│       └── snippet3.js
├── manifest.json           # Metadata for each bookmarklet
├── dist/                   # Export output (gitignored)
│   ├── index.html
│   └── assets/
│       ├── style.css
│       └── script.js
├── src/                    # Svelte manager UI
├── scripts/                # CLI export pipeline
└── package.json
```

## Data Model

### Filesystem Conventions

- **Groups** are derived from folder names inside `bookmarklets/`.
- **Shared modules**: Folders prefixed with `_` (e.g., `_shared/`) are excluded from groups and the export. They exist solely to hold shared code that bookmarklets can `import`.
- **Ordering** is alphabetical: groups sorted by folder name, bookmarklets sorted by filename within each group.
- Folder and file names should use kebab-case. The display name is derived by replacing hyphens with spaces and title-casing (e.g., `my-snippet.js` → "My Snippet"). This can be overridden in `manifest.json`.

### manifest.json

Stores metadata that cannot be derived from the filesystem. The manifest is **optional per-entry** — a `.js` file without a manifest entry still works using filesystem-derived defaults.

```json
{
  "bookmarklets": {
    "group-folder/snippet.js": {
      "name": "Custom Display Name",
      "description": "What this bookmarklet does.",
      "tags": ["utility", "dom"]
    },
    "another-group/snippet3.js": {
      "description": "Highlights all links on the page."
    }
  }
}
```

**Fields per entry:**

| Field         | Type       | Required | Default                        |
|---------------|------------|----------|--------------------------------|
| `name`        | `string`   | No       | Derived from filename          |
| `description` | `string`   | No       | Empty                          |
| `icon`        | `string`   | No       | Empty (no icon prefix)         |
| `tags`        | `string[]` | No       | `[]`                           |

The manifest key is the relative path from `bookmarklets/` (e.g., `"utils/highlight-links.js"`).

## Shared Dependencies

Bookmarklets can import shared modules using standard ES `import` statements:

```js
// bookmarklets/my-site/do-task.js
import { click, waitFor } from '../_shared/site-helpers.js';

click('.submit-btn');
```

At export time, **esbuild** resolves and inlines all imports into each bookmarklet, then the result is passed through the normal compilation pipeline. This means:

- Each bookmarklet is fully self-contained after bundling — no runtime dependency on shared files.
- esbuild tree-shakes unused exports, so each bookmarklet only includes the shared code it actually uses.
- The tradeoff is that shared code is duplicated across bookmarklets. This is inherent to the `javascript:` URL constraint.

Shared modules live in `_`-prefixed folders (e.g., `_shared/`) which are excluded from groups and export output.

## Compilation Pipeline

Each `.js` source file goes through these steps at export time:

1. **Bundle** via esbuild: resolve all `import` statements and inline dependencies into a single script. Output format is IIFE.
2. **Minify** using Terser (invoked via Node at build time). No transpilation — modern ES6+ syntax is preserved as-is.
3. **URI-encode** the minified output.
4. **Prepend** `javascript:` protocol.
5. **Measure** the final URL length and flag warnings.

### Size Warnings

Some browsers (notably older IE and some mobile browsers) truncate `javascript:` URLs around 2000 characters. The pipeline:

- Displays the compiled size (in characters) for each bookmarklet during export.
- Emits a **warning** (not an error) for any bookmarklet exceeding 2000 characters.
- Does **not** block the export. The user decides whether to trim the source.

## Manager UI (Svelte + Vite)

A local dev-server UI for browsing, editing, and organizing bookmarklets. Started via `npm run dev`.

### Features

- **File browser**: Tree view of `bookmarklets/` showing groups (folders) and snippets (files).
- **Code editor**: CodeMirror 6 with JavaScript syntax highlighting. Edits save back to the source `.js` file on disk.
- **Metadata editor**: Form fields for name, description, and tags. Saves to `manifest.json`.
- **Size indicator**: Live character count showing estimated compiled size. Color-coded: green (< 1500), yellow (1500–2000), red (> 2000).
- **Create/delete**: Create new bookmarklets (and groups/folders) from the UI. Delete with confirmation.
- **No file watching**: If files are edited externally (e.g., in VS Code), the user must manually refresh the browser to pick up changes.

### UI Layout

```
┌─────────────────────────────────────────────────┐
│  bmman                                    [⟳]   │
├──────────────┬──────────────────────────────────┤
│              │  Name: [Custom Display Name    ] │
│  ▼ Utils     │  Desc: [Highlights all links   ] │
│    highlight │  Tags: [utility] [dom] [+]       │
│    cleanup   │──────────────────────────────────│
│  ▼ Dev Tools │                                  │
│    console   │  // source editor (CodeMirror)   │
│    network   │  document.querySelectorAll('a')  │
│              │    .forEach(a => {               │
│              │      a.style.outline =           │
│              │        '2px solid red';          │
│              │    });                           │
│              │──────────────────────────────────│
│              │  Compiled size: 847 chars  🟢    │
└──────────────┴──────────────────────────────────┘
```

### Technical Details

- The Svelte app communicates with a small **Vite plugin or Express middleware** running alongside the dev server to perform filesystem reads/writes (read `.js` files, write edits, read/write `manifest.json`, list directories).
- All file operations go through a single API layer (`/api/bookmarklets`, `/api/manifest`) to keep the Svelte code decoupled from Node filesystem details.

## Export (CLI)

Triggered via `npm run export`. This is a Node script in `scripts/export.js`.

### Behavior

1. Scans `bookmarklets/` for all `.js` files, grouped by folder.
2. Reads `manifest.json` for metadata.
3. Runs the compilation pipeline on each source file.
4. Generates `dist/index.html` + `dist/assets/` from an HTML template.

### Selective Export

```bash
# Export all bookmarklets
npm run export

# Export specific groups only
npm run export -- --groups utils,dev-tools

# Export specific bookmarklets by path
npm run export -- --include utils/highlight-links.js,dev-tools/console.js
```

### Exported HTML Page

The output is a static HTML page designed for end users (not developers). It contains:

- **Grouped sections**: One section per group, with the group name as a heading.
- **Bookmarklet buttons**: Each bookmarklet rendered as a styled `<a>` tag with `href="javascript:..."`. Users drag these to their bookmark bar.
- **Descriptions**: Shown below each button (from manifest).
- **Instructions**: A brief header explaining how to drag-and-drop bookmarklets to the bookmark bar.

```
┌──────────────────────────────────────────┐
│  Bookmarklet Collection                  │
│  Drag any button to your bookmark bar.   │
│                                          │
│  ── Utils ────────────────────────────   │
│                                          │
│  [ Highlight Links ]                     │
│  Highlights all links on the page.       │
│                                          │
│  [ Cleanup ]                             │
│  Removes ad elements from the DOM.       │
│                                          │
│  ── Dev Tools ────────────────────────   │
│                                          │
│  [ Console ]                             │
│  Opens an in-page console overlay.       │
│                                          │
└──────────────────────────────────────────┘
```

### Export Assets

- `dist/assets/style.css` — Styles for the exported page.
- `dist/assets/script.js` — Minimal JS for the exported page (e.g., copy-to-clipboard fallback, visual feedback on drag).
- These are generated from templates in `src/export-templates/` or similar.

## Deployment

The exported page is published to GitHub Pages via `.github/workflows/deploy-export.yml`:

- Triggers on push to `master` (or manually via `workflow_dispatch`).
- Runs `npm ci` → `npm test` → `npm run export`, then publishes `dist-export/` using the official Pages actions (`upload-pages-artifact` + `deploy-pages`). No `gh-pages` branch is maintained.
- Requires repo **Settings → Pages → Source: GitHub Actions**.
- The `github-pages` environment restricts deploys by branch. If deploys are allowed only from the default branch and the default is not `master`, add `master` under **Settings → Environments → github-pages → Deployment branches and tags**.

## Tech Stack

| Component          | Technology          |
|--------------------|---------------------|
| Manager UI         | Svelte + Vite       |
| Code editor        | CodeMirror 6        |
| JS bundling        | esbuild (Node)      |
| JS minification    | Terser (Node)       |
| Export pipeline     | Node script (CLI)   |
| Exported page      | Static HTML/CSS/JS  |

## Future Considerations

These are explicitly **out of scope** for v1 but noted for future design awareness:

- **Additional export formats**: JSON, browser-importable bookmarks HTML, Markdown. The export script should be structured to support multiple output formats via a `--format` flag.
- **Bookmarklet testing/preview**: Iframe-based preview of bookmarklets against target URLs.
- **Loader pattern**: For oversized bookmarklets, auto-generate a small loader that fetches the full script from a hosted URL.
- **Transpilation**: Optional Babel/SWC pass for ES5 compatibility.
- **Import**: Parse existing `javascript:` URLs back into readable source (deobfuscate, decode, un-minify).
