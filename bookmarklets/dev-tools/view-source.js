const w = window.open('', '_blank', 'width=800,height=600');
w.document.write(
  '<pre>' +
  document.documentElement.outerHTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;') +
  '</pre>'
);
w.document.close();
