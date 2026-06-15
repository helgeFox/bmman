import { getHref } from '../_shared/editor.js'
import { newWindow } from '../_shared/utils.js'

const href = getHref(window.document)
if (href && href.length > 0 && href.indexOf("/vueditor/") >= 0) {
  const newUrl = href.replace('://static-publish.', '://html5-publish.').replace('/vueditor/', '/editor/')
  newWindow(window, newUrl)
}
else {
  alert('URL format stemmer ikke? (url: ' + href + ')')
}
