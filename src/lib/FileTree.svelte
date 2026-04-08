<script>
  let { groups = [], selected = null, onselect, oncreate, ondeselect } = $props();
  let showCreateForm = $state(false);
  let newGroup = $state('');
  let newGroupCustom = $state('');
  let newFilename = $state('');
  let useCustomGroup = $state(false);

  let groupIds = $derived(groups.map(g => g.id));

  function toggleForm() {
    showCreateForm = !showCreateForm;
    if (showCreateForm) {
      ondeselect();
      newGroup = groupIds[0] || '';
      newGroupCustom = '';
      newFilename = '';
      useCustomGroup = groupIds.length === 0;
    }
  }

  function handleGroupSelect(e) {
    const val = e.target.value;
    if (val === '__new__') {
      useCustomGroup = true;
      newGroup = '';
      newGroupCustom = '';
    } else {
      useCustomGroup = false;
      newGroup = val;
    }
  }

  function handleCreate() {
    const group = useCustomGroup ? newGroupCustom.trim() : newGroup;
    if (!group || !newFilename.trim()) return;
    oncreate({ group, filename: newFilename.trim() });
    newGroup = '';
    newGroupCustom = '';
    newFilename = '';
    showCreateForm = false;
    useCustomGroup = false;
  }
</script>

<nav class="file-tree">
  <div class="tree-header">
    <span class="tree-title">Bookmarklets</span>
    <button class="btn-icon" onclick={toggleForm} title="New bookmarklet">+</button>
  </div>

  {#if showCreateForm}
    <form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
      {#if groupIds.length > 0 && !useCustomGroup}
        <select onchange={handleGroupSelect} value={newGroup}>
          {#each groups as group}
            <option value={group.id}>{group.name}</option>
          {/each}
          <option value="__new__">New group...</option>
        </select>
      {:else}
        <div class="custom-group-row">
          <input bind:value={newGroupCustom} placeholder="new group name" />
          {#if groupIds.length > 0}
            <button type="button" class="btn-back" onclick={() => { useCustomGroup = false; newGroup = groupIds[0]; }} title="Pick existing group">&larr;</button>
          {/if}
        </div>
      {/if}
      <input bind:value={newFilename} placeholder="filename" />
      <button type="submit">Create</button>
    </form>
  {/if}

  {#each groups as group}
    <div class="group">
      <div class="group-name">{group.name}</div>
      {#each group.bookmarklets as bm}
        <button
          class="tree-item"
          class:active={selected === bm.id}
          onclick={() => onselect(bm)}
        >
          {bm.name}
        </button>
      {/each}
    </div>
  {/each}

  {#if groups.length === 0}
    <div class="empty">No bookmarklets yet. Click + to create one.</div>
  {/if}
</nav>

<style>
  .file-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    overflow-y: auto;
  }

  .tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 12px 8px;
    border-bottom: 1px solid var(--border);
  }

  .tree-title {
    font-weight: 600;
    font-size: 14px;
  }

  .btn-icon {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    width: 26px;
    height: 26px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
  }

  .btn-icon:hover {
    background: var(--hover);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  .create-form input,
  .create-form select {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-input);
    color: var(--text);
  }

  .create-form button[type="submit"] {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: var(--accent);
    color: white;
    cursor: pointer;
    font-size: 13px;
  }

  .custom-group-row {
    display: flex;
    gap: 4px;
  }

  .custom-group-row input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-input);
    color: var(--text);
  }

  .btn-back {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 13px;
  }

  .btn-back:hover {
    background: var(--hover);
  }

  .group {
    padding: 4px 0;
  }

  .group-name {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .tree-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px 6px 24px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--text);
    border-radius: 0;
  }

  .tree-item:hover {
    background: var(--hover);
  }

  .tree-item.active {
    background: var(--active);
    color: var(--accent);
  }

  .empty {
    padding: 20px 12px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
