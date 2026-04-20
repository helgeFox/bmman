// Visual feedback during drag
document.querySelectorAll('.bm-button').forEach(btn => {
  btn.addEventListener('dragstart', () => btn.classList.add('dragging'));
  btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
});

// Theme selector — persists override in localStorage; 'auto' follows OS
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
  themeSelect.value = localStorage.getItem('bm-theme') || 'auto';
  themeSelect.addEventListener('change', () => {
    const v = themeSelect.value;
    if (v === 'auto') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('bm-theme');
    } else {
      document.documentElement.setAttribute('data-theme', v);
      localStorage.setItem('bm-theme', v);
    }
  });
}
