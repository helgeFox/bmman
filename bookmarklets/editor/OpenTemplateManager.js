import { getHref } from '../_shared/editor.js'
import { replaceIf, newWindow } from '../_shared/utils.js'

var href = getHref(window.document), newUrl = replaceIf('#create/', '#extended/', href)
if (!newUrl) newUrl = replaceIf('#createad/', '#extended/', href)
if (!newUrl) newUrl = replaceIf('#createcompositead/', '#extended/', href)
if (newUrl && newUrl.length >= 0)
  newWindow(window, newUrl)
else alert('Klarte ikke parse url skikkelig (' + href + ')')
