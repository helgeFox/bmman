<script>
  import FileTree from './lib/FileTree.svelte';
  import CodeEditor from './lib/CodeEditor.svelte';
  import MetaEditor from './lib/MetaEditor.svelte';
  import SizeIndicator from './lib/SizeIndicator.svelte';
  import { fetchBookmarklets, saveSource, saveMeta, createBookmarklet, deleteBookmarklet, checkHealth } from './lib/api.js';

  let groups = $state([]);
  let selected = $state(null);
  let source = $state('');
  let saving = $state(false);
  let online = $state(true);
  let saveError = $state(null);
  let dirty = $state(false);
  let saveTimer;

  $effect(() => {
    let timer;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        const wasOnline = online;
        const now = await checkHealth();
        online = now;
        if (now && !wasOnline && dirty) {
          // Server just came back — try to flush unsaved changes
          // before Vite's HMR triggers a full page reload.
          flushSave();
        }
      }
      if (!cancelled) timer = setTimeout(tick, online ? 15000 : 3000);
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        tick();
      }
    }

    function onBeforeUnload(e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }

    tick();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  });

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
    dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saving = true;
    saveTimer = setTimeout(() => flushSave(), 500);
  }

  async function flushSave() {
    if (!selected) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    saving = true;
    try {
      await saveSource(selected.id, source);
      saveError = null;
      online = true;
      dirty = false;
    } catch (e) {
      saveError = e?.message || 'save failed';
      online = false;
    } finally {
      saving = false;
    }
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

{#if !online || saveError}
  <div class="alert-banner" role="alert">
    <span class="alert-icon">⚠</span>
    <span class="alert-msg">
      {#if !online}
        Dev server offline — unsaved changes in the editor will be lost on reload.
      {:else}
        Save failed: {saveError}
      {/if}
    </span>
    <button class="retry-btn" onclick={() => flushSave()} disabled={saving}>
      {saving ? 'Retrying…' : 'Retry save'}
    </button>
  </div>
{/if}

<div class="app" class:with-banner={!online || saveError}>
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
        {#if !online}
          <span class="save-status offline">⚠ Dev server offline — changes not saved</span>
        {:else if saving}
          <span class="save-status">Saving...</span>
        {:else if saveError}
          <span class="save-status offline">Save failed: {saveError}</span>
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

  .app.with-banner {
    height: calc(100vh - 44px);
  }

  .alert-banner {
    position: sticky;
    top: 0;
    z-index: 1000;
    height: 44px;
    box-sizing: border-box;
    padding: 0 16px;
    background: var(--danger);
    color: #1e1e2e;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .alert-icon {
    font-size: 18px;
  }

  .alert-msg {
    flex: 1;
  }

  .retry-btn {
    padding: 4px 12px;
    border: 1px solid #1e1e2e;
    border-radius: 4px;
    background: #1e1e2e;
    color: var(--danger);
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
  }

  .retry-btn:hover:not(:disabled) {
    background: transparent;
    color: #1e1e2e;
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: default;
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

  .save-status.offline {
    color: var(--danger);
    font-weight: 600;
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
