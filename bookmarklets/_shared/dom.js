export function highlight(selector, color = 'red') {
  document.querySelectorAll(selector).forEach(el => {
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = '2px';
  });
}

export function removeAll(selector) {
  document.querySelectorAll(selector).forEach(el => el.remove());
}
