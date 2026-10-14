// js/modules/mensajes.js
// Mensajería interna: cualquier empleado escribe (o dicta) un mensaje a uno, varios o todos los compañeros.
// Cada destinatario recibe una notificación (y un aviso push en el móvil si lo tiene activado).
// Script clásico: expone window.BomiMensajes. Depende de `supabaseClient` y `window.currentUserProfile`.
(function () {
    'use strict';

    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-full font-medium flex items-center gap-1.5';
    const LIMITE = 200;
    const MAX_TEXTO = 2000;

    let mensajes = [];
    let empleados = [];          // { id, nombre, pref }
    let iniciado = false;
    let pestana = 'recibidos';   // 'recibidos' | 'enviados'
    let busqueda = '';
    let enviando = false;
    let seleccion = new Set();
    let reconocimiento = null;
    let escuchando = false;
    let fallaTabla = false;

    const db = () => supabaseClient;
    const yo = () => window.currentUserProfile || {};
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const nombreDe = (p) => [p.nombre, p.apellido].filter((x) => x && String(x).trim()).join(' ').trim() || p.email || 'Usuario';
    const fechaHora = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const nombreId = (id) => { const e = empleados.find((x) => x.id === id); return e ? e.nombre : 'Antiguo empleado'; };
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;

    // ---------- Destinatarios ----------
    function resumenDestinos(m) {
        if (m.para_todos) return 'Todos';
        const ids = (m.destinatarios || []).filter((id) => id !== yo().id || m.remitente_id === yo().id);
        const nombres = ids.map(nombreId);
        return nombres.length > 3 ? nombres.slice(0, 3).join(', ') + ` y ${nombres.length - 3} más` : nombres.join(', ');
    }

    // ---------- Lista ----------
    const esMio = (m) => m.remitente_id === yo().id;
    function filtrar() {
        const tokens = norm(busqueda).split(' ').filter(Boolean);
        return mensajes.filter((m) => {
            if (pestana === 'enviados' ? !esMio(m) : (esMio(m) && !(m.destinatarios || []).includes(yo().id))) return false;
            if (!tokens.length) return true;
            const t = norm([m.remitente_nombre, m.texto, esMio(m) ? resumenDestinos(m) : ''].join(' '));
            return tokens.every((k) => t.includes(k));
        });
    }

    function htmlMensaje(m) {
        const mio = esMio(m);
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-2">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0">
                    <p class="font-bold text-sm break-words">${mio ? 'Para: ' + esc(resumenDestinos(m)) : esc(m.remitente_nombre)}</p>
                    <p class="text-xs text-slate-500">${esc(fechaHora(m.created_at))}${!mio && m.para_todos ? ' · A todos' : ''}${!mio && !m.para_todos && (m.destinatarios || []).length > 1 ? ' · A ' + (m.destinatarios || []).length + ' personas' : ''}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                    ${!mio ? `<button type="button" data-accion="responder" data-id="${esc(m.id)}" aria-label="Responder" title="Responder" class="${BTN_ICON}"><span class="material-symbols-outlined text-[20px]">reply</span></button>` : ''}
                    ${mio ? `<button type="button" data-accion="eliminar" data-id="${esc(m.id)}" aria-label="Eliminar mensaje" title="Eliminar mensaje" class="${BTN_DANGER}"><span class="material-symbols-outlined text-[20px]">delete</span></button>` : ''}
                </div>
            </div>
            <p class="text-sm whitespace-pre-wrap break-words">${esc(m.texto)}</p>
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('mensajes-lista');
        if (!cont) return;
        if (fallaTabla) { cont.innerHTML = aviso('La mensajería necesita una actualización de la base de datos que aún no se ha aplicado.'); return; }
        const lista = filtrar();
        if (!lista.length) { cont.innerHTML = aviso(busqueda ? 'No se encontraron resultados.' : (pestana === 'enviados' ? 'Aún no has enviado ningún mensaje. Pulsa + para escribir uno.' : 'No tienes mensajes.')); return; }
        cont.innerHTML = lista.map(htmlMensaje).join('');
    }

    function pintarPestanas() {
        document.querySelectorAll('#view-mensajes [data-pestana]').forEach((b) => {
            const act = b.dataset.pestana === pestana;
            b.className = 'flex-1 py-2 rounded-full text-sm font-medium transition-colors ' + (act ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300');
            b.setAttribute('aria-pressed', String(act));
        });
    }

    // ---------- Carga ----------
    async function cargarEmpleados() {
        let r = await db().from('perfiles').select('id, nombre, apellido, email, activo, preferencias_notificaciones');
        if (r.error) r = await db().from('perfiles').select('id, nombre, apellido, email, activo');
        if (r.error) throw r.error;
        empleados = (r.data || []).filter((p) => p.activo !== false)
            .map((p) => ({ id: p.id, nombre: nombreDe(p), pref: p.preferencias_notificaciones || null }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    }

    async function cargar() {
        const cont = document.getElementById('mensajes-lista');
        if (cont && !mensajes.length) cont.innerHTML = spinner;
        try { await cargarEmpleados(); } catch (ex) { /* se seguirá mostrando lo que haya */ }
        const { data, error } = await db().from('mensajes').select('*').order('created_at', { ascending: false }).limit(LIMITE);
        if (error) {
            fallaTabla = error.code === '42P01' || error.code === 'PGRST205' || /mensajes/.test(error.message || '');
            if (!fallaTabla && cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar los mensajes: ${esc(error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            else pintarLista();
            return;
        }
        fallaTabla = false;
        mensajes = data || [];
        pintarLista();
    }

    // ---------- Redactar ----------
    const otros = () => empleados.filter((e) => e.id !== yo().id);

    function pintarDestinatarios() {
        const cont = document.getElementById('msg-destinos');
        if (!cont) return;
        const tokens = norm(document.getElementById('msg-buscar')?.value).split(' ').filter(Boolean);
        const lista = otros().filter((e) => { const t = norm(e.nombre); return tokens.every((k) => t.includes(k)); });
        cont.innerHTML = lista.length ? lista.map((e) => `
            <label class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800">
                <input type="checkbox" data-destino="${esc(e.id)}" ${seleccion.has(e.id) ? 'checked' : ''} class="w-5 h-5 accent-blue-600 shrink-0">
                <span class="text-sm break-words">${esc(e.nombre)}</span>
            </label>`).join('') : '<p class="text-sm text-slate-500 p-3">No hay compañeros.</p>';
        const todos = document.getElementById('msg-todos');
        if (todos) todos.checked = otros().length > 0 && otros().every((e) => seleccion.has(e.id));
        const res = document.getElementById('msg-resumen');
        if (res) res.textContent = seleccion.size ? `${seleccion.size} ${seleccion.size === 1 ? 'destinatario' : 'destinatarios'}` : 'Ningún destinatario';
    }

    function soporteDictado() { return window.SpeechRecognition || window.webkitSpeechRecognition; }
    function pintarDictado() {
        const t = document.getElementById('msg-dictar-txt');
        const b = document.getElementById('msg-dictar');
        if (!t || !b) return;
        t.textContent = escuchando ? 'Parar' : 'Dictar';
        b.classList.toggle('animate-pulse', escuchando);
        const ic = b.querySelector('.material-symbols-outlined');
        if (ic) ic.textContent = escuchando ? 'stop_circle' : 'mic';
    }
    function pararDictado() {
        if (reconocimiento) { try { reconocimiento.onend = null; reconocimiento.stop(); } catch (e) { /* ya parado */ } }
        reconocimiento = null; escuchando = false; pintarDictado();
    }
    function avisoDictado(txt) {
        const p = document.getElementById('msg-dictado-aviso');
        if (!p) return;
        p.textContent = txt || '';
        p.classList.toggle('hidden', !txt);
    }
    function alternarDictado() {
        const SR = soporteDictado();
        if (!SR) { avisoDictado('Tu navegador no permite dictar por voz. Prueba con Chrome o Safari actualizados.'); return; }
        if (escuchando) { pararDictado(); return; }
        avisoDictado('');
        const rec = new SR();
        rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (ev) => {
            const area = document.getElementById('msg-texto');
            if (!area) return;
            let nuevo = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) nuevo += ev.results[i][0].transcript + ' ';
            nuevo = nuevo.trim();
            if (nuevo) area.value = (area.value.trim() ? area.value.trimEnd() + ' ' : '') + nuevo;
        };
        rec.onerror = (ev) => {
            if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') avisoDictado('No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.');
            else if (ev.error === 'no-speech') avisoDictado('No se oyó nada. Inténtalo de nuevo.');
            else if (ev.error !== 'aborted') avisoDictado('No se pudo dictar (' + ev.error + ').');
            pararDictado();
        };
        rec.onend = () => { reconocimiento = null; escuchando = false; pintarDictado(); };
        reconocimiento = rec;
        try { rec.start(); escuchando = true; pintarDictado(); } catch (e) { avisoDictado('No se pudo iniciar el micrófono.'); reconocimiento = null; }
    }

    function mostrarModal() { const m = document.getElementById('modal-mensaje'); m.classList.remove('hidden'); m.classList.add('flex'); }
    function cerrarModal() {
        pararDictado();
        const m = document.getElementById('modal-mensaje');
        if (!m) return;
        m.classList.add('hidden'); m.classList.remove('flex');
    }

    async function redactar(paraIds) {
        if (fallaTabla) { alert('La mensajería necesita una actualización de la base de datos que aún no se ha aplicado.'); return; }
        try { await cargarEmpleados(); } catch (ex) { alert('No se pudo cargar la lista de compañeros: ' + (ex.message || '')); return; }
        seleccion = new Set((paraIds || []).filter((id) => otros().some((e) => e.id === id)));
        document.getElementById('msg-texto').value = '';
        document.getElementById('msg-buscar').value = '';
        document.getElementById('msg-error').classList.add('hidden');
        avisoDictado('');
        pintarDestinatarios();
        mostrarModal();
        // style en vez de la clase hidden: el botón ya trae "flex" y ambas clases competirían.
        document.getElementById('msg-dictar').style.display = soporteDictado() ? '' : 'none';
        document.getElementById('msg-texto').focus();
    }

    const fallo = (txt) => { const e = document.getElementById('msg-error'); e.textContent = txt; e.classList.remove('hidden'); };

    async function enviar(ev) {
        ev.preventDefault();
        if (enviando) return;
        const texto = document.getElementById('msg-texto').value.trim();
        document.getElementById('msg-error').classList.add('hidden');
        if (!seleccion.size) return fallo('Elige al menos un destinatario.');
        if (!texto) return fallo('Escribe o dicta el mensaje.');
        if (texto.length > MAX_TEXTO) return fallo(`El mensaje es demasiado largo (máximo ${MAX_TEXTO} caracteres).`);
        pararDictado();
        enviando = true;
        const btn = document.getElementById('msg-enviar');
        btn.disabled = true; btn.textContent = 'Enviando...';
        try {
            const ids = otros().filter((e) => seleccion.has(e.id)).map((e) => e.id);
            const paraTodos = ids.length === otros().length;
            const quien = nombreDe(yo());
            const { data, error } = await db().from('mensajes').insert([{ remitente_id: yo().id, remitente_nombre: quien, destinatarios: ids, para_todos: paraTodos, texto }]).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('No se pudo enviar el mensaje.');
            // Un aviso por destinatario (salvo quien lo tenga desactivado en Mi Perfil).
            const filas = otros().filter((e) => ids.includes(e.id) && !(e.pref && e.pref.generales === false))
                .map((e) => ({ user_id: e.id, titulo: `Mensaje de ${quien}`, mensaje: texto.length > 180 ? texto.slice(0, 177) + '...' : texto }));
            let avisado = true;
            if (filas.length) { const r = await db().from('notificaciones').insert(filas); avisado = !r.error; }
            cerrarModal();
            pestana = 'enviados';
            pintarPestanas();
            await cargar();
            if (!avisado) alert('El mensaje se envió, pero no se pudo enviar el aviso a los destinatarios. Lo verán al abrir Mensajes.');
        } catch (ex) {
            fallo(ex && ex.code === '42P01' ? 'La mensajería necesita una actualización de la base de datos que aún no se ha aplicado.' : (ex.message || 'No se pudo enviar.'));
        } finally {
            enviando = false; btn.disabled = false; btn.textContent = 'Enviar';
        }
    }

    async function eliminar(id) {
        if (!confirm('¿Eliminar este mensaje? También desaparecerá para los destinatarios.')) return;
        try {
            const { data, error } = await db().from('mensajes').delete().eq('id', id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('No se pudo eliminar el mensaje.');
            await cargar();
        } catch (ex) { alert(ex.message || 'No se pudo eliminar.'); cargar(); }
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-mensajes').innerHTML = `
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">chat</span> Mensajes</h2>
            </div>
            <div class="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-full p-1">
                <button type="button" data-pestana="recibidos" class="flex-1 py-2 rounded-full text-sm font-medium">Recibidos</button>
                <button type="button" data-pestana="enviados" class="flex-1 py-2 rounded-full text-sm font-medium">Enviados</button>
            </div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-mensajes" aria-label="Buscar mensajes" placeholder="Buscar persona o texto..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="mensajes-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-new-mensaje" aria-label="Nuevo mensaje" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">edit</span></button>`;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-mensaje" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-mensaje-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="modal-mensaje-titulo" class="font-semibold text-lg">Nuevo mensaje</h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-mensaje" class="flex flex-col gap-4 p-6 overflow-y-auto">
                        <div class="flex flex-col gap-2">
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-medium">Para</span>
                                <span id="msg-resumen" class="text-xs text-slate-500"></span>
                            </div>
                            <label class="flex items-center gap-3 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 cursor-pointer">
                                <input type="checkbox" id="msg-todos" class="w-5 h-5 accent-blue-600 shrink-0"><span class="text-sm font-medium">Todos los empleados</span>
                            </label>
                            <input id="msg-buscar" type="text" autocomplete="off" placeholder="Buscar compañero..." aria-label="Buscar compañero" class="${INPUT}">
                            <div id="msg-destinos" class="max-h-44 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl"></div>
                        </div>
                        <div class="flex flex-col gap-1">
                            <div class="flex justify-between items-center">
                                <label for="msg-texto" class="text-xs font-medium">Mensaje</label>
                                <button type="button" id="msg-dictar" data-accion="dictar" class="${BTN_SEC} !py-1 !px-3 text-xs"><span class="material-symbols-outlined text-[16px]">mic</span> <span id="msg-dictar-txt">Dictar</span></button>
                            </div>
                            <textarea id="msg-texto" rows="5" maxlength="${MAX_TEXTO}" class="${INPUT}" placeholder="Escribe o dicta tu mensaje..."></textarea>
                            <p id="msg-dictado-aviso" class="hidden text-xs text-slate-500"></p>
                        </div>
                        <p id="msg-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
                        <div class="flex justify-end gap-3">
                            <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                            <button type="submit" id="msg-enviar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-full font-medium">Enviar</button>
                        </div>
                    </form>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        const vista = document.getElementById('view-mensajes');
        vista.addEventListener('click', (e) => {
            const p = e.target.closest('[data-pestana]');
            if (p) { pestana = p.dataset.pestana; pintarPestanas(); pintarLista(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const { accion, id } = btn.dataset;
            if (accion === 'responder') { const m = mensajes.find((x) => x.id === id); if (m) redactar([m.remitente_id]); }
            else if (accion === 'eliminar') eliminar(id);
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('fab-new-mensaje').addEventListener('click', () => redactar([]));
        document.getElementById('search-mensajes').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-mensaje');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            if (btn.dataset.accion === 'cerrar') cerrarModal();
            else if (btn.dataset.accion === 'dictar') alternarDictado();
        });
        modal.addEventListener('change', (e) => {
            const t = e.target;
            if (t.id === 'msg-todos') { otros().forEach((x) => { if (t.checked) seleccion.add(x.id); else seleccion.delete(x.id); }); pintarDestinatarios(); }
            else if (t.dataset && t.dataset.destino) { if (t.checked) seleccion.add(t.dataset.destino); else seleccion.delete(t.dataset.destino); pintarDestinatarios(); }
        });
        document.getElementById('msg-buscar').addEventListener('input', pintarDestinatarios);
        document.getElementById('form-mensaje').addEventListener('submit', enviar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('flex')) cerrarModal(); });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && iniciado && !vista.classList.contains('hidden')) cargar();
        });
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        construirVista();
        enlazarEventos();
        pintarPestanas();
    }

    window.BomiMensajes = {
        abrir() {
            iniciar();
            if (window.BomiNotificaciones) window.BomiNotificaciones.marcarMensajesLeidos();
            return cargar();
        },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
    };
})();
