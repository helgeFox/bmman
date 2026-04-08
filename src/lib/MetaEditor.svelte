<script>
  let { name = '', description = '', tags = [], icon = '', onchange, ondelete } = $props();
  let tagInput = $state('');
  let showIconPicker = $state(false);
  let iconSearch = $state('');

  const emojiGroups = {
    'Common': ['🔧','🛠','⚙','🔍','🔎','📋','📌','📎','✏','🖊','💡','⭐','🚀','💾','📁','📂','🗂','🔗','🔒','🔓'],
    'Actions': ['▶','⏹','🔄','♻','✅','❌','➕','➖','🔀','↩','↪','⬆','⬇','🗑','📤','📥','🧹','🧪','🎯','🏷'],
    'UI & Web': ['🖼','🎨','📐','📏','🔲','🔳','👁','💬','🔔','🔕','📊','📈','🌐','💻','📱','🖥','⌨','🖱','🪟','📄'],
    'Symbols': ['⚡','🔥','💧','🌙','☀','🌈','❤','💜','💙','💚','🟢','🔴','🟡','🔵','⚪','⬛','🏴','🏁','⚠','ℹ'],
  };

  function selectIcon(emoji) {
    onchange({ name, description, tags, icon: emoji });
    showIconPicker = false;
    iconSearch = '';
  }

  function clearIcon() {
    onchange({ name, description, tags, icon: '' });
    showIconPicker = false;
    iconSearch = '';
  }

  function handlePaste(e) {
    // Grab pasted text directly as icon
    const text = (e.clipboardData || window.clipboardData).getData('text').trim();
    if (text) {
      // Take first emoji/character cluster
      const chars = [...text];
      selectIcon(chars[0]);
      e.preventDefault();
    }
  }

  function handleSearchKeydown(e) {
    if (e.key === 'Enter' && iconSearch.trim()) {
      e.preventDefault();
      selectIcon([...iconSearch.trim()][0]);
    }
  }

  function handleNameChange(e) {
    onchange({ name: e.target.value, description, tags, icon });
  }

  function handleDescChange(e) {
    onchange({ name, description: e.target.value, tags, icon });
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag];
      onchange({ name, description, tags: newTags, icon });
    }
    tagInput = '';
  }

  function removeTag(tag) {
    onchange({ name, description, tags: tags.filter(t => t !== tag), icon });
  }
</script>

<div class="meta-editor">
  <div class="field field-icon">
    <label>Icon</label>
    <div class="icon-wrapper">
      <button class="icon-btn" onclick={() => showIconPicker = !showIconPicker} title="Pick icon">
        {#if icon}
          <span class="icon-preview">{icon}</span>
        {:else}
          <span class="icon-placeholder">+</span>
        {/if}
      </button>
      {#if showIconPicker}
        <div class="icon-picker">
          <div class="icon-picker-header">
            <input
              class="icon-search"
              bind:value={iconSearch}
              onpaste={handlePaste}
              onkeydown={handleSearchKeydown}
              placeholder="Paste or type emoji..."
              autofocus
            />
            {#if icon}
              <button class="icon-clear" onclick={clearIcon}>Clear</button>
            {/if}
          </div>
          {#each Object.entries(emojiGroups) as [groupName, emojis]}
            <div class="emoji-group-label">{groupName}</div>
            <div class="emoji-grid">
              {#each emojis as emoji}
                <button class="emoji-btn" class:selected={icon === emoji} onclick={() => selectIcon(emoji)}>{emoji}</button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <div class="field">
    <label for="bm-name">Name</label>
    <input id="bm-name" type="text" value={name} oninput={handleNameChange} />
  </div>
  <div class="field">
    <label for="bm-desc">Description</label>
    <input id="bm-desc" type="text" value={description} oninput={handleDescChange} />
  </div>
  <div class="field">
    <label>Tags</label>
    <div class="tags-row">
      {#each tags as tag}
        <span class="tag">
          {tag}
          <button class="tag-remove" onclick={() => removeTag(tag)}>x</button>
        </span>
      {/each}
      <form class="tag-form" onsubmit={(e) => { e.preventDefault(); addTag(); }}>
        <input bind:value={tagInput} placeholder="add tag..." class="tag-input" />
      </form>
    </div>
  </div>
  <div class="actions">
    <button class="btn-delete" onclick={ondelete}>Delete bookmarklet</button>
  </div>
</div>

<style>
  .meta-editor {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    align-items: flex-end;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 150px;
  }

  .field-icon {
    flex: 0 0 auto;
    min-width: auto;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  input {
    padding: 6px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-input);
    color: var(--text);
  }

  .icon-wrapper {
    position: relative;
  }

  .icon-btn {
    width: 36px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-input);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-preview {
    font-size: 18px;
    line-height: 1;
  }

  .icon-placeholder {
    font-size: 16px;
    color: var(--text-muted);
  }

  .icon-picker {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    width: 280px;
    max-height: 320px;
    overflow-y: auto;
    background: var(--bg-sidebar, #181825);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px;
    margin-top: 4px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .icon-picker-header {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .icon-search {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-input);
    color: var(--text);
  }

  .icon-clear {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
  }

  .icon-clear:hover {
    color: var(--danger);
    border-color: var(--danger);
  }

  .emoji-group-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 4px 0 2px;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
  }

  .emoji-btn {
    width: 26px;
    height: 26px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .emoji-btn:hover {
    background: var(--hover);
    border-color: var(--border);
  }

  .emoji-btn.selected {
    background: var(--active);
    border-color: var(--accent);
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--accent);
    color: white;
    font-size: 12px;
  }

  .tag-remove {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    opacity: 0.7;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .tag-form {
    display: inline;
  }

  .tag-input {
    width: 80px;
    padding: 2px 6px;
    font-size: 12px;
  }

  .actions {
    display: flex;
    align-items: flex-end;
  }

  .btn-delete {
    padding: 6px 12px;
    border: 1px solid var(--danger);
    border-radius: 4px;
    background: none;
    color: var(--danger);
    cursor: pointer;
    font-size: 12px;
  }

  .btn-delete:hover {
    background: var(--danger);
    color: white;
  }
</style>
