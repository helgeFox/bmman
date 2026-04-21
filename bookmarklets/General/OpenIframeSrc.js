var iframe = document.querySelector('iframe[src]') 
if (iframe) {
    var r = iframe.getAttribute("src")
    if (r) window.open(r, "_blank")
    else alert('Fant ikke noen <iframe> å hente [src] fra!')
}
