
export function newWindow(window, url) {
  const win = window.open(url, '_blank')
  win.focus()
}

export function replaceIf(oldVal, newVal, source) {
  let ret = false
  if (source && source.length > 0 && source.indexOf(oldVal) >= 0)
    ret = source.replace(oldVal, newVal)
  return ret
}

export function copyText(window, str, message) {
  window.navigator.clipboard.writeText(str).then(window.alert.bind(null, message)).catch(err => console.log('copyText error:', err))
}
