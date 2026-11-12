/* Service worker: díky němu appka funguje bez internetu.
   Když změníš kód nebo přidáš balíček, zvyš číslo VERZE, ať si telefon stáhne novou kopii. */
const VERZE = 'klaudie-v5';
const ZAKLAD = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/speech.js', 'js/packs.js', 'js/ui.js',
  'js/home.js', 'js/exercise.js', 'js/dialog.js', 'js/reading.js', 'js/vocab.js',
  'js/write.js', 'js/missions.js', 'js/parent.js', 'js/fx.js',
  'data/dictionary.json', 'packs/index.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERZE);
    await c.addAll(ZAKLAD);
    // všechny balíčky z packs/index.json
    try {
      const idx = await (await fetch('packs/index.json', { cache: 'no-store' })).json();
      await Promise.all((idx.packs || []).map(f => c.add('packs/' + f).catch(() => {})));
    } catch (err) { /* offline při instalaci: balíčky se dočtou příště */ }
    // nahrané hlasy (audio/index.json + jeden .json a .bin na balíček)
    try {
      const a = await (await fetch('audio/index.json', { cache: 'no-store' })).json();
      await c.put('audio/index.json', new Response(JSON.stringify(a), { headers: { 'Content-Type': 'application/json' } }));
      await Promise.all((a.bundles || []).flatMap(b => [`audio/${b}.json`, `audio/${b}.bin`]).map(u => c.add(u).catch(() => {})));
    } catch (err) { /* bez nahrávek appka mluví hlasem telefonu */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERZE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Nejdřív kopie z telefonu (rychlé a funguje offline), na pozadí se stáhne novější.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERZE);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    if (r) return r;
    if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
    return Response.error();
  })());
});
