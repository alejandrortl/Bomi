// js/modules/empleados.js
// Agenda de empleados (tabla `perfiles`). Script clásico: expone window.BomiEmpleados.
// Depende de `supabaseClient` (supabase-config.js) y `window.currentUserProfile` (auth.js).
(function () {
    'use strict';

    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    const ROLES = ['Operario', 'Admin', 'SuperAdmin'];
    const COLUMNAS_BASE = 'id, nombre, apellido, username, email, telefono, rol, activo';
    const TALLAS = [
        ['talla_camiseta', 'Camiseta'], ['talla_pantalon', 'Pantalón'], ['talla_zapatos', 'Zapatos'],
        ['talla_chaqueta', 'Chaqueta'], ['talla_chaleco', 'Chaleco'],
    ];
    const COLUMNAS = COLUMNAS_BASE + ', ' + TALLAS.map((t) => t[0]).join(', ');

    let empleados = [];
    let iniciado = false;
    let busqueda = '';
    let guardando = false;
    let editandoId = null;

    const db = () => supabaseClient;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const telHref = (t) => 'tel:' + String(t ?? '').replace(/[^\d+]/g, '');
    const rolDe = (p) => String(p?.rol ?? '').trim().toLowerCase();
    const yo = () => window.currentUserProfile || null;
    const esAdmin = () => ['admin', 'superadmin'].includes(rolDe(yo()));
    const esSuper = () => rolDe(yo()) === 'superadmin';
    const buscar = (id) => empleados.find((e) => e.id === id);
    const nombreCompleto = (e) => [e.nombre, e.apellido].filter((x) => x && String(x).trim()).join(' ') || e.username || e.email || 'Sin nombre';
    const pendiente = (e) => e.activo !== true;

    // Un admin puede gestionar a cualquiera salvo a un SuperAdmin; el SuperAdmin, a todos.
    const puedeGestionar = (e) => esAdmin() && (esSuper() || rolDe(e) !== 'superadmin');
    const esYo = (e) => !!yo() && e.id === yo().id;

    function mensajeError(ex) {
        if (ex && ex.code === '23503') return 'Este usuario tiene tareas u otros registros asociados.';
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }

    async function exigir(consulta, mensajeSinFilas) {
        const { data, error } = await consulta;
        if (error) throw error;
        if (mensajeSinFilas && (!data || !data.length)) throw new Error(mensajeSinFilas);
        return data;
    }

    // ---------- Búsqueda: nombre, apellido o rol ----------
    function filtrar() {
        const tokens = norm(busqueda).split(/\s+/).filter(Boolean);
        // Los usuarios sin aprobar solo los ve quien puede aprobarlos.
        let lista = esAdmin() ? empleados : empleados.filter((e) => !pendiente(e));
        if (tokens.length) {
            lista = lista.filter((e) => {
                const t = norm([e.nombre, e.apellido, e.rol].join(' '));
                return tokens.every((k) => t.includes(k));
            });
        }
        return lista;
    }

    // ---------- Pintado ----------
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;

    const claseRol = (e) => {
        const r = rolDe(e);
        if (r === 'superadmin') return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200';
        if (r === 'admin') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
        return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-300';
    };

    const btnAccion = (accion, id, icono, etiqueta, clase = BTN_ICON) =>
        `<button type="button" data-accion="${accion}" data-id="${esc(id)}" aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}" class="${clase}"><span class="material-symbols-outlined text-[20px]">${icono}</span></button>`;

    function htmlEmpleado(e) {
        const gestionable = puedeGestionar(e);
        const pend = pendiente(e);
        const tel = e.telefono ? `<a href="${esc(telHref(e.telefono))}" class="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"><span class="material-symbols-outlined text-[18px]">call</span>${esc(e.telefono)}</a>` : '';
        const mail = e.email ? `<a href="mailto:${esc(e.email)}" class="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline min-w-0"><span class="material-symbols-outlined text-[18px]">mail</span><span class="truncate">${esc(e.email)}</span></a>` : '';
        const acciones = [];
        if (esAdmin() && pend && gestionable) acciones.push(`<button type="button" data-accion="aceptar" data-id="${esc(e.id)}" class="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-3 py-1.5 rounded-full font-medium">Aceptar</button>`);
        acciones.push(btnAccion('tallas', e.id, 'checkroom', 'Ver tallas'));
        if (gestionable) acciones.push(btnAccion('editar', e.id, 'edit', 'Editar empleado'));
        if (gestionable && !esYo(e)) acciones.push(btnAccion('eliminar', e.id, 'delete', pend ? 'Rechazar y eliminar' : 'Eliminar empleado', BTN_DANGER));
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <h3 class="font-bold text-base break-words">${esc(nombreCompleto(e))}${esYo(e) ? ' <span class="text-xs font-normal text-slate-400">(tú)</span>' : ''}</h3>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-xs px-2.5 py-0.5 rounded-full font-medium ${claseRol(e)}">${esc(e.rol || 'Sin rol')}</span>
                        ${pend ? '<span class="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Pendiente de aprobar</span>' : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">${acciones.join('')}</div>
            </div>
            ${(tel || mail) ? `<div class="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">${tel}${mail}</div>` : ''}
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('empleados-container');
        const badge = document.getElementById('empleados-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'empleado' : 'empleados'}`;
        if (!empleados.length) { cont.innerHTML = aviso('Aún no hay empleados.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map(htmlEmpleado).join('');
    }

    // ---------- Carga ----------
    async function cargar() {
        const cont = document.getElementById('empleados-container');
        if (cont && !empleados.length) cont.innerHTML = spinner;
        let { data, error } = await db().from('perfiles').select(COLUMNAS);
        if (error) ({ data, error } = await db().from('perfiles').select(COLUMNAS_BASE)); // si aún no existen las columnas de tallas
        if (error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar empleados: ${esc(error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        empleados = (data || []).sort((a, b) =>
            (pendiente(b) - pendiente(a)) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es', { sensitivity: 'base' }));
        pintarLista();
    }

    function avisarCambios() {
        window.dispatchEvent(new CustomEvent('empleadosActualizados'));
    }

    // ---------- Edición ----------
    function abrirEditor(id) {
        const e = buscar(id);
        if (!e || !puedeGestionar(e)) return;
        editandoId = id;
        const puedeRol = esSuper() && !esYo(e);
        document.getElementById('empleados-modal-titulo').textContent = 'Editar empleado';
        document.getElementById('form-empleados').innerHTML = `
            <div class="flex flex-col gap-1"><label for="emp-nombre" class="text-xs font-medium">Nombre</label><input id="emp-nombre" type="text" required autocomplete="off" value="${esc(e.nombre)}" class="${INPUT}"></div>
            <div class="flex flex-col gap-1"><label for="emp-apellido" class="text-xs font-medium">Apellido</label><input id="emp-apellido" type="text" autocomplete="off" value="${esc(e.apellido)}" class="${INPUT}"></div>
            <div class="flex flex-col gap-1"><label for="emp-telefono" class="text-xs font-medium">Teléfono</label><input id="emp-telefono" type="tel" inputmode="tel" maxlength="15" value="${esc(e.telefono)}" class="${INPUT}"></div>
            <div class="flex flex-col gap-1"><label class="text-xs font-medium">Correo</label><p class="text-sm text-slate-500 px-1">${esc(e.email || '—')}</p></div>
            <div class="flex flex-col gap-1">
                <label for="emp-rol" class="text-xs font-medium">Rol</label>
                <select id="emp-rol" ${puedeRol ? '' : 'disabled'} class="${INPUT} disabled:opacity-60">${ROLES.map((r) => `<option value="${r}" ${r === e.rol ? 'selected' : ''}>${r}</option>`).join('')}</select>
                ${puedeRol ? '' : '<p class="text-xs text-slate-500">Solo un SuperAdmin puede cambiar el rol de otra persona.</p>'}
            </div>
            <p id="emp-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex justify-end gap-3">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="emp-guardar" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium">Guardar</button>
            </div>`;
        const modal = document.getElementById('modal-empleados');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('emp-nombre').focus();
    }

    // ---------- Tallas ----------
    let viendoTallas = false;
    function abrirTallas(id) {
        const e = buscar(id);
        if (!e) return;
        viendoTallas = true;
        editandoId = null;
        document.getElementById('empleados-modal-titulo').textContent = 'Tallas de ' + nombreCompleto(e);
        const algunaTalla = TALLAS.some(([k]) => String(e[k] ?? '').trim());
        document.getElementById('form-empleados').innerHTML = `
            <div class="border border-slate-200 dark:border-zinc-800 rounded-xl divide-y divide-slate-200 dark:divide-zinc-800">
                ${TALLAS.map(([k, et]) => `<div class="flex justify-between items-center gap-3 px-4 py-3"><span class="text-sm font-medium">${esc(et)}</span><span class="text-sm ${String(e[k] ?? '').trim() ? 'font-semibold' : 'text-slate-400'}" data-talla="${k}">${esc(String(e[k] ?? '').trim() || 'Sin indicar')}</span></div>`).join('')}
            </div>
            ${algunaTalla ? '' : '<p class="text-xs text-slate-500">Todavía no ha indicado sus tallas. Cada persona las escribe en su perfil.</p>'}
            <div class="flex justify-end"><button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cerrar</button></div>`;
        const modal = document.getElementById('modal-empleados');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function cerrarEditor() {
        const modal = document.getElementById('modal-empleados');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        editandoId = null;
        viendoTallas = false;
    }

    async function guardar(ev) {
        ev.preventDefault();
        if (guardando || !editandoId) return;
        const e = buscar(editandoId);
        if (!e || !puedeGestionar(e)) return;
        const err = document.getElementById('emp-error');
        const btn = document.getElementById('emp-guardar');
        const nombre = document.getElementById('emp-nombre').value.trim();
        const cambios = {
            nombre,
            apellido: document.getElementById('emp-apellido').value.trim(),
            telefono: document.getElementById('emp-telefono').value.trim(),
        };
        // El rol solo lo cambia un SuperAdmin, y nunca el suyo propio.
        if (esSuper() && !esYo(e)) {
            const rol = document.getElementById('emp-rol').value;
            if (ROLES.includes(rol)) cambios.rol = rol;
        }
        err.classList.add('hidden');
        if (!nombre) { err.textContent = 'El nombre es obligatorio.'; err.classList.remove('hidden'); return; }
        guardando = true;
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            await exigir(db().from('perfiles').update(cambios).eq('id', editandoId).select('id'), 'No se pudo guardar: no tienes permiso o el empleado ya no existe.');
            if (esYo(e) && yo()) Object.assign(yo(), cambios);
            cerrarEditor();
            await cargar();
            avisarCambios();
        } catch (ex) {
            err.textContent = mensajeError(ex);
            err.classList.remove('hidden');
        } finally {
            guardando = false;
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    // ---------- Aceptar / eliminar ----------
    async function aceptar(id) {
        const e = buscar(id);
        if (!e || !puedeGestionar(e)) return;
        try {
            await exigir(db().from('perfiles').update({ activo: true }).eq('id', id).select('id'), 'No tienes permiso para aceptar usuarios.');
            await cargar();
            avisarCambios();
        } catch (ex) {
            alert('No se pudo aceptar: ' + mensajeError(ex));
            cargar();
        }
    }

    async function eliminar(id) {
        const e = buscar(id);
        if (!e || !puedeGestionar(e) || esYo(e)) return;
        const msg = pendiente(e)
            ? `¿Rechazar la solicitud de «${nombreCompleto(e)}»? Se eliminará su perfil.`
            : `¿Eliminar a «${nombreCompleto(e)}»? Dejará de poder entrar en la aplicación. Esta acción no se puede deshacer.`;
        if (!confirm(msg)) return;
        try {
            await exigir(db().from('perfiles').delete().eq('id', id).select('id'), 'No tienes permiso para eliminar empleados.');
            await cargar();
            avisarCambios();
        } catch (ex) {
            alert('No se pudo eliminar: ' + mensajeError(ex));
            cargar();
        }
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-empleados').innerHTML = `
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">group</span> Empleados</h2>
                <span id="empleados-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span>
            </div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-empleados" aria-label="Buscar empleados" placeholder="Buscar empleado..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="empleados-container" class="flex flex-col gap-3 pb-6"></div>`;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-empleados" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="empleados-modal-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="empleados-modal-titulo" class="font-semibold text-lg"></h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-empleados" class="flex flex-col gap-4 p-6 overflow-y-auto"></form>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        document.getElementById('view-empleados').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const { accion, id } = btn.dataset;
            if (accion === 'tallas') abrirTallas(id);
            else if (accion === 'editar') abrirEditor(id);
            else if (accion === 'aceptar') aceptar(id);
            else if (accion === 'eliminar') eliminar(id);
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('search-empleados').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });
        const modal = document.getElementById('modal-empleados');
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-accion="cerrar"]')) cerrarEditor();
        });
        document.getElementById('form-empleados').addEventListener('submit', guardar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (editandoId || viendoTallas)) cerrarEditor(); });
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        construirVista();
        enlazarEventos();
    }

    window.BomiEmpleados = {
        abrir() { iniciar(); return cargar(); },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
    };
})();
