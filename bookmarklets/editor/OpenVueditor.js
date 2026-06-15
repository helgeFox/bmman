import { getHref } from '../_shared/editor.js'
import { newWindow } from '../_shared/utils.js'

const href = getHref(window.document)
if (href && href.length > 0 && href.indexOf("/editor/") >= 0) {
  const newUrl = href.replace('://html5-publish.', '://static-publish.').replace('/editor/', '/vueditor/')
  newWindow(window, newUrl)
}
else {
  alert('URL format stemmer ikke? (url: ' + href + ')')
}
