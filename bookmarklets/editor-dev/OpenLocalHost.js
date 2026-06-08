import { getHref } from '../_shared/editor.js'
import { newWindow } from '../_shared/utils.js'

const href = getHref(window.document)
if (href && href.length > 0 && href.indexOf("editor/") >= 0) {
  const querystring = href.substr(href.indexOf("editor/") + "editor/".length),
    newUrl = "http://localhost:3000/" + querystring
  newWindow(window, newUrl)
}
