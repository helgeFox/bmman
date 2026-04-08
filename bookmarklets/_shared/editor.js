
export function getHref(doc){
  var iframe = doc.querySelector('body > iframe[src]')
  return iframe ? iframe.getAttribute('src') : doc.location.href
}

export function setHref(doc, url) {
  var iframe = doc.querySelector('body > iframe[src]')
  if (iframe) iframe.setAttribute('src', url)
  else doc.location.href = url
}

export function getEditGuid(src) {
  var res = new URL(src)
  if (res.hash.indexOf('#create/') >= 0) return null
  if (res.hash.indexOf('#edit/')) return res.hash.substr(res.hash.indexOf('/') + 1)
}

export function getSessionId(url) {
  var res = new URL(src)
  return res.searchParams.has(key) ? n.searchParams.get(key) : null
}

export function getCurrentEnvironment(url) {
  var environment = 'debug'
  if (url.indexOf('://publish.megler.local') > 0) environment='dev'
  if (url.indexOf('://publish.qa.vitecnext.no') > 0) environment='qa'
  if (url.indexOf('://publish.vitecnext.no') > 0) environment='prod'
  return environment
}
