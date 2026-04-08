import { getHref } from '../_shared/editor.js'
import { newWindow } from '../_shared/utils.js'

var href = getHref(window.document)
if (href && href.length > 0 && href.indexOf("editor/") >= 0) {
  var querystring = href.substr(href.indexOf("editor/") + "editor/".length),
  newUrl = "http://localhost:3000/" + querystring
  newWindow(window, newUrl)
}
