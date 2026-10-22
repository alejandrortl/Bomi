// sw.js — service worker: mantiene la app instalable, la deja abrir sin conexión y muestra los avisos push aunque la web esté cerrada.
// Archivos de la app: siempre se pide primero a la red (así los cambios llegan al momento); si no hay red o es muy lenta,
// se usa la última copia guardada. Los datos (Supabase) nunca pasan por aquí.
const CACHE = 'bomi-app-v1';
const CDNS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => clients.claim())
));

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const propio = url.origin === self.location.origin;
    if (!propio && !CDNS.includes(url.hostname)) return;     // Supabase, mapas, etc.: directo a la red
    if (propio && url.pathname.startsWith('/api/')) return;  // manifest e icono dinámicos
    event.respondWith(redPrimero(req));
});

async function redPrimero(req) {
    const cache = await caches.open(CACHE);
    const red = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()).catch(() => {});
        return r;
    });
    red.catch(() => {});
    try {
        return await Promise.race([red, new Promise((_, ko) => setTimeout(() => ko(new Error('lenta')), 6000))]);
    } catch (e) {
        const guardada = await cache.match(req, { ignoreSearch: req.mode === 'navigate' })
            || (req.mode === 'navigate' ? (await cache.match('/index.html') || await cache.match('/')) : null);
        if (guardada) return guardada;
        return red;
    }
}

self.addEventListener('push', (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { titulo: 'Diario de Obra', mensaje: event.data ? event.data.text() : '' }; }
    const titulo = d.titulo || 'Diario de Obra';
    event.waitUntil(self.registration.showNotification(titulo, {
        body: d.mensaje || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: d.id || undefined,
        data: { id: d.id || null, titulo },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
            if (lista.length > 0) {
                lista[0].postMessage({ tipo: 'abrir-notificacion', titulo: data.titulo, id: data.id });
                return lista[0].focus();
            }
            return clients.openWindow('/?aviso=' + encodeURIComponent(data.id || '1'));
        })
    );
});
