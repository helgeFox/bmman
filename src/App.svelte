<script>
  import FileTree from './lib/FileTree.svelte';
  import CodeEditor from './lib/CodeEditor.svelte';
  import MetaEditor from './lib/MetaEditor.svelte';
  import SizeIndicator from './lib/SizeIndicator.svelte';
  import { fetchBookmarklets, saveSource, saveMeta, createBookmarklet, deleteBookmarklet } from './lib/api.js';

  let groups = $state([]);
  let selected = $state(null);
  let source = $state('');
  let saving = $state(false);
  let saveTimer;

  async function load() {
    groups = await fetchBookmarklets();
    if (selected) {
      for (const g of groups) {
        const found = g.bookmarklets.find(b => b.id === selected.id);
        if (found) {
          selected = found;
          source = found.source;
          return;
        }
      }
      selected = null;
      source = '';
    }
  }

  function handleSelect(bm) {
    if (saveTimer) clearTimeout(saveTimer);
    selected = bm;
    source = bm.source;
  }

  function handleSourceChange(newSource) {
    source = newSource;
    if (saveTimer) clearTimeout(saveTimer);
    saving = true;
    saveTimer = setTimeout(() => flushSave(), 500);
  }

  async function flushSave() {
    if (!selected) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    saving = true;
    await saveSource(selected.id, source);
    saving = false;
  }

  async function handleMetaChange(meta) {
    if (!selected) return;
    const updatePayload = {};
    if (meta.name !== selected.name) updatePayload.name = meta.name;
    if (meta.description !== selected.description) updatePayload.description = meta.description;
    if (JSON.stringify(meta.tags) !== JSON.stringify(selected.tags)) updatePayload.tags = meta.tags;
    if (meta.icon !== selected.icon) updatePayload.icon = meta.icon;

    if (Object.keys(updatePayload).length > 0) {
      await saveMeta(selected.id, updatePayload);
      await load();
    }
  }

  async function handleCreate({ group, filename }) {
    await createBookmarklet({ group, filename, source: '', description: '' });
    await load();
    for (const g of groups) {
      const safeName = filename.endsWith('.js') ? filename : filename + '.js';
      const found = g.bookmarklets.find(b => b.id === `${group}/${safeName}`);
      if (found) {
        selected = found;
        source = found.source;
        break;
      }
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.name}"?`)) return;
    await deleteBookmarklet(selected.id);
    selected = null;
    source = '';
    await load();
  }

  load();
</script>

<svelte:window onkeydown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    flushSave();
  }
}} />

<div class="app">
  <aside class="sidebar">
    <FileTree
      {groups}
      selected={selected?.id}
      onselect={handleSelect}
      oncreate={handleCreate}
      ondeselect={() => { selected = null; source = ''; }}
    />
  </aside>

  <main class="main">
    {#if selected}
      <MetaEditor
        name={selected.name}
        description={selected.description}
        tags={selected.tags}
        icon={selected.icon}
        onchange={handleMetaChange}
        ondelete={handleDelete}
      />
      <CodeEditor value={source} onchange={handleSourceChange} />
      <div class="status-bar">
        <SizeIndicator {source} />
        {#if saving}
          <span class="save-status">Saving...</span>
        {:else}
          <span class="save-status">Saved</span>
        {/if}
      </div>
    {:else}
      <div class="placeholder">
        <p>Select a bookmarklet from the sidebar, or create a new one.</p>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(:root) {
    --bg: #1e1e2e;
    --bg-sidebar: #181825;
    --bg-input: #313244;
    --border: #45475a;
    --text: #cdd6f4;
    --text-muted: #a6adc8;
    --hover: #313244;
    --active: #45475a;
    --accent: #89b4fa;
    --danger: #f38ba8;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
  }

  .app {
    display: flex;
    height: 100vh;
  }

  .sidebar {
    width: 240px;
    min-width: 200px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-right: 16px;
  }

  .save-status {
    font-size: 12px;
    color: var(--text-muted);
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
