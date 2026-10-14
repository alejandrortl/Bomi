// sw.js — service worker: mantiene la app instalable y muestra los avisos push aunque la web esté cerrada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

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
