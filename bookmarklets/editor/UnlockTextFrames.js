import { getHref, setHref } from '../_shared/editor.js'

const href = getHref(window.document),
    key = 'admin_override_locked_pageitems',
    str = `${key}=true`
let newHref
if (href.indexOf(key) >= 0)
  newHref = href.replace(new RegExp(`${key}=(true|false)`), str)
else if (href.indexOf('?') >= 0)
  newHref = href.replace(/\?/, '?' + str + '&')
if (newHref)
  setHref(window.document, newHref)
else alert('Sorry, klarte ikke endre url... Er du i Editor?')
