// Visual feedback during drag
document.querySelectorAll('.bm-button').forEach(btn => {
  btn.addEventListener('dragstart', () => btn.classList.add('dragging'));
  btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
});
