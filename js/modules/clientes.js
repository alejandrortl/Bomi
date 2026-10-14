// js/modules/clientes.js
// Agenda de clientes y obras.
// Script clásico (sin módulos ES): expone window.BomiClientes.
// Depende de las globales `supabaseClient` (supabase-config.js) y
// `window.currentUserProfile` (auth.js).
(function () {
    'use strict';

    const INPUT_BASE = 'bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const INPUT = 'w-full ' + INPUT_BASE;
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    // Tablas con claves foráneas hacia clientes/obras: si hay filas, no se puede borrar.
    const TABLAS_CON_REFERENCIAS = ['bitacora', 'partes', 'diario', 'solicitudes_material'];

    let clientes = [];
    let iniciado = false;
    let busqueda = '';
    let guardando = false;
    let modalEstado = null;

    // ---------- Utilidades ----------
    const db = () => supabaseClient;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const telHref = (t) => 'tel:' + String(t ?? '').replace(/[^\d+]/g, '');
    const mapsHref = (dir, loc) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dir, loc].filter(Boolean).join(', '));
    const val = (id) => (document.getElementById(id)?.value ?? '').trim();
    const esAdmin = () => {
        const r = String(window.currentUserProfile?.rol ?? '').trim().toLowerCase();
        return r === 'admin' || r === 'superadmin';
    };
    const nombreCliente = (c) => String(c.nombre_cliente || c.nombre || '').trim() || 'Sin nombre';
    const buscarCliente = (id) => clientes.find((c) => c.id === id);
    const buscarClientePorNombre = (n) => {
        const k = norm(n);
        return k ? clientes.find((c) => norm(nombreCliente(c)) === k) : undefined;
    };

    function mensajeError(ex) {
        if (ex && ex.code === '23503') return 'Hay registros que dependen de este elemento.';
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }

    // Ejecuta una consulta de Supabase y lanza si falla o (opcional) si no afectó a ninguna fila.
    // Con RLS, un UPDATE/DELETE sin permiso no da error: simplemente no toca filas.
    async function exigir(consulta, mensajeSinFilas) {
        const { data, error } = await consulta;
        if (error) throw error;
        if (mensajeSinFilas && (!data || !data.length)) throw new Error(mensajeSinFilas);
        return data;
    }

    // ---------- Contactos ----------
    const contactosCliente = (c) => (c.contactos_clientes || []).map((k) => ({ id: k.id, nombre: k.nombre || '', telefono: k.telefono || '' }));
    function contactosObra(o) {
        const lista = (o.contactos_obras || []).map((k) => ({ id: k.id, nombre: k.nombre || '', telefono: k.telefono || '' }));
        // Datos antiguos: contacto guardado directamente en la fila de la obra.
        if (!lista.length && (o.contacto_nombre || o.contacto_telefono)) {
            return [{ id: null, nombre: o.contacto_nombre || '', telefono: o.contacto_telefono || '' }];
        }
        return lista;
    }

    // ---------- Búsqueda ----------
    const textoCliente = (c) => [nombreCliente(c), ...contactosCliente(c).flatMap((k) => [k.nombre, k.telefono])].join(' ');
    const textoObra = (o) => [o.nombre, o.direccion, o.localidad, ...contactosObra(o).flatMap((k) => [k.nombre, k.telefono])].join(' ');
    const coincide = (texto, tokens) => { const t = norm(texto); return tokens.every((k) => t.includes(k)); };

    function filtrar() {
        const tokens = norm(busqueda).split(/\s+/).filter(Boolean);
        if (!tokens.length) return clientes.map((c) => ({ c, obras: c.obras || [] }));
        const salida = [];
        for (const c of clientes) {
            const tc = textoCliente(c);
            if (coincide(tc, tokens)) { salida.push({ c, obras: c.obras || [] }); continue; }
            const obras = (c.obras || []).filter((o) => coincide(tc + ' ' + textoObra(o), tokens));
            if (obras.length) salida.push({ c, obras });
        }
        return salida;
    }

    // ---------- Pintado de la lista ----------
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;

    const btnAccion = (accion, id, icono, etiqueta, extra = '', clase = BTN_ICON) =>
        `<button type="button" data-accion="${accion}" data-id="${esc(id)}" ${extra} aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}" class="${clase}"><span class="material-symbols-outlined text-[20px]">${icono}</span></button>`;

    function direccionHtml(dir, loc) {
        const txt = [dir, loc].filter(Boolean).join(', ');
        if (!txt) return '';
        return `<a href="${esc(mapsHref(dir, loc))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-start gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"><span class="material-symbols-outlined text-[16px] mt-0.5">location_on</span><span>${esc(txt)}</span></a>`;
    }

    function contactosHtml(lista) {
        if (!lista.length) return '';
        return '<ul class="flex flex-col gap-1">' + lista.map((k) => `
            <li class="flex items-center gap-2 text-sm">
                <span class="material-symbols-outlined text-[16px] text-slate-400">call</span>
                ${k.nombre ? `<span class="text-slate-600 dark:text-slate-300">${esc(k.nombre)}</span>` : ''}
                ${k.telefono ? `<a href="${esc(telHref(k.telefono))}" class="text-blue-600 dark:text-blue-400 font-medium hover:underline">${esc(k.telefono)}</a>` : ''}
            </li>`).join('') + '</ul>';
    }

    function htmlObra(c, o) {
        const admin = esAdmin();
        const extra = `data-cliente="${esc(c.id)}"`;
        return `
        <div class="bg-slate-50 dark:bg-zinc-800 rounded-xl p-3 flex flex-col gap-2">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <h4 class="font-semibold text-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(o.nombre)}</span></h4>
                    ${direccionHtml(o.direccion, o.localidad)}
                </div>
                <div class="flex gap-1 shrink-0">
                    ${btnAccion('editar-obra', o.id, 'edit', 'Editar obra', extra)}
                    ${admin ? btnAccion('eliminar-obra', o.id, 'delete', 'Eliminar obra', extra, BTN_DANGER) : ''}
                </div>
            </div>
            ${contactosHtml(contactosObra(o))}
        </div>`;
    }

    function htmlCliente(c, obras) {
        const admin = esAdmin();
        const total = (c.obras || []).length;
        const contador = obras.length === total ? `${total}` : `${obras.length} de ${total}`;
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <h3 class="font-bold text-base break-words">${esc(nombreCliente(c))}</h3>
                </div>
                <div class="flex gap-1 shrink-0">
                    ${btnAccion('editar-cliente', c.id, 'edit', 'Editar cliente')}
                    ${admin ? btnAccion('eliminar-cliente', c.id, 'delete', 'Eliminar cliente', '', BTN_DANGER) : ''}
                </div>
            </div>
            ${contactosHtml(contactosCliente(c))}
            <div class="flex flex-col gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Obras (${contador})</span>
                    <button type="button" data-accion="nueva-obra" data-id="${esc(c.id)}" class="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline"><span class="material-symbols-outlined text-[16px]">add</span> Añadir obra</button>
                </div>
                ${obras.length ? obras.map((o) => htmlObra(c, o)).join('') : '<p class="text-xs text-slate-400">Sin obras todavía.</p>'}
            </div>
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('clientes-lista');
        const badge = document.getElementById('clientes-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}`;
        if (!clientes.length) { cont.innerHTML = aviso('Aún no hay clientes. Pulsa + para añadir el primero.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map(({ c, obras }) => htmlCliente(c, obras)).join('');
    }

    function actualizarDatalist() {
        const dl = document.getElementById('clientes-modal-datalist');
        if (dl) dl.innerHTML = clientes.map((c) => `<option value="${esc(nombreCliente(c))}"></option>`).join('');
    }

    // ---------- Carga ----------
    async function cargar() {
        const cont = document.getElementById('clientes-lista');
        if (cont && !clientes.length) cont.innerHTML = spinner;
        const { data, error } = await db().from('clientes').select(`
            id, nombre, nombre_cliente,
            contactos_clientes ( id, nombre, telefono ),
            obras ( id, nombre, direccion, localidad, contacto_nombre, contacto_telefono,
                    contactos_obras ( id, nombre, telefono ) )
        `);
        if (error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar clientes: ${esc(error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        clientes = (data || []).sort((a, b) => nombreCliente(a).localeCompare(nombreCliente(b), 'es', { sensitivity: 'base' }));
        clientes.forEach((c) => (c.obras || []).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' })));
        pintarLista();
        actualizarDatalist();
    }

    function avisarCambios() {
        // La pantalla de tareas mantiene sus propias listas de autocompletado.
        window.dispatchEvent(new CustomEvent('clientesActualizados'));
    }

    // ---------- Formulario ----------
    // Móvil: el nombre ocupa su línea y debajo van teléfono y "quitar". Pantalla ancha: todo en una línea.
    // Estos campos usan INPUT_BASE (sin w-full): el ancho lo fijan solo las clases de aquí.
    // El teléfono mide w-40 (10 rem), suficiente para 15 caracteres (maxlength).
    const filaContacto = (k = {}) => `
        <div class="contacto-fila flex flex-wrap items-center gap-2" data-id="${esc(k.id || '')}">
            <input type="text" class="k-nombre w-full sm:w-auto sm:flex-1 min-w-0 ${INPUT_BASE}" placeholder="Persona de contacto (opcional)" aria-label="Persona de contacto" value="${esc(k.nombre)}">
            <input type="tel" inputmode="tel" maxlength="15" autocomplete="tel" class="k-tel w-40 shrink-0 ${INPUT_BASE}" placeholder="Teléfono" aria-label="Teléfono" value="${esc(k.telefono)}">
            <button type="button" data-accion="quitar-contacto" aria-label="Quitar contacto" class="${BTN_ICON} shrink-0 ml-auto sm:ml-0"><span class="material-symbols-outlined text-[20px]">close</span></button>
        </div>`;

    const editorContactos = (idContenedor, titulo, filas) => `
        <div class="flex flex-col gap-2">
            <span class="text-xs font-medium">${esc(titulo)}</span>
            <div id="${idContenedor}" class="flex flex-col gap-2">${(filas.length ? filas : [{}]).map(filaContacto).join('')}</div>
            <button type="button" data-accion="add-contacto" data-destino="${idContenedor}" class="self-start text-xs bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">add</span> Añadir contacto</button>
        </div>`;

    function leerContactos(idContenedor) {
        return [...document.querySelectorAll(`#${idContenedor} .contacto-fila`)]
            .map((f) => ({
                id: f.dataset.id || null,
                nombre: f.querySelector('.k-nombre').value.trim(),
                telefono: f.querySelector('.k-tel').value.trim(),
            }))
            .filter((k) => k.nombre || k.telefono);
    }

    function htmlFormulario(modo, cli, obra) {
        const esNuevo = modo === 'nuevo';
        let h = '';
        if (modo !== 'editar-obra') {
            h += `
            <section class="flex flex-col gap-3">
                <h4 class="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">business_center</span> Cliente</h4>
                <div class="flex flex-col gap-1">
                    <label for="f-cliente" class="text-xs font-medium">Nombre del cliente</label>
                    <input id="f-cliente" type="text" required autocomplete="off" ${esNuevo ? 'list="clientes-modal-datalist"' : ''} value="${esc(cli ? nombreCliente(cli) : '')}" placeholder="${esNuevo ? 'Elige uno existente o escribe uno nuevo' : ''}" class="${INPUT}">
                    ${esNuevo ? '<p id="f-cliente-hint" class="text-xs text-slate-500 dark:text-slate-400"></p>' : ''}
                </div>
                ${editorContactos('f-contactos-cliente', esNuevo ? 'Persona de contacto y teléfono (opcional)' : 'Personas de contacto y teléfonos', esNuevo ? [] : contactosCliente(cli))}
            </section>`;
        }
        if (modo !== 'editar-cliente') {
            h += `
            <section class="flex flex-col gap-3 ${modo === 'nuevo' ? 'border-t border-slate-200 dark:border-zinc-800 pt-5' : ''}">
                <h4 class="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">construction</span> Obra</h4>
                <div class="flex flex-col gap-1"><label for="f-obra-nombre" class="text-xs font-medium">Nombre de la obra</label><input id="f-obra-nombre" type="text" required autocomplete="off" value="${esc(obra?.nombre)}" class="${INPUT}"></div>
                <div class="flex flex-col sm:flex-row gap-3">
                    <div class="flex flex-col gap-1 flex-1"><label for="f-obra-direccion" class="text-xs font-medium">Dirección</label><input id="f-obra-direccion" type="text" required value="${esc(obra?.direccion)}" class="${INPUT}"></div>
                    <div class="flex flex-col gap-1 flex-1"><label for="f-obra-localidad" class="text-xs font-medium">Localidad</label><input id="f-obra-localidad" type="text" required value="${esc(obra?.localidad)}" class="${INPUT}"></div>
                </div>
                ${editorContactos('f-contactos-obra', 'Persona de contacto y teléfono (opcional)', obra ? contactosObra(obra) : [])}
            </section>`;
        }
        h += `
            <p id="f-error" class="hidden text-sm text-red-600 dark:text-red-400"></p>
            <div class="flex justify-end gap-3 pt-2">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="f-guardar" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium shadow-md">Guardar</button>
            </div>`;
        return h;
    }

    // En "nuevo": avisa si el cliente escrito ya existe o se va a crear.
    function actualizarHint() {
        const input = document.getElementById('f-cliente');
        const hint = document.getElementById('f-cliente-hint');
        if (!input || !hint) return;
        const existente = buscarClientePorNombre(input.value);
        if (!input.value.trim()) hint.textContent = '';
        else if (existente) hint.textContent = `Cliente existente: la obra se añadirá a «${nombreCliente(existente)}».`;
        else hint.textContent = 'Cliente nuevo: se creará junto con esta obra.';
    }

    function abrirFormulario(modo, { clienteId = null, obraId = null } = {}) {
        const cli = clienteId ? buscarCliente(clienteId) : null;
        const obra = obraId && cli ? (cli.obras || []).find((o) => o.id === obraId) : null;
        if ((modo !== 'nuevo' && !cli) || (modo === 'editar-obra' && !obra)) {
            alert('No se encontró el registro. Recarga la lista e inténtalo de nuevo.');
            return;
        }
        modalEstado = {
            modo, clienteId, obraId,
            contactosClienteOrig: cli ? (cli.contactos_clientes || []) : [],
            contactosObraOrig: obra ? (obra.contactos_obras || []) : [],
        };
        const titulos = { nuevo: 'Nuevo cliente / obra', 'editar-cliente': 'Editar cliente', 'editar-obra': 'Editar obra' };
        document.getElementById('modal-clientes-titulo').textContent = titulos[modo];
        document.getElementById('form-clientes').innerHTML = htmlFormulario(modo, cli, obra);
        if (modo === 'nuevo') actualizarHint();
        const modal = document.getElementById('modal-clientes');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        (document.getElementById(modo === 'editar-obra' ? 'f-obra-nombre' : 'f-cliente') || {}).focus?.();
    }

    function cerrarModal() {
        const modal = document.getElementById('modal-clientes');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modalEstado = null;
    }

    // ---------- Guardado ----------
    async function sincronizarContactos(tabla, fk, padreId, filas, originales) {
        const idsActuales = new Set(filas.filter((f) => f.id).map((f) => f.id));
        const aBorrar = originales.filter((o) => !idsActuales.has(o.id)).map((o) => o.id);
        const aInsertar = filas.filter((f) => !f.id).map((f) => ({ [fk]: padreId, nombre: f.nombre, telefono: f.telefono }));
        if (aInsertar.length) await exigir(db().from(tabla).insert(aInsertar).select('id'), 'No se pudieron guardar los contactos.');
        for (const f of filas.filter((x) => x.id)) {
            const orig = originales.find((o) => o.id === f.id);
            if (orig && (orig.nombre !== f.nombre || orig.telefono !== f.telefono)) {
                await exigir(db().from(tabla).update({ nombre: f.nombre, telefono: f.telefono }).eq('id', f.id).select('id'), 'No se pudo actualizar un contacto.');
            }
        }
        if (aBorrar.length) await exigir(db().from(tabla).delete().in('id', aBorrar).select('id'), 'No se pudo quitar un contacto.');
    }

    async function guardarNuevo() {
        const nombre = val('f-cliente');
        const oNombre = val('f-obra-nombre');
        const oDir = val('f-obra-direccion');
        const oLoc = val('f-obra-localidad');
        if (!nombre) throw new Error('Indica el nombre del cliente.');
        if (!oNombre || !oDir || !oLoc) throw new Error('La obra necesita nombre, dirección y localidad.');
        const existente = buscarClientePorNombre(nombre);
        if (existente && (existente.obras || []).some((o) => norm(o.nombre) === norm(oNombre))) {
            throw new Error(`«${nombreCliente(existente)}» ya tiene una obra llamada «${oNombre}».`);
        }
        const contCli = leerContactos('f-contactos-cliente');
        const contObra = leerContactos('f-contactos-obra');

        let clienteId;
        if (existente) {
            clienteId = existente.id;
        } else {
            const [fila] = await exigir(db().from('clientes').insert([{ nombre_cliente: nombre, nombre }]).select('id'), 'No se pudo crear el cliente.');
            clienteId = fila.id;
        }
        const [obra] = await exigir(db().from('obras').insert([{ cliente_id: clienteId, nombre: oNombre, direccion: oDir, localidad: oLoc }]).select('id'), 'No se pudo crear la obra.');
        if (contCli.length) await exigir(db().from('contactos_clientes').insert(contCli.map((k) => ({ cliente_id: clienteId, nombre: k.nombre, telefono: k.telefono }))).select('id'), 'No se pudieron guardar los contactos del cliente.');
        if (contObra.length) await exigir(db().from('contactos_obras').insert(contObra.map((k) => ({ obra_id: obra.id, nombre: k.nombre, telefono: k.telefono }))).select('id'), 'No se pudieron guardar los contactos de la obra.');
    }

    async function guardarCliente() {
        const { clienteId, contactosClienteOrig } = modalEstado;
        const nombre = val('f-cliente');
        if (!nombre) throw new Error('Indica el nombre del cliente.');
        const otro = buscarClientePorNombre(nombre);
        if (otro && otro.id !== clienteId) throw new Error(`Ya existe un cliente llamado «${nombreCliente(otro)}».`);
        await exigir(db().from('clientes').update({ nombre_cliente: nombre, nombre }).eq('id', clienteId).select('id'), 'No se pudo guardar el cliente.');
        await sincronizarContactos('contactos_clientes', 'cliente_id', clienteId, leerContactos('f-contactos-cliente'), contactosClienteOrig);
    }

    async function guardarObra() {
        const { clienteId, obraId, contactosObraOrig } = modalEstado;
        const cli = buscarCliente(clienteId);
        const nombre = val('f-obra-nombre');
        const dir = val('f-obra-direccion');
        const loc = val('f-obra-localidad');
        if (!nombre || !dir || !loc) throw new Error('La obra necesita nombre, dirección y localidad.');
        if ((cli.obras || []).some((o) => o.id !== obraId && norm(o.nombre) === norm(nombre))) {
            throw new Error(`«${nombreCliente(cli)}» ya tiene una obra llamada «${nombre}».`);
        }
        // Primero los contactos; después la obra, donde se vacía el contacto antiguo
        // (ya queda migrado a contactos_obras).
        await sincronizarContactos('contactos_obras', 'obra_id', obraId, leerContactos('f-contactos-obra'), contactosObraOrig);
        await exigir(db().from('obras').update({
            nombre, direccion: dir, localidad: loc, contacto_nombre: null, contacto_telefono: null,
        }).eq('id', obraId).select('id'), 'No se pudo guardar la obra.');
    }

    async function enviar(e) {
        e.preventDefault();
        if (guardando || !modalEstado) return;
        const err = document.getElementById('f-error');
        const btn = document.getElementById('f-guardar');
        err.classList.add('hidden');
        guardando = true;
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            if (modalEstado.modo === 'nuevo') await guardarNuevo();
            else if (modalEstado.modo === 'editar-cliente') await guardarCliente();
            else await guardarObra();
            cerrarModal();
            await cargar();
            avisarCambios();
        } catch (ex) {
            err.textContent = mensajeError(ex);
            err.classList.remove('hidden');
            cargar(); // deja la lista al día por si algo se guardó a medias
        } finally {
            guardando = false;
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    // ---------- Borrado (solo Admin / SuperAdmin) ----------
    async function tieneRegistros(clienteId, obraIds) {
        const consultas = [];
        for (const t of TABLAS_CON_REFERENCIAS) {
            if (clienteId) consultas.push(db().from(t).select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId));
            if (obraIds.length) consultas.push(db().from(t).select('id', { count: 'exact', head: true }).in('obra_id', obraIds));
        }
        const resultados = await Promise.all(consultas);
        const fallo = resultados.find((r) => r.error);
        if (fallo) throw fallo.error;
        return resultados.some((r) => (r.count || 0) > 0);
    }

    async function eliminarCliente(id) {
        if (!esAdmin()) { alert('Solo un administrador puede eliminar.'); return; }
        const c = buscarCliente(id);
        if (!c) return;
        const obraIds = (c.obras || []).map((o) => o.id);
        try {
            if (await tieneRegistros(id, obraIds)) {
                alert(`No se puede eliminar «${nombreCliente(c)}» porque tiene partes, bitácora, diario o material asociados.`);
                return;
            }
            const resumen = obraIds.length ? ` y sus ${obraIds.length} ${obraIds.length === 1 ? 'obra' : 'obras'}` : '';
            if (!confirm(`¿Eliminar a «${nombreCliente(c)}»${resumen}, con todos sus contactos? Esta acción no se puede deshacer.`)) return;
            // Una sola sentencia: la base de datos borra en cascada sus obras y contactos
            // (ON DELETE CASCADE), así que o se borra todo o no se borra nada.
            await exigir(db().from('clientes').delete().eq('id', id).select('id'), 'No tienes permiso para eliminar clientes.');
            await cargar();
            avisarCambios();
        } catch (ex) {
            alert('No se pudo eliminar: ' + mensajeError(ex));
            cargar();
        }
    }

    async function eliminarObra(clienteId, obraId) {
        if (!esAdmin()) { alert('Solo un administrador puede eliminar.'); return; }
        const c = buscarCliente(clienteId);
        const o = c && (c.obras || []).find((x) => x.id === obraId);
        if (!o) return;
        try {
            if (await tieneRegistros(null, [obraId])) {
                alert(`No se puede eliminar la obra «${o.nombre}» porque tiene partes, bitácora, diario o material asociados.`);
                return;
            }
            if (!confirm(`¿Eliminar la obra «${o.nombre}» de «${nombreCliente(c)}», con sus contactos? Esta acción no se puede deshacer.`)) return;
            // Sus contactos se borran en cascada (ON DELETE CASCADE).
            await exigir(db().from('obras').delete().eq('id', obraId).select('id'), 'No tienes permiso para eliminar obras.');
            await cargar();
            avisarCambios();
        } catch (ex) {
            alert('No se pudo eliminar: ' + mensajeError(ex));
            cargar();
        }
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-clientes').innerHTML = `
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">business_center</span> Clientes</h2>
                <span id="clientes-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span>
            </div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-clientes" aria-label="Buscar clientes" placeholder="Buscar cliente, obra, dirección, localidad..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="clientes-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-new-cliente" aria-label="Añadir cliente u obra" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">add</span></button>`;

        document.body.insertAdjacentHTML('beforeend', `
            <datalist id="clientes-modal-datalist"></datalist>
            <div id="modal-clientes" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-clientes-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="modal-clientes-titulo" class="font-semibold text-lg"></h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-clientes" class="flex flex-col gap-5 p-6 overflow-y-auto"></form>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        document.getElementById('view-clientes').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const { accion, id, cliente } = btn.dataset;
            if (accion === 'editar-cliente') abrirFormulario('editar-cliente', { clienteId: id });
            else if (accion === 'eliminar-cliente') eliminarCliente(id);
            else if (accion === 'nueva-obra') abrirFormulario('nuevo', { clienteId: id });
            else if (accion === 'editar-obra') abrirFormulario('editar-obra', { clienteId: cliente, obraId: id });
            else if (accion === 'eliminar-obra') eliminarObra(cliente, id);
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('fab-new-cliente').addEventListener('click', () => abrirFormulario('nuevo'));
        document.getElementById('search-clientes').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-clientes');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            if (btn.dataset.accion === 'cerrar') cerrarModal();
            else if (btn.dataset.accion === 'add-contacto') document.getElementById(btn.dataset.destino).insertAdjacentHTML('beforeend', filaContacto());
            else if (btn.dataset.accion === 'quitar-contacto') btn.closest('.contacto-fila').remove();
        });
        modal.addEventListener('input', (e) => { if (e.target.id === 'f-cliente' && modalEstado?.modo === 'nuevo') actualizarHint(); });
        document.getElementById('form-clientes').addEventListener('submit', enviar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalEstado) cerrarModal(); });
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        construirVista();
        enlazarEventos();
    }

    window.BomiClientes = {
        abrir() { iniciar(); return cargar(); },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
    };
})();
