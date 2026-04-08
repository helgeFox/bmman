
export function newWindow(window, url) {
  var win = window.open(url, '_blank')
  win.focus()
}

export function replaceIf(oldVal, newVal, source) {
  var ret = false
  if (source && source.length > 0 && source.indexOf(oldVal) >= 0)
    ret = source.replace(oldVal, newVal)
  return ret
}

export function copyText(window, str, message) {
  window.navigator.clipboard.writeText(str).then(window.alert.bind(null, message))
}
