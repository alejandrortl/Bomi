// js/modules/push.js
// Avisos push en el móvil/ordenador (Web Push): registra el service worker y suscribe este dispositivo.
// Script clásico: expone window.BomiPush. Depende de `supabaseClient` y `window.currentUserProfile`.
(function () {
    'use strict';

    // Clave pública VAPID (la privada vive solo en la Edge Function `enviar-push`).
    const CLAVE_PUBLICA = 'BEpScuL9dRkc4u7f2UaHUG3G8YI2j-C6O_qxeiaJfo7UaLiBGjyvTkPLv5r7RSKPcIopIYGDT4XpSSEaZJdkwdE';

    let registro = null;

    const db = () => supabaseClient;
    const yo = () => window.currentUserProfile || null;
    const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalada = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const hayApi = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    function aUint8(base64Url) {
        const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
        const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from(raw, (c) => c.charCodeAt(0));
    }

    async function registrarSW() {
        if (!('serviceWorker' in navigator)) return null;
        if (registro) return registro;
        try { registro = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; } catch (e) { registro = null; }
        return registro;
    }

    async function suscripcionActual() {
        const reg = await registrarSW();
        return reg ? reg.pushManager.getSubscription() : null;
    }

    // 'no-soportado' | 'instalar' (iPhone sin instalar la app) | 'bloqueado' | 'activo' | 'inactivo'
    async function estado() {
        if (!hayApi()) return esIOS() && !instalada() ? 'instalar' : 'no-soportado';
        if (Notification.permission === 'denied') return 'bloqueado';
        if (Notification.permission === 'granted') {
            const s = await suscripcionActual();
            if (s) return 'activo';
        }
        return 'inactivo';
    }

    async function guardar(sub) {
        const j = sub.toJSON();
        const { error } = await db().from('push_subscriptions').upsert({
            user_id: yo().id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 250),
        }, { onConflict: 'endpoint' });
        if (error) throw error;
    }

    // Debe llamarse desde un toque del usuario (iPhone lo exige).
    async function activar() {
        if (!hayApi()) throw new Error(esIOS() && !instalada() ? 'En iPhone primero añade la app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí.' : 'Este navegador no admite avisos.');
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') throw new Error('No diste permiso para mostrar avisos. Puedes cambiarlo en los ajustes del navegador o del móvil.');
        const reg = await registrarSW();
        if (!reg) throw new Error('No se pudo preparar la app para recibir avisos.');
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8(CLAVE_PUBLICA) });
        await guardar(sub);
        return true;
    }

    async function desactivar() {
        const sub = await suscripcionActual();
        if (!sub) return true;
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await db().from('push_subscriptions').delete().eq('endpoint', endpoint);
        return true;
    }

    // Tras iniciar sesión: prepara el service worker y renueva la suscripción si ya había permiso.
    async function alIniciarSesion() {
        await registrarSW();
        if (hayApi() && Notification.permission === 'granted' && yo()) {
            try { const s = await suscripcionActual(); if (s) await guardar(s); } catch (e) { /* se reintentará en la próxima sesión */ }
        }
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (e) => {
            const d = e.data || {};
            if (d.tipo === 'abrir-notificacion' && window.BomiNotificaciones) {
                window.BomiNotificaciones.recargar();
                window.BomiNotificaciones.irA(d.titulo || '');
            }
        });
    }
    window.addEventListener('userLoggedIn', alIniciarSesion);
    window.BomiPush = { estado, activar, desactivar };
})();
