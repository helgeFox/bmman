document.querySelectorAll('*').forEach(el => {
  const style = getComputedStyle(el);
  if (style.position === 'fixed' || style.position === 'sticky') {
    el.style.position = 'static';
  }
});
