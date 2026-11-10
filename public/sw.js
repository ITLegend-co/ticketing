// Build prepends the hashed version and exact static asset list.
const CACHE = 'mt-helpdesk-shell-' + SHELL_VERSION;
const ROOT = new URL('./', self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL_FILES.map(path => new URL(path, ROOT).href));
  // Activate on the next launch; never replace code underneath an unsent form.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await Promise.all((await caches.keys()).filter(k => k.startsWith('mt-helpdesk-shell-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== new URL(ROOT).origin || !url.href.startsWith(ROOT)) return;
  // Firebase, Apps Script, authentication and ticket/photo responses never enter this cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await caches.open(CACHE)).match(ROOT).then(r => r || Response.error())));
  } else if (SHELL_FILES.some(path => new URL(path, ROOT).href === url.href)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(event.request)) || fetch(event.request))());
  }
});
