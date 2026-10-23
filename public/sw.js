// Network-only navigation: never cache ticket data, credentials, or authenticated responses.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
  if(event.request.mode!=="navigate") return;
  event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Helpdesk offline</title><body style="font:18px system-ui;padding:32px;background:#f5f7fb;color:#172033"><h1>You are offline</h1><p>Connect to the internet to open Mountain Torq IT Helpdesk. Your tickets remain on the server.</p><button onclick="location.reload()" style="padding:14px">Try again</button></body></html>',{headers:{"Content-Type":"text/html; charset=utf-8"}})));
});
