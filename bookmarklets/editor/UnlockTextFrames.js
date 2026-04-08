import { getHref, setHref } from '../_shared/editor.js'

var href = getHref(window.document)
var str = 'admin_override_locked_pageitems=true', newHref
if (href.indexOf('admin_override_locked_pageitems') >= 0)
  newHref = href.replace(/admin_override_locked_pageitems=(true|false)/, str)
else if (href.indexOf('?') >= 0)
  newHref = href.replace(/\?/, '?' + str + '&')
if (newHref)
  setHref(window.document, newHref)
else alert('Sorry, klarte ikke endre url... Er du i Editor?')
