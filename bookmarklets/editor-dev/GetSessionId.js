import { getHref, getSessionId } from '../_shared/editor.js'

const sid = getSessionId(getHref(window.document), 'sessionId')
if (sid) window.navigator.clipboard.writeText(encodeURIComponent(sid)).then(e.alert.bind(null, 'SessionID Koppiert!'))
else alert('Sorry, kunne ikke finne noen SessionId å kopiere...')
