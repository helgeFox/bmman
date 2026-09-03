
export function getHref(doc){
  const iframe = doc.querySelector('body > iframe[src]')
  return iframe ? iframe.getAttribute('src') : doc.location.href
}

export function setHref(doc, url) {
  const iframe = doc.querySelector('body > iframe[src]')
  if (iframe) iframe.setAttribute('src', url)
  else doc.location.href = url
}

export function getEditGuid(src) {
  const res = new URL(src)
  if (res.hash.indexOf('#create/') >= 0) return null
  if (res.hash.indexOf('#edit/') >= 0) return res.hash.substr(res.hash.indexOf('#edit/') + 6)
}

export function getSessionId(url, key) {
  const params = new URL(url).searchParams
  const sid = params.has(key) ? params.get(key) : null
  return sid // ? decodeURIComponent(sid) : null
}

export function getCurrentEnvironment(url) {
  const urls = {
    debug: ['://localhost:7066'],
    dev: ['://publish.megler.local', '://html5-publish.megler.local'],
    qa: ['://publish.qa.vitecnext.no', '://html5-publish.qa.vitecnext.no'],
    prod: ['://publish.vitecnext.no', '://html5-publish.vitecnext.no']
  }
  const test = (cand) => (url.indexOf(cand) >= 0)
  let environment = 'debug'
  if (urls.debug.some(test)) environment = 'debug'
  if (urls.dev.some(test)) environment = 'dev'
  if (urls.qa.some(test)) environment = 'qa'
  if (urls.prod.some(test)) environment = 'prod'
  return environment
}
