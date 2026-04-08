import { getHref, getEditGuid, getCurrentEnvironment } from '../_shared/editor.js'

var urls = {
  debug:'https://localhost:7066',
  dev:'https://invoice-publish.megler.local',
  qa:'https://invoice-publish.qa.vitecnext.no',
  prod:'https://invoice-publish.vitecnext.no'
},
  href = getHref(window.document),
  guid = getEditGuid(href),
  environment = getCurrentEnvironment(href)
if (guid) window.open(`${urls[environment]}/Extras/Idml?guid=${guid}&handler=Download`)
else alert('Sorry, kunne ikke finne noen IDML å laste ned... Er du i *EDIT* mode?'), console.log('feil', href, guid, environment)
