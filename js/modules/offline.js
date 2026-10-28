// js/modules/offline.js — guardado sin conexión.
// Script clásico: expone window.BomiOffline.
//
// Idea: un registro NUEVO (parte, solicitud de material, bitácora, tarea del Diario) se describe como una lista de
// pasos ordenados (subir imagen, insertar filas...). Cada paso es idempotente: las filas llevan un id creado en el móvil
// y se insertan con "ignorar duplicados", de modo que repetir un paso no duplica nada aunque la respuesta se perdiera.
//  - Con conexión: se ejecutan los pasos al momento. Si falla por un error que no es de red, se deshace lo insertado.
//  - Sin conexión (o conexión que se corta): el trabajo se guarda en el móvil (IndexedDB) y se envía solo al volver la señal.
//  - Si no se puede enviar, se avisa y se puede descargar en PDF.
(function () {
    'use strict';
    const BD = 'bomi-offline', ALMACEN = 'pendientes';
    const cliente = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ganchos = {};
    let sincronizando = false;
    let temporizador = null;

    // ---------- Utilidades ----------
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        const b = new Uint8Array(16);
        (window.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
        const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    // ¿Es un fallo de conexión (sin señal, señal muy débil, petición cortada)?
    function esRed(ex) {
        if (!ex) return false;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
        if (ex.name === 'AbortError' || ex.name === 'TimeoutError' || ex.status === 0) return true;
        const m = [ex.message, ex.details, ex.hint, ex.error_description, ex.name, typeof ex === 'string' ? ex : ''].filter(Boolean).join(' ');
        return /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timed? ?out|aborted|offline|sin conexi/i.test(m) || /\bERR_[A-Z_]+/.test(m);
    }
    const esSesion = (ex) => !!ex && (ex.code === 'PGRST301' || /jwt (expired|invalid)|invalid jwt|token.*expired|not authenticated/i.test(ex.message || ''));

    const MENSAJE_RED = 'Sin conexión o con la señal muy débil.';
    function mensaje(ex) {
        if (esRed(ex)) return MENSAJE_RED;
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }
    const usuarioId = () => (window.currentUserProfile && window.currentUserProfile.id) || null;

    // ---------- Almacén local (IndexedDB; si no hay, solo memoria) ----------
    const memoria = new Map();
    let conexionBd = null;
    function abrirBd() {
        if (conexionBd) return conexionBd;
        conexionBd = new Promise((ok, ko) => {
            try {
                const r = indexedDB.open(BD, 1);
                r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN, { keyPath: 'id' }); };
                r.onsuccess = () => ok(r.result);
                r.onerror = () => ko(r.error);
                r.onblocked = () => ko(new Error('IndexedDB bloqueado'));
            } catch (e) { ko(e); }
        }).catch(() => null);
        return conexionBd;
    }
    async function operar(modo, fn) {
        const bd = await abrirBd();
        if (!bd) return null;
        return new Promise((ok, ko) => {
            try {
                const t = bd.transaction(ALMACEN, modo);
                const req = fn(t.objectStore(ALMACEN));
                t.oncomplete = () => ok(req ? req.result : undefined);
                t.onerror = () => ko(t.error);
                t.onabort = () => ko(t.error || new Error('Operación cancelada'));
            } catch (e) { ko(e); }
        });
    }
    const almacen = {
        async listar() {
            try { const r = await operar('readonly', (s) => s.getAll()); if (r) return r; } catch (e) { /* memoria */ }
            return Array.from(memoria.values());
        },
        async guardar(job) {
            memoria.set(job.id, job);
            try { await operar('readwrite', (s) => s.put(job)); } catch (e) { /* queda en memoria */ }
        },
        async quitar(id) {
            memoria.delete(id);
            try { await operar('readwrite', (s) => s.delete(id)); } catch (e) { /* sin más */ }
        },
    };

    // ---------- Ejecución de pasos ----------
    async function correrPaso(p) {
        const sb = cliente();
        if (p.k === 'subida') {
            const { error } = await sb.storage.from(p.bucket).upload(p.ruta, p.blob, { contentType: p.tipo || 'image/png', upsert: false });
            // Si ya se había subido en un intento anterior, no es un fallo.
            if (error && !/already exists|duplicate/i.test(error.message || '') && String(error.statusCode) !== '409') throw error;
        } else if (p.k === 'insert') {
            if (!p.filas || !p.filas.length) return;
            const { error } = await sb.from(p.tabla).upsert(p.filas, { onConflict: 'id', ignoreDuplicates: true });
            if (error) throw error;
        } else if (p.k === 'funcion') {
            // Llamada a una Edge Function (p. ej. subir una foto). Un fallo de conexión deja el trabajo pendiente.
            const { data, error } = await sb.functions.invoke(p.nombre, { body: p.cuerpo, headers: p.cabeceras || {} });
            if (error) {
                if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') { const e = new Error('Failed to fetch'); e.name = 'TypeError'; throw e; }
                if (error.context && error.context.status === 401) { const e = new Error('JWT expired'); e.code = 'PGRST301'; throw e; }
                let msg = error.message;
                try { const d = await error.context.json(); if (d && d.error) msg = d.error; } catch (e) { /* sin detalle */ }
                throw new Error(msg);
            }
            if (data && data.error) throw new Error(data.error);
        } else if (p.k === 'gancho') {
            const f = ganchos[p.nombre];
            if (!f) return;
            try { await f(p.datos); } catch (ex) { if (esRed(ex)) throw ex; /* un aviso que falla no invalida el registro */ }
        }
    }

    // Deshace (en orden inverso) lo insertado por los pasos ya hechos. Solo para errores que no son de red.
    async function deshacer(job) {
        const sb = cliente();
        for (let i = Math.min(job.hecho, job.pasos.length) - 1; i >= 0; i--) {
            const p = job.pasos[i];
            if (p.k === 'insert' && p.deshacer && p.filas && p.filas.length) {
                try { await sb.from(p.tabla).delete().in('id', p.filas.map((f) => f.id)); } catch (e) { /* sin más */ }
            }
        }
        job.hecho = 0;
    }

    async function ejecutar(job, opciones) {
        const o = opciones || {};
        try {
            for (let i = job.hecho || 0; i < job.pasos.length; i++) {
                await correrPaso(job.pasos[i]);
                job.hecho = i + 1;
                if (o.persistir) await almacen.guardar(job);
            }
        } catch (ex) {
            if (!esRed(ex) && !esSesion(ex)) await deshacer(job);
            throw ex;
        }
    }

    // Ejecuta una lista de pasos sueltos (sin cola): para ediciones, que no se guardan sin conexión.
    async function correr(pasos) {
        const job = { pasos, hecho: 0 };
        await ejecutar(job);
    }

    // ---------- API principal ----------
    // job: { tipo, etiqueta, pasos[], pdf: { items, nombre }, clientes: bool }
    // Devuelve { estado: 'enviado' | 'pendiente' }. Lanza el error si no es de conexión.
    async function guardar(job) {
        job.id = job.id || uuid();
        job.creado = new Date().toISOString();
        job.uid = usuarioId();
        job.hecho = 0; job.error = null;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return encolar(job);
        try {
            await ejecutar(job);
            return { estado: 'enviado' };
        } catch (ex) {
            if (esRed(ex) || esSesion(ex)) return encolar(job);
            throw ex;
        }
    }

    async function encolar(job) {
        await almacen.guardar(job);
        await pintar();
        programar();
        toast('Sin conexión: guardado en este móvil. Se enviará solo cuando vuelva la señal.', 'aviso');
        return { estado: 'pendiente' };
    }

    function registrarGancho(nombre, fn) { ganchos[nombre] = fn; }

    // ---------- Reenvío ----------
    async function sincronizar(manual) {
        if (sincronizando) return;
        const uid = usuarioId();
        if (!uid) return;
        sincronizando = true;
        const enviados = [];
        try {
            const lista = (await almacen.listar()).filter((j) => j.uid === uid).sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
            if (!lista.length) return;
            if (manual && typeof navigator !== 'undefined' && navigator.onLine === false) { toast('Sigues sin conexión.', 'aviso'); return; }
            // Sesión caducada mientras no había red: se renueva antes de enviar.
            try { await cliente().auth.getSession(); } catch (e) { /* se intenta igualmente */ }
            for (const j of lista) {
                if (j.error && !manual) continue;       // los que fallaron de verdad solo se reintentan a mano
                j.error = null;
                try {
                    await ejecutar(j, { persistir: true });
                    await almacen.quitar(j.id);
                    enviados.push(j);
                } catch (ex) {
                    if (esRed(ex) || esSesion(ex)) { if (manual) toast(esSesion(ex) ? 'La sesión ha caducado: cierra sesión y vuelve a entrar.' : 'Todavía no hay buena conexión.', 'aviso'); await almacen.guardar(j); break; }
                    j.error = mensaje(ex);
                    await almacen.guardar(j);
                }
            }
        } finally {
            sincronizando = false;
            await pintar();
            if (enviados.length) {
                toast(enviados.length === 1 ? 'Se ha enviado el registro pendiente.' : `Se han enviado ${enviados.length} registros pendientes.`, 'ok');
                if (enviados.some((j) => j.clientes)) window.dispatchEvent(new CustomEvent('clientesActualizados'));
                window.dispatchEvent(new CustomEvent('bomiSincronizado', { detail: { tipos: enviados.map((j) => j.tipo) } }));
            }
            programar();
        }
    }

    // Mientras haya pendientes se reintenta cada 30 s (además de al volver la red o abrir la app).
    async function programar() {
        clearTimeout(temporizador);
        const hay = (await almacen.listar()).some((j) => j.uid === usuarioId() && !j.error);
        if (hay) temporizador = setTimeout(() => sincronizar(false), 30000);
    }

    // ---------- Avisos en pantalla ----------
    function toast(texto, tipo) {
        let t = document.getElementById('bomi-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'bomi-toast';
            t.setAttribute('role', 'status');
            document.body.appendChild(t);
        }
        const color = tipo === 'ok' ? 'bg-emerald-700' : tipo === 'error' ? 'bg-red-700' : 'bg-slate-800';
        t.className = `fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] max-w-[90vw] sm:max-w-md text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-2xl ${color}`;
        t.textContent = texto;
        clearTimeout(t._t);
        t._t = setTimeout(() => { t.className = 'hidden'; }, 7000);
    }

    // Texto de error en un formulario + botón para guardar lo escrito en PDF.
    // pdfFn() devuelve { items, nombre } con lo que hay escrito en ese momento.
    function falloConPdf(el, ex, pdfFn, extra) {
        if (!el) return;
        el.textContent = (extra ? extra + ' ' : '') + mensaje(ex);
        el.classList.remove('hidden');
        if (typeof pdfFn !== 'function') return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mt-2 flex items-center gap-1 text-sm font-semibold underline';
        b.innerHTML = '<span class="material-symbols-outlined text-[16px]">picture_as_pdf</span> Guardar en PDF';
        b.addEventListener('click', async () => {
            try { const r = pdfFn(); await window.BomiPdf.generar(r.items, r.nombre); }
            catch (e) { alert('No se pudo crear el PDF: ' + mensaje(e)); }
        });
        el.appendChild(document.createElement('br'));
        el.appendChild(b);
    }

    // ---------- Banner y panel de pendientes ----------
    function asegurarBanner() {
        let b = document.getElementById('banner-pendientes');
        if (b) return b;
        b = document.createElement('div');
        b.id = 'banner-pendientes';
        b.className = 'hidden';
        const cab = document.getElementById('app-header');
        if (cab && cab.parentNode) cab.insertAdjacentElement('afterend', b); else document.body.prepend(b);
        b.addEventListener('click', (e) => {
            const a = e.target.closest('[data-bp]');
            if (!a) return;
            if (a.dataset.bp === 'ver') abrirPanel();
            else if (a.dataset.bp === 'reintentar') sincronizar(true);
        });
        return b;
    }

    async function pintar() {
        const b = asegurarBanner();
        const uid = usuarioId();
        const lista = uid ? (await almacen.listar()).filter((j) => j.uid === uid) : [];
        if (!lista.length) { b.className = 'hidden'; b.innerHTML = ''; refrescarPanel(lista); return; }
        const fallidos = lista.filter((j) => j.error).length;
        const rojo = fallidos > 0;
        const texto = rojo
            ? `${fallidos === 1 ? '1 registro no se ha podido enviar' : fallidos + ' registros no se han podido enviar'}. Puedes guardarlo en PDF.`
            : `${lista.length === 1 ? '1 registro pendiente' : lista.length + ' registros pendientes'} de enviar. Se enviará solo cuando haya conexión.`;
        b.className = `shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs font-medium z-20 border-b ${rojo ? 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900' : 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900'}`;
        b.innerHTML = `<span class="material-symbols-outlined text-[18px]">${rojo ? 'error' : 'cloud_off'}</span>
            <span class="flex-1 min-w-[10rem]">${esc(texto)}</span>
            <button type="button" data-bp="ver" class="underline font-semibold">Ver</button>
            <button type="button" data-bp="reintentar" class="underline font-semibold">Reintentar</button>`;
        refrescarPanel(lista);
    }

    function fechaCorta(iso) {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function htmlPanel(lista) {
        const filas = lista.length ? lista.map((j) => `
            <li class="border border-slate-200 dark:border-zinc-700 rounded-2xl p-3 flex flex-col gap-2">
                <div>
                    <p class="font-semibold text-sm break-words">${esc(j.etiqueta || j.tipo)}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Guardado el ${esc(fechaCorta(j.creado))}</p>
                    <p class="text-xs mt-1 ${j.error ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'}">${j.error ? 'No se pudo enviar: ' + esc(j.error) : 'Esperando conexión para enviarse.'}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${j.pdf ? `<button type="button" data-bp="pdf" data-id="${esc(j.id)}" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">picture_as_pdf</span> Guardar en PDF</button>` : ''}
                    <button type="button" data-bp="borrar" data-id="${esc(j.id)}" class="text-xs bg-slate-200 dark:bg-zinc-800 px-3 py-1.5 rounded-full font-medium">Descartar</button>
                </div>
            </li>`).join('') : '<li class="text-sm text-slate-500 text-center py-4">No hay nada pendiente.</li>';
        return `<div class="bg-white dark:bg-zinc-900 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
            <div class="flex justify-between items-center"><h3 class="font-semibold text-lg">Pendientes de enviar</h3>
                <button type="button" data-bp="cerrar" aria-label="Cerrar" class="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800"><span class="material-symbols-outlined">close</span></button></div>
            <ul class="flex flex-col gap-2">${filas}</ul>
            <div class="flex justify-end gap-2 pt-1">
                <button type="button" data-bp="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cerrar</button>
                <button type="button" data-bp="reintentar-panel" class="bg-blue-600 text-white px-5 py-2 rounded-full font-medium text-sm">Reintentar ahora</button>
            </div></div>`;
    }

    function refrescarPanel(lista) {
        const p = document.getElementById('modal-pendientes');
        if (p && !p.classList.contains('hidden')) p.innerHTML = htmlPanel(lista);
    }

    async function abrirPanel() {
        let p = document.getElementById('modal-pendientes');
        if (!p) {
            p = document.createElement('div');
            p.id = 'modal-pendientes';
            p.className = 'hidden';
            document.body.appendChild(p);
            p.addEventListener('click', async (e) => {
                if (e.target === p) { cerrarPanel(); return; }
                const a = e.target.closest('[data-bp]');
                if (!a) return;
                const k = a.dataset.bp;
                if (k === 'cerrar') cerrarPanel();
                else if (k === 'reintentar-panel') sincronizar(true);
                else if (k === 'pdf') {
                    const j = (await almacen.listar()).find((x) => x.id === a.dataset.id);
                    if (!j || !j.pdf) return;
                    try { await window.BomiPdf.generar(j.pdf.items, j.pdf.nombre); }
                    catch (ex) { alert('No se pudo crear el PDF: ' + mensaje(ex)); }
                } else if (k === 'borrar') {
                    if (!confirm('¿Descartar este registro pendiente?\n\nSe perderá si no lo has guardado en PDF.')) return;
                    await almacen.quitar(a.dataset.id);
                    await pintar();
                }
            });
        }
        const uid = usuarioId();
        const lista = (await almacen.listar()).filter((j) => j.uid === uid);
        p.innerHTML = htmlPanel(lista);
        p.className = 'fixed inset-0 z-[70] flex justify-center items-center p-4 bg-black/50 backdrop-blur-sm';
    }
    function cerrarPanel() { const p = document.getElementById('modal-pendientes'); if (p) p.className = 'hidden'; }

    // ---------- Arranque ----------
    function iniciar() {
        window.addEventListener('online', () => sincronizar(false));
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pintar(); sincronizar(false); } });
        try {
            cliente().auth.onAuthStateChange((evento, sesion) => {
                if (evento === 'SIGNED_OUT') { const b = document.getElementById('banner-pendientes'); if (b) b.className = 'hidden'; return; }
                if (sesion) setTimeout(() => { pintar(); sincronizar(false); }, 1500);   // deja que se cargue el perfil
            });
        } catch (e) { /* sin auth no hay pendientes que enviar */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

    window.BomiOffline = { uuid, esRed, mensaje, guardar, correr, registrarGancho, sincronizar, falloConPdf, toast, pendientes: () => almacen.listar() };
})();
