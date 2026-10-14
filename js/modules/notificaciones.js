// js/modules/notificaciones.js
// Campana de la barra superior: lista de avisos del usuario (tabla `notificaciones`).
// Script clásico: expone window.BomiNotificaciones. Depende de `supabaseClient` y `window.currentUserProfile`.
(function () {
    'use strict';

    const REFRESCO_MS = 60000;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const yo = () => window.currentUserProfile || null;

    let lista = [];
    let iniciado = false;
    let temporizador = null;
    let panel = null;

    const abierto = () => !!panel && !panel.classList.contains('hidden');

    function fecha(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const hoy = new Date();
        const misma = d.toDateString() === hoy.toDateString();
        return misma
            ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    }

    function pintarInsignia() {
        const badge = document.getElementById('badge-notificaciones');
        const btn = document.getElementById('btn-notificaciones');
        const sinLeer = lista.filter((n) => !n.leida).length;
        if (badge) badge.classList.toggle('hidden', sinLeer === 0);
        if (btn) btn.setAttribute('aria-label', sinLeer ? `Notificaciones (${sinLeer} sin leer)` : 'Notificaciones');
    }

    function pintarPanel() {
        if (!panel) return;
        const sinLeer = lista.filter((n) => !n.leida).length;
        const items = lista.length
            ? lista.map((n) => `
                <button type="button" data-id="${esc(n.id)}" class="notif-item w-full text-left px-4 py-3 flex flex-col gap-0.5 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 ${n.leida ? 'opacity-70' : 'bg-blue-50 dark:bg-blue-950/40'}">
                    <span class="flex justify-between items-center gap-2">
                        <span class="text-sm ${n.leida ? 'font-medium' : 'font-bold'}">${esc(n.titulo)}</span>
                        <span class="text-[11px] text-slate-500 shrink-0">${esc(fecha(n.created_at))}</span>
                    </span>
                    <span class="text-xs text-slate-600 dark:text-slate-300 break-words">${esc(n.mensaje)}</span>
                </button>`).join('')
            : '<p class="text-sm text-slate-500 text-center py-8">No tienes notificaciones.</p>';
        panel.innerHTML = `
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                <h3 class="font-semibold text-sm">Notificaciones</h3>
                ${sinLeer ? '<button type="button" id="notif-marcar-todas" class="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">Marcar todas como leídas</button>' : ''}
            </div>
            <div class="overflow-y-auto">${items}</div>`;
    }

    async function cargar() {
        const p = yo();
        if (!p) return;
        const { data, error } = await supabaseClient
            .from('notificaciones')
            .select('id, titulo, mensaje, leida, created_at')
            .eq('user_id', p.id)
            .order('created_at', { ascending: false })
            .limit(30);
        if (error || !data) return;
        lista = data;
        pintarInsignia();
        if (abierto()) pintarPanel();
    }

    async function marcarLeidas(ids) {
        const pendientes = ids.filter((id) => lista.some((n) => n.id === id && !n.leida));
        if (!pendientes.length) return;
        const { error } = await supabaseClient.from('notificaciones').update({ leida: true }).in('id', pendientes).eq('user_id', yo().id);
        if (!error) lista.forEach((n) => { if (pendientes.includes(n.id)) n.leida = true; });
        pintarInsignia();
        pintarPanel();
    }

    function cerrar() {
        if (!panel) return;
        panel.classList.add('hidden');
        panel.classList.remove('flex');
        const btn = document.getElementById('btn-notificaciones');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    async function abrir() {
        pintarPanel();
        panel.classList.remove('hidden');
        panel.classList.add('flex');
        const btn = document.getElementById('btn-notificaciones');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        await cargar();
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        const btn = document.getElementById('btn-notificaciones');
        if (!btn) return;
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        document.body.insertAdjacentHTML('beforeend', '<div id="panel-notificaciones" role="dialog" aria-label="Notificaciones" class="hidden fixed top-16 right-2 w-[calc(100vw-1rem)] sm:w-96 max-h-[70dvh] flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden"></div>');
        panel = document.getElementById('panel-notificaciones');

        btn.addEventListener('click', (e) => { e.stopPropagation(); if (abierto()) cerrar(); else abrir(); });
        document.addEventListener('click', (e) => { if (abierto() && !panel.contains(e.target)) cerrar(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto()) { cerrar(); btn.focus(); } });
        panel.addEventListener('click', (e) => {
            if (e.target.closest('#notif-marcar-todas')) { marcarLeidas(lista.filter((n) => !n.leida).map((n) => n.id)); return; }
            const item = e.target.closest('.notif-item');
            if (!item) return;
            const n = lista.find((x) => x.id === item.dataset.id);
            if (!n) return;
            marcarLeidas([n.id]);
            // Aviso de registro pendiente: lleva directamente a Empleados para aprobarlo.
            if (norm(n.titulo).includes('registro pendiente')) {
                cerrar();
                const nav = document.getElementById('nav-empleados');
                if (nav) nav.click();
            }
        });
    }

    function arrancar() {
        iniciar();
        cargar();
        clearInterval(temporizador);
        temporizador = setInterval(() => { if (!document.hidden) cargar(); }, REFRESCO_MS);
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden && yo() && iniciado) cargar(); });
    window.BomiNotificaciones = { arrancar, recargar: cargar };
})();
