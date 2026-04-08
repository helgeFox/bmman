import { getHref, getEditGuid } from '../_shared/editor.js'
import { copyText } from '../_shared/utils.js'

var href = getHref(window.document),
  guid = getEditGuid(href)
if (guid)
  copyText(window, guid, 'GUID Koppiert!')
else {
  alert('Sorry, kunne ikke finne noen GUID å kopiere... Er du i *EDIT* mode?'), console.log('feil?', href, guid)
}
