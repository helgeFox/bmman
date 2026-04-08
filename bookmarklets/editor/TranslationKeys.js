import { getHref, setHref } from '../_shared/editor.js'

var href = getHref(window.document)
var str = 'debug-translation-keys=true', newHref
if (href.indexOf('debug-translation-keys') >= 0)
  newHref = href.replace(/debug-translation-keys=(true|false)/, str)
else if (href.indexOf('?') >= 0)
  newHref = href.replace(/\?/, '?' + str + '&')
if (newHref)
  setHref(window.document, newHref)
else alert('Sorry, klarte ikke endre url... Er du i Editor?')
