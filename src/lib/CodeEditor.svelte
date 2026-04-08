<script>
  import { onMount } from 'svelte';

  let { value = '', onchange } = $props();
  let container;
  let view;
  let ready = $state(false);
  let programmatic = false;

  onMount(async () => {
    const [
      { EditorView, basicSetup },
      { javascript },
      { oneDark },
      { EditorState },
      { keymap },
      { indentWithTab },
    ] = await Promise.all([
      import('codemirror'),
      import('@codemirror/lang-javascript'),
      import('@codemirror/theme-one-dark'),
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
    ]);

    view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          javascript(),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !programmatic) {
              onchange(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ],
      }),
      parent: container,
    });
    ready = true;

    return () => view?.destroy();
  });

  $effect(() => {
    if (ready && view) {
      const current = view.state.doc.toString();
      if (current !== value) {
        programmatic = true;
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
        programmatic = false;
      }
    }
  });
</script>

<div class="editor-container" bind:this={container}></div>

<style>
  .editor-container {
    flex: 1;
    overflow: hidden;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }
</style>
