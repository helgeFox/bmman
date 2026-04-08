<script>
  import { estimateCompiledSize, getSizeLevel } from './compiler.js';

  let { source = '' } = $props();

  let size = $derived(estimateCompiledSize(source));
  let level = $derived(getSizeLevel(size));
</script>

<div class="size-indicator" data-level={level}>
  <span class="size-dot"></span>
  <span>Compiled size: ~{size.toLocaleString()} chars</span>
  {#if level === 'warn'}
    <span class="size-note">Approaching browser limit</span>
  {:else if level === 'danger'}
    <span class="size-note">May exceed browser URL limit</span>
  {/if}
</div>

<style>
  .size-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    font-size: 13px;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
  }

  .size-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  [data-level="ok"] .size-dot { background: #22c55e; }
  [data-level="warn"] .size-dot { background: #eab308; }
  [data-level="danger"] .size-dot { background: #ef4444; }

  .size-note {
    font-size: 12px;
    opacity: 0.7;
  }
</style>
