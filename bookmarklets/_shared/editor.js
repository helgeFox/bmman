
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
  if (res.hash.indexOf('#edit/') >= 0) return res.hash.substr(res.hash.indexOf('#edit/') + 6)
}

export function getSessionId(url) {
  var res = new URL(src)
  return res.searchParams.has(key) ? n.searchParams.get(key) : null
}

export function getCurrentEnvironment(url) {
  var urls = {
    debug: ['://localhost:7066'],
    dev: ['://publish.megler.local', '://html5-publish.megler.local'],
    qa: ['://publish.qa.vitecnext.no', '://html5-publish.qa.vitecnext.no'],
    prod: ['://publish.vitecnext.no', '://html5-publish.vitecnext.no']
  }
  var test = (cand) => (url.indexOf(cand) >= 0)
  var environment = 'debug'
  if (urls.debug.some(test)) environment = 'debug'
  if (urls.dev.some(test)) environment = 'dev'
  if (urls.qa.some(test)) environment = 'qa'
  if (urls.prod.some(test)) environment = 'prod'
  return environment
}
