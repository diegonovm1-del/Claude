/*
  Service worker do Leitor: guarda o app para funcionar sem internet.
  Ao publicar uma versão nova, aumente o número em VERSION.
*/
const VERSION = 'v6';
const CACHE = 'leitor-' + VERSION;
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const FILES = [
  './', './index.html', './app.css', './app.js', './ai.js', './ai-worker.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  PDFJS + 'pdf.min.js', PDFJS + 'pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('leitor-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Modelos da IA (Hugging Face, GitHub) são grandes e o WebLLM já guarda por conta
  // própria: o service worker não mexe neles, para não ocupar o espaço duas vezes.
  if (url.origin !== location.origin && url.host !== 'cdnjs.cloudflare.com') return;

  // Bibliotecas externas: usa o que está guardado; busca na rede só se faltar.
  if (url.origin !== location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Arquivos do app: responde na hora com o que está guardado e atualiza em segundo plano.
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }));
});
