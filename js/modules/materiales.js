// js/modules/materiales.js
// Materiales: solicitudes de material (cliente/obra + líneas unidades/producto/referencia),
// marcado como "pedido", PDF y catálogo de materiales (gestión solo Admin/SuperAdmin).
// Script clásico: expone window.BomiMateriales. Depende de `supabaseClient`, `window.currentUserProfile`
// y (para el PDF) html2pdf.
(function () {
    'use strict';

    const INPUT_BASE = 'bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const INPUT = 'w-full ' + INPUT_BASE;
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-full font-medium flex items-center gap-1.5';
    const LIMITE = 500;
    const SELECT = '*, materiales_solicitud_items ( id, cantidad, material, referencia )';

    let solicitudes = [];
    let catalogo = [];
    let clientes = [];
    let clientesViejos = true;
    let iniciado = false;
    let busqueda = '';
    let busquedaCat = '';
    let guardando = false;
    let modo = null;            // 'nuevo' | 'editar' | 'ver'
    let actual = null;
    let catEditando = null;     // id del material del catálogo en edición
    let claveCat = new Map();   // clave del datalist -> entrada del catálogo

    // ---------- Utilidades ----------
    const db = () => supabaseClient;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const val = (id) => (document.getElementById(id)?.value ?? '').trim();
    const mapsHref = (dir, loc) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dir, loc].filter(Boolean).join(', '));
    const nombreUsuario = () => {
        const p = window.currentUserProfile || {};
        return [p.nombre, p.apellido].filter((x) => x && String(x).trim()).join(' ').trim() || p.email || 'Usuario';
    };
    const esAdmin = () => ['admin', 'superadmin'].includes(String(window.currentUserProfile?.rol ?? '').trim().toLowerCase());
    const fechaHora = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const cant = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 });
    const modificado = (r) => !!r.updated_at && !!r.created_at && (new Date(r.updated_at) - new Date(r.created_at) > 5000);
    const esPedido = (r) => norm(r.estado) === 'pedido';
    const pedidoPor = (r) => r.pedido_por || (esPedido(r) ? r.updated_by : '') || '';
    const pedidoEn = (r) => r.pedido_at || (esPedido(r) ? r.updated_at : '') || '';
    const lineasDe = (r) => (r.materiales_solicitud_items || []).slice().sort((a, b) => 0);
    const fallo = (el, txt) => { el.textContent = txt; el.classList.remove('hidden'); };

    function mensajeError(ex) {
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        if (ex && ex.code === '23503') return 'Hay registros que dependen de este elemento.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }
    const columnaFalta = (ex) => !!ex && (ex.code === '42703' || ex.code === 'PGRST204' || /pedido_(por|at)/.test(ex.message || ''));

    async function exigir(consulta, mensajeSinFilas) {
        const { data, error } = await consulta;
        if (error) throw error;
        if (mensajeSinFilas && (!data || !data.length)) throw new Error(mensajeSinFilas);
        return data;
    }

    // ---------- Búsqueda ----------
    const texto = (r) => [r.created_by, r.cliente, r.obra, r.direccion, r.localidad, r.estado, pedidoPor(r)]
        .concat(lineasDe(r).flatMap((l) => [l.material, l.referencia])).join(' ');
    function filtrar() {
        const tokens = norm(busqueda).split(' ').filter(Boolean);
        if (!tokens.length) return solicitudes;
        return solicitudes.filter((r) => { const t = norm(texto(r)); return tokens.every((k) => t.includes(k)); });
    }

    // ---------- Lista ----------
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;
    const btnAccion = (accion, id, icono, etiqueta, clase = BTN_ICON) =>
        `<button type="button" data-accion="${accion}" data-id="${esc(id)}" aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}" class="${clase}"><span class="material-symbols-outlined text-[20px]">${icono}</span></button>`;

    function direccionHtml(dir, loc) {
        const txt = [dir, loc].filter(Boolean).join(', ');
        if (!txt) return '';
        return `<a href="${esc(mapsHref(dir, loc))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-start gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"><span class="material-symbols-outlined text-[16px] mt-0.5">location_on</span><span>${esc(txt)}</span></a>`;
    }

    const estadoHtml = (r) => esPedido(r)
        ? '<span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">Pedido</span>'
        : '<span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Pendiente</span>';

    function autoriaHtml(r) {
        const l = [`Solicitado por <strong>${esc(r.created_by || 'desconocido')}</strong> · ${esc(fechaHora(r.created_at))}`];
        if (esPedido(r)) l.push(`Pedido por <strong>${esc(pedidoPor(r) || 'desconocido')}</strong>${pedidoEn(r) ? ' · ' + esc(fechaHora(pedidoEn(r))) : ''}`);
        if (modificado(r) && !(esPedido(r) && !r.pedido_por)) l.push(`Modificado por <strong>${esc(r.updated_by || 'desconocido')}</strong> · ${esc(fechaHora(r.updated_at))}`);
        return l.map((x) => `<p class="text-xs text-slate-500">${x}</p>`).join('');
    }

    function htmlSolicitud(r) {
        const ls = lineasDe(r);
        const muestra = ls.slice(0, 3).map((l) => `<li class="break-words"><strong>${esc(cant(l.cantidad))}</strong> × ${esc(l.material)}${l.referencia ? ` <span class="text-slate-500">(${esc(l.referencia)})</span>` : ''}</li>`).join('');
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <div class="flex items-center gap-2 flex-wrap"><h3 class="font-bold text-base break-words">${esc(r.cliente || 'Sin cliente')}</h3>${estadoHtml(r)}</div>
                    <p class="text-sm font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(r.obra || 'Sin obra')}</span></p>
                    ${direccionHtml(r.direccion, r.localidad)}
                </div>
                <div class="flex gap-1 shrink-0 flex-wrap justify-end">
                    ${btnAccion('ver', r.id, 'visibility', 'Ver solicitud')}
                    ${btnAccion('pdf', r.id, 'picture_as_pdf', 'Descargar PDF')}
                    ${btnAccion('editar', r.id, 'edit', 'Editar solicitud')}
                    ${btnAccion('eliminar', r.id, 'delete', 'Eliminar solicitud', BTN_DANGER)}
                </div>
            </div>
            ${ls.length ? `<ul class="text-sm list-disc pl-5 flex flex-col gap-0.5">${muestra}${ls.length > 3 ? `<li class="list-none -ml-5 text-xs text-slate-500">y ${ls.length - 3} más...</li>` : ''}</ul>` : '<p class="text-sm text-slate-500">Sin líneas.</p>'}
            <div class="flex flex-col">${autoriaHtml(r)}</div>
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('materiales-lista');
        const badge = document.getElementById('materiales-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'solicitud' : 'solicitudes'}`;
        if (!solicitudes.length) { cont.innerHTML = aviso('Aún no hay solicitudes. Pulsa + para pedir material.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map(htmlSolicitud).join('');
    }

    // ---------- Carga ----------
    async function cargar() {
        const cont = document.getElementById('materiales-lista');
        if (cont && !solicitudes.length) cont.innerHTML = spinner;
        const btnCat = document.getElementById('btn-mat-catalogo');
        if (btnCat) btnCat.style.display = esAdmin() ? '' : 'none';
        const [res] = await Promise.all([
            db().from('materiales_solicitudes').select(SELECT).order('created_at', { ascending: false }).limit(LIMITE),
            cargarCatalogo().catch(() => {}),
        ]);
        if (res.error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar los materiales: ${esc(res.error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        solicitudes = res.data || [];
        pintarLista();
    }

    async function cargarCatalogo() {
        const { data, error } = await db().from('materiales_catalogo').select('id, nombre_material, referencia').order('nombre_material', { ascending: true });
        if (error) throw error;
        catalogo = (data || []).slice().sort((a, b) => String(a.nombre_material).localeCompare(String(b.nombre_material), 'es', { sensitivity: 'base' }));
        claveCat = new Map();
        catalogo.forEach((m) => { claveCat.set(norm(claveDe(m)), m); });
        const dl = document.getElementById('mat-productos-dl');
        if (dl) dl.innerHTML = catalogo.map((m) => `<option value="${esc(claveDe(m))}"></option>`).join('');
        if (document.getElementById('modal-mat-catalogo')?.classList.contains('flex')) pintarCatalogo();
    }
    const claveDe = (m) => m.referencia ? `${m.nombre_material} · ${m.referencia}` : m.nombre_material;

    async function cargarClientes() {
        const { data, error } = await db().from('clientes').select('id, nombre, nombre_cliente, obras ( id, nombre, direccion, localidad )');
        if (error) throw error;
        clientes = (data || []).map((c) => ({
            id: c.id,
            nombre: String(c.nombre_cliente || c.nombre || '').trim(),
            obras: (c.obras || []).map((o) => ({ id: o.id, nombre: String(o.nombre || '').trim(), direccion: o.direccion || '', localidad: o.localidad || '' })),
        })).filter((c) => c.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        clientesViejos = false;
    }
    const clientePorNombre = (n) => { const k = norm(n); return k ? clientes.find((c) => norm(c.nombre) === k) : undefined; };

    // ---------- Formulario ----------
    function htmlLinea(l) {
        return `
        <div class="m-linea grid grid-cols-[4.5rem_1fr_auto] gap-2 items-start" data-linea>
            <input type="number" inputmode="decimal" min="0" step="any" data-campo="cantidad" aria-label="Unidades" placeholder="Uds." value="${esc(l?.cantidad ?? '')}" class="${INPUT} !px-2">
            <div class="flex flex-col gap-2 min-w-0">
                <input type="text" list="mat-productos-dl" autocomplete="off" data-campo="material" aria-label="Producto" placeholder="Producto (escribe o elige)" value="${esc(l?.material ?? '')}" class="${INPUT}">
                <input type="text" autocomplete="off" data-campo="referencia" aria-label="Referencia" placeholder="Referencia (opcional)" value="${esc(l?.referencia ?? '')}" class="${INPUT}">
            </div>
            <button type="button" data-accion="quitar-linea" aria-label="Quitar línea" title="Quitar línea" class="${BTN_DANGER} mt-1"><span class="material-symbols-outlined text-[20px]">close</span></button>
        </div>`;
    }

    function htmlFormulario(r) {
        const ls = r ? lineasDe(r) : [];
        return `
            <div class="flex flex-col gap-1">
                <label for="m-cliente" class="text-xs font-medium">Cliente</label>
                <input id="m-cliente" type="text" required autocomplete="off" list="mat-clientes-dl" value="${esc(r?.cliente)}" placeholder="Elige uno existente o escribe uno nuevo" class="${INPUT}">
            </div>
            <div class="flex flex-col gap-1">
                <label for="m-obra" class="text-xs font-medium">Obra</label>
                <input id="m-obra" type="text" required autocomplete="off" list="mat-obras-dl" value="${esc(r?.obra)}" placeholder="Elige una obra del cliente o escribe una nueva" class="${INPUT}">
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="m-direccion" class="text-xs font-medium">Dirección</label><input id="m-direccion" type="text" autocomplete="off" value="${esc(r?.direccion)}" class="${INPUT} read-only:opacity-70"></div>
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="m-localidad" class="text-xs font-medium">Localidad</label><input id="m-localidad" type="text" autocomplete="off" value="${esc(r?.localidad)}" class="${INPUT} read-only:opacity-70"></div>
            </div>
            <p id="m-hint" class="hidden text-xs text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl p-3"></p>
            <div class="flex flex-col gap-2">
                <span class="text-xs font-medium">Material solicitado</span>
                <div id="m-lineas" class="flex flex-col gap-3">${(ls.length ? ls : [null]).map(htmlLinea).join('')}</div>
                <button type="button" data-accion="añadir-linea" class="${BTN_SEC} self-start"><span class="material-symbols-outlined text-[18px]">add</span> Añadir línea</button>
            </div>
            <p id="m-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex justify-end gap-3">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="m-guardar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-full font-medium">Guardar</button>
            </div>`;
    }

    function actualizarDatalists() {
        const dlc = document.getElementById('mat-clientes-dl');
        if (dlc) dlc.innerHTML = clientes.map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
        const dlo = document.getElementById('mat-obras-dl');
        if (!dlo) return;
        const cli = clientePorNombre(val('m-cliente'));
        const obras = cli ? cli.obras : (val('m-cliente') ? [] : clientes.flatMap((c) => c.obras));
        const vistos = new Set();
        dlo.innerHTML = obras.filter((o) => { const k = norm(o.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; })
            .map((o) => `<option value="${esc(o.nombre)}"></option>`).join('');
    }

    let obraAutorrellena = false;
    function sincronizar(origen) {
        const inCli = document.getElementById('m-cliente');
        const inObra = document.getElementById('m-obra');
        const inDir = document.getElementById('m-direccion');
        const inLoc = document.getElementById('m-localidad');
        const hint = document.getElementById('m-hint');
        if (!inCli) return;
        let cli = clientePorNombre(inCli.value);
        const obraTxt = inObra.value;
        let obra = null;
        if (cli) obra = cli.obras.find((o) => norm(o.nombre) === norm(obraTxt)) || null;
        else if (!norm(inCli.value) && norm(obraTxt)) {
            const coinc = clientes.flatMap((c) => c.obras.filter((o) => norm(o.nombre) === norm(obraTxt)).map((o) => ({ c, o })));
            if (coinc.length === 1 && origen === 'obra') { cli = coinc[0].c; obra = coinc[0].o; inCli.value = cli.nombre; }
        }
        if (obra) {
            inDir.value = obra.direccion; inLoc.value = obra.localidad;
            inDir.readOnly = true; inLoc.readOnly = true;
            obraAutorrellena = true;
        } else {
            if (obraAutorrellena) { inDir.value = ''; inLoc.value = ''; obraAutorrellena = false; }
            inDir.readOnly = false; inLoc.readOnly = false;
        }
        if (origen === 'cliente' || (origen === 'obra' && cli)) actualizarDatalists();

        let msg = '';
        if (norm(inCli.value) && !cli) msg = `«${inCli.value.trim()}» es un cliente nuevo: se creará junto con esta obra. Rellena dirección y localidad.`;
        else if (cli && norm(obraTxt) && !obra) msg = `Obra nueva en «${cli.nombre}»: se creará con esta dirección y localidad.`;
        else if (cli && obra) msg = `Obra existente de «${cli.nombre}»: se usan su dirección y localidad.`;
        if (hint) { hint.textContent = msg; hint.classList.toggle('hidden', !msg); }
    }

    // Al elegir un producto de la lista se rellena la referencia (sin pisar una escrita a mano).
    function productoCambiado(inp) {
        const linea = inp.closest('[data-linea]');
        if (!linea) return;
        const ref = linea.querySelector('[data-campo=referencia]');
        const hallado = claveCat.get(norm(inp.value));
        if (hallado) {
            inp.value = hallado.nombre_material;
            if (hallado.referencia) { ref.value = hallado.referencia; ref.dataset.auto = '1'; }
            else if (ref.dataset.auto === '1') { ref.value = ''; ref.dataset.auto = ''; }
            return;
        }
        // Nombre exacto que solo existe una vez en el catálogo.
        const mismos = catalogo.filter((m) => norm(m.nombre_material) === norm(inp.value));
        if (mismos.length === 1 && mismos[0].referencia && !ref.value.trim()) { ref.value = mismos[0].referencia; ref.dataset.auto = '1'; }
        else if (ref.dataset.auto === '1' && !mismos.length) { ref.value = ''; ref.dataset.auto = ''; }
    }

    function leerLineas() {
        return [...document.querySelectorAll('#m-lineas [data-linea]')].map((l) => ({
            cantidad: l.querySelector('[data-campo=cantidad]').value.trim(),
            material: l.querySelector('[data-campo=material]').value.trim(),
            referencia: l.querySelector('[data-campo=referencia]').value.trim(),
        })).filter((l) => l.cantidad || l.material || l.referencia);
    }

    // ---------- Modales ----------
    function mostrar(id, titulo) {
        if (titulo) document.getElementById(id + '-titulo').textContent = titulo;
        const m = document.getElementById(id);
        m.classList.remove('hidden');
        m.classList.add('flex');
    }
    function ocultar(id) {
        const m = document.getElementById(id);
        if (!m) return;
        m.classList.add('hidden');
        m.classList.remove('flex');
    }
    function cerrarModal() { ocultar('modal-materiales'); modo = null; actual = null; obraAutorrellena = false; }

    async function abrirFormulario(m, id) {
        const r = id ? solicitudes.find((x) => x.id === id) : null;
        if (m === 'editar' && !r) return;
        try { if (clientesViejos) await cargarClientes(); } catch (ex) { alert('No se pudieron cargar los clientes: ' + mensajeError(ex)); return; }
        modo = m; actual = r; obraAutorrellena = false;
        document.getElementById('form-materiales').innerHTML = htmlFormulario(r);
        mostrar('modal-materiales', m === 'nuevo' ? 'Pedir material' : 'Editar solicitud');
        actualizarDatalists();
        if (r) {
            const cli = clientePorNombre(r.cliente);
            const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(r.obra));
            if (obra) { document.getElementById('m-direccion').readOnly = true; document.getElementById('m-localidad').readOnly = true; obraAutorrellena = true; }
        }
        sincronizar('inicio');
        document.getElementById(r ? 'm-guardar' : 'm-cliente').focus();
    }

    function tablaLineas(r) {
        const ls = lineasDe(r);
        if (!ls.length) return '<p class="text-sm text-slate-500">Sin líneas.</p>';
        return `<ul class="flex flex-col divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl">${ls.map((l) => `
            <li class="flex gap-3 p-3 text-sm"><strong class="shrink-0 min-w-[3rem]">${esc(cant(l.cantidad))}</strong><span class="min-w-0 break-words">${esc(l.material)}${l.referencia ? `<span class="block text-xs text-slate-500">Ref.: ${esc(l.referencia)}</span>` : ''}</span></li>`).join('')}</ul>`;
    }

    function abrirVista(id) {
        const r = solicitudes.find((x) => x.id === id);
        if (!r) return;
        modo = 'ver'; actual = r;
        document.getElementById('form-materiales').innerHTML = `
            <div class="flex flex-col gap-1">
                <div class="flex items-center gap-2 flex-wrap"><h3 class="font-bold text-lg break-words">${esc(r.cliente || 'Sin cliente')}</h3>${estadoHtml(r)}</div>
                <p class="font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(r.obra || 'Sin obra')}</span></p>
                ${direccionHtml(r.direccion, r.localidad)}
            </div>
            <div class="flex flex-col gap-1"><span class="text-xs font-medium">Material</span>${tablaLineas(r)}</div>
            <div class="flex flex-col gap-0.5 border-t border-slate-200 dark:border-zinc-800 pt-3">${autoriaHtml(r)}</div>
            <p id="m-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cerrar</button>
                <button type="button" data-accion="pdf" data-id="${esc(r.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span> PDF</button>
                <button type="button" data-accion="editar-desde-ver" data-id="${esc(r.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">edit</span> Editar</button>
                ${esPedido(r)
                    ? `<button type="button" data-accion="pendiente" data-id="${esc(r.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">undo</span> Volver a pendiente</button>`
                    : `<button type="button" data-accion="pedido" data-id="${esc(r.id)}" class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full font-medium text-sm flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">check_circle</span> Marcar como pedido</button>`}
            </div>`;
        mostrar('modal-materiales', 'Solicitud de material');
    }

    // ---------- Guardado ----------
    async function resolverObra(f) {
        const cli = clientePorNombre(f.cliente);
        const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(f.obra));
        if (obra) return { cliente: cli.nombre, obra: obra.nombre, direccion: obra.direccion, localidad: obra.localidad, creados: false };
        if (!f.direccion || !f.localidad) throw new Error('Para una obra nueva hay que indicar dirección y localidad.');
        let clienteId = cli ? cli.id : null;
        if (!clienteId) {
            const [fila] = await exigir(db().from('clientes').insert([{ nombre_cliente: f.cliente, nombre: f.cliente }]).select('id'), 'No se pudo crear el cliente.');
            clienteId = fila.id;
        }
        await exigir(db().from('obras').insert([{ cliente_id: clienteId, nombre: f.obra, direccion: f.direccion, localidad: f.localidad }]).select('id'), 'No se pudo crear la obra.');
        return { cliente: cli ? cli.nombre : f.cliente, obra: f.obra, direccion: f.direccion, localidad: f.localidad, creados: true };
    }

    async function enviar(e) {
        e.preventDefault();
        if (guardando || (modo !== 'nuevo' && modo !== 'editar')) return;
        const err = document.getElementById('m-error');
        const btn = document.getElementById('m-guardar');
        const f = { cliente: val('m-cliente'), obra: val('m-obra'), direccion: val('m-direccion'), localidad: val('m-localidad') };
        err.classList.add('hidden');
        if (!f.cliente) return fallo(err, 'Indica el cliente.');
        if (!f.obra) return fallo(err, 'Indica la obra.');
        const lineas = leerLineas();
        if (!lineas.length) return fallo(err, 'Añade al menos un producto.');
        const items = [];
        for (const [i, l] of lineas.entries()) {
            const n = Number(String(l.cantidad).replace(',', '.'));
            if (!l.material) return fallo(err, `Línea ${i + 1}: indica el producto.`);
            if (!l.cantidad || !isFinite(n) || n <= 0) return fallo(err, `Línea ${i + 1}: indica las unidades (un número mayor que 0).`);
            items.push({ cantidad: n, material: l.material, referencia: l.referencia || null });
        }
        guardando = true; btn.disabled = true; btn.textContent = 'Guardando...';
        let idNuevo = null;
        try {
            const igual = modo === 'editar' && ['cliente', 'obra', 'direccion', 'localidad'].every((k) => norm(f[k]) === norm(actual[k]));
            let datos; let creados = false;
            if (igual) datos = { cliente: actual.cliente, obra: actual.obra, direccion: actual.direccion, localidad: actual.localidad };
            else { datos = await resolverObra(f); creados = datos.creados; }
            const fila = { cliente: datos.cliente, obra: datos.obra, direccion: datos.direccion, localidad: datos.localidad };
            const quien = nombreUsuario();
            let solId;
            if (modo === 'nuevo') {
                const [s] = await exigir(db().from('materiales_solicitudes').insert([{ ...fila, estado: 'Pendiente', created_by: quien, updated_by: quien }]).select('id'), 'No se pudo guardar la solicitud.');
                solId = idNuevo = s.id;
            } else {
                solId = actual.id;
                await exigir(db().from('materiales_solicitudes').update({ ...fila, updated_by: quien, updated_at: new Date().toISOString() }).eq('id', solId).select('id'), 'No se pudo guardar: no tienes permiso o la solicitud ya no existe.');
            }
            const viejos = modo === 'editar' ? lineasDe(actual).map((l) => l.id) : [];
            try {
                await exigir(db().from('materiales_solicitud_items').insert(items.map((it) => ({ ...it, solicitud_id: solId }))).select('id'), 'No se pudieron guardar las líneas.');
            } catch (ex) {
                if (idNuevo) { try { await db().from('materiales_solicitudes').delete().eq('id', idNuevo); } catch (x) { /* sin más */ } }
                throw ex;
            }
            if (viejos.length) await exigir(db().from('materiales_solicitud_items').delete().in('id', viejos).select('id'), 'No se pudieron sustituir las líneas anteriores.');
            cerrarModal();
            await cargar();
            if (creados) { clientesViejos = true; window.dispatchEvent(new CustomEvent('clientesActualizados')); }
        } catch (ex) {
            fallo(err, mensajeError(ex));
            clientesViejos = true;
        } finally {
            guardando = false; btn.disabled = false; btn.textContent = 'Guardar';
        }
    }

    async function eliminar(id) {
        const r = solicitudes.find((x) => x.id === id);
        if (!r) return;
        if (!confirm(`¿Eliminar la solicitud de «${r.cliente || 'sin cliente'} · ${r.obra || 'sin obra'}»? Esta acción no se puede deshacer.`)) return;
        try {
            await exigir(db().from('materiales_solicitudes').delete().eq('id', id).select('id'), 'No se pudo eliminar: no tienes permiso o la solicitud ya no existe.');
            await cargar();
        } catch (ex) { alert('No se pudo eliminar: ' + mensajeError(ex)); cargar(); }
    }

    // Marca como pedido guardando quién y cuándo. Si la BD aún no tiene las columnas pedido_por/pedido_at,
    // se guarda el estado y se registra a la persona en "modificado por".
    async function cambiarEstado(id, pedido) {
        const r = solicitudes.find((x) => x.id === id);
        if (!r) return;
        const err = document.getElementById('m-error');
        const quien = nombreUsuario();
        const ahora = new Date().toISOString();
        const completo = pedido ? { estado: 'Pedido', pedido_por: quien, pedido_at: ahora } : { estado: 'Pendiente', pedido_por: null, pedido_at: null };
        const msg = 'No se pudo actualizar: no tienes permiso o la solicitud ya no existe.';
        try {
            try {
                await exigir(db().from('materiales_solicitudes').update(completo).eq('id', id).select('id'), msg);
            } catch (ex) {
                if (!columnaFalta(ex)) throw ex;
                await exigir(db().from('materiales_solicitudes').update({ estado: completo.estado, updated_by: quien, updated_at: ahora }).eq('id', id).select('id'), msg);
            }
            await cargar();
            abrirVista(id);
        } catch (ex) { if (err) fallo(err, mensajeError(ex)); else alert(mensajeError(ex)); }
    }

    // ---------- PDF ----------
    function htmlPdf(r) {
        const fila = (l) => `<tr><td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap">${esc(cant(l.cantidad))}</td><td style="padding:6px 8px;border:1px solid #cbd5e1">${esc(l.material)}</td><td style="padding:6px 8px;border:1px solid #cbd5e1">${esc(l.referencia || '')}</td></tr>`;
        const ped = esPedido(r) ? `Pedido por ${esc(pedidoPor(r) || 'desconocido')}${pedidoEn(r) ? ' · ' + esc(fechaHora(pedidoEn(r))) : ''}` : 'Pendiente de pedir';
        return `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff;padding:8px;width:700px;font-size:13px">
            <h1 style="font-size:20px;margin:0 0 4px">Solicitud de material</h1>
            <p style="margin:0 0 14px;color:#475569">${esc(ped)}</p>
            <p style="margin:2px 0"><strong>Cliente:</strong> ${esc(r.cliente)}</p>
            <p style="margin:2px 0"><strong>Obra:</strong> ${esc(r.obra)}</p>
            <p style="margin:2px 0"><strong>Dirección:</strong> ${esc(r.direccion || '—')}</p>
            <p style="margin:2px 0 14px"><strong>Localidad:</strong> ${esc(r.localidad || '—')}</p>
            <table style="border-collapse:collapse;width:100%"><thead><tr style="background:#e2e8f0"><th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right">Uds.</th><th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left">Producto</th><th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left">Referencia</th></tr></thead><tbody>${lineasDe(r).map(fila).join('')}</tbody></table>
            <p style="margin:16px 0 0;font-size:11px;color:#64748b">Solicitado por ${esc(r.created_by || 'desconocido')} · ${esc(fechaHora(r.created_at))}${modificado(r) ? `<br>Modificado por ${esc(r.updated_by || 'desconocido')} · ${esc(fechaHora(r.updated_at))}` : ''}</p>
        </div>`;
    }

    async function descargarPdf(id) {
        const r = solicitudes.find((x) => x.id === id);
        if (!r) return;
        if (typeof html2pdf === 'undefined') { alert('No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.'); return; }
        const cont = document.createElement('div');
        cont.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;background:#fff;';
        cont.innerHTML = htmlPdf(r);
        document.body.appendChild(cont);
        const nombre = ('material_' + [r.cliente, r.obra].join('_')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) + '.pdf';
        try {
            await html2pdf().from(cont).set({ margin: 10, filename: nombre, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).save();
        } catch (ex) { alert('No se pudo crear el PDF: ' + mensajeError(ex)); }
        finally { cont.remove(); }
    }

    // ---------- Catálogo (solo Admin / SuperAdmin) ----------
    function pintarCatalogo() {
        const cont = document.getElementById('cat-lista');
        if (!cont) return;
        const tokens = norm(busquedaCat).split(' ').filter(Boolean);
        const lista = catalogo.filter((m) => { const t = norm(m.nombre_material + ' ' + (m.referencia || '')); return tokens.every((k) => t.includes(k)); });
        if (!catalogo.length) { cont.innerHTML = aviso('El catálogo está vacío. Añade el primer material.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map((m) => `
            <div class="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-zinc-800 last:border-0">
                <div class="min-w-0 flex-1"><p class="text-sm font-medium break-words">${esc(m.nombre_material)}</p><p class="text-xs text-slate-500 break-words">${m.referencia ? 'Ref.: ' + esc(m.referencia) : 'Sin referencia'}</p></div>
                ${btnAccion('cat-editar', m.id, 'edit', 'Modificar material')}
                ${btnAccion('cat-eliminar', m.id, 'delete', 'Eliminar material', BTN_DANGER)}
            </div>`).join('');
    }

    function pintarFormCatalogo() {
        const m = catalogo.find((x) => x.id === catEditando);
        document.getElementById('cat-material').value = m ? m.nombre_material : '';
        document.getElementById('cat-referencia').value = m ? (m.referencia || '') : '';
        document.getElementById('cat-guardar').textContent = m ? 'Guardar cambios' : 'Añadir';
        document.getElementById('cat-cancelar').style.display = m ? '' : 'none';
    }

    async function abrirCatalogo() {
        if (!esAdmin()) return;
        catEditando = null; busquedaCat = '';
        document.getElementById('cat-buscar').value = '';
        document.getElementById('cat-error').classList.add('hidden');
        mostrar('modal-mat-catalogo');
        pintarFormCatalogo();
        try { await cargarCatalogo(); } catch (ex) { fallo(document.getElementById('cat-error'), 'No se pudo cargar el catálogo: ' + mensajeError(ex)); }
        pintarCatalogo();
    }

    async function guardarCatalogo(e) {
        e.preventDefault();
        if (!esAdmin()) return;
        const err = document.getElementById('cat-error');
        err.classList.add('hidden');
        const nombre = val('cat-material');
        const ref = val('cat-referencia');
        if (!nombre) return fallo(err, 'Indica el nombre del material.');
        if (catalogo.some((m) => m.id !== catEditando && norm(m.nombre_material) === norm(nombre) && norm(m.referencia) === norm(ref))) return fallo(err, 'Ese material con esa referencia ya está en el catálogo.');
        const btn = document.getElementById('cat-guardar');
        btn.disabled = true;
        try {
            if (catEditando) await exigir(db().from('materiales_catalogo').update({ nombre_material: nombre, referencia: ref || null }).eq('id', catEditando).select('id'), 'No se pudo guardar: no tienes permiso o el material ya no existe.');
            else await exigir(db().from('materiales_catalogo').insert([{ nombre_material: nombre, referencia: ref || null }]).select('id'), 'No se pudo añadir el material.');
            catEditando = null;
            await cargarCatalogo();
            pintarFormCatalogo();
            pintarCatalogo();
        } catch (ex) { fallo(err, mensajeError(ex)); }
        finally { btn.disabled = false; }
    }

    async function eliminarCatalogo(id) {
        if (!esAdmin()) return;
        const m = catalogo.find((x) => x.id === id);
        if (!m) return;
        if (!confirm(`¿Eliminar «${m.nombre_material}» del catálogo? Las solicitudes ya hechas no se modifican.`)) return;
        const err = document.getElementById('cat-error');
        err.classList.add('hidden');
        try {
            await exigir(db().from('materiales_catalogo').delete().eq('id', id).select('id'), 'No se pudo eliminar: no tienes permiso o el material ya no existe.');
            if (catEditando === id) catEditando = null;
            await cargarCatalogo();
            pintarFormCatalogo();
            pintarCatalogo();
        } catch (ex) { fallo(err, mensajeError(ex)); }
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-materiales').innerHTML = `
            <div class="flex justify-between items-center gap-2">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">inventory_2</span> Materiales</h2>
                <div class="flex items-center gap-2">
                    <button type="button" id="btn-mat-catalogo" data-accion="catalogo" style="display:none" class="${BTN_SEC} !py-1 !px-3 text-xs"><span class="material-symbols-outlined text-[16px]">list_alt</span> Catálogo</button>
                    <span id="materiales-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span>
                </div>
            </div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-materiales" aria-label="Buscar solicitudes de material" placeholder="Buscar empleado, cliente, obra, dirección, localidad..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="materiales-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-new-material" aria-label="Pedir material" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">add</span></button>`;

        const cab = (id, t) => `<div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0"><h3 id="${id}-titulo" class="font-semibold text-lg">${t}</h3><button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button></div>`;
        const marco = 'hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm';
        const caja = 'bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]';
        document.body.insertAdjacentHTML('beforeend', `
            <datalist id="mat-clientes-dl"></datalist>
            <datalist id="mat-obras-dl"></datalist>
            <datalist id="mat-productos-dl"></datalist>
            <div id="modal-materiales" class="${marco}" role="dialog" aria-modal="true" aria-labelledby="modal-materiales-titulo">
                <div class="${caja}">${cab('modal-materiales', '')}<form id="form-materiales" class="flex flex-col gap-4 p-6 overflow-y-auto"></form></div>
            </div>
            <div id="modal-mat-catalogo" class="${marco}" role="dialog" aria-modal="true" aria-labelledby="modal-mat-catalogo-titulo">
                <div class="${caja}">${cab('modal-mat-catalogo', 'Catálogo de materiales')}
                    <div class="flex flex-col gap-4 p-6 overflow-y-auto">
                        <form id="form-catalogo" class="flex flex-col gap-2">
                            <input id="cat-material" type="text" autocomplete="off" placeholder="Material" aria-label="Material" class="${INPUT}">
                            <input id="cat-referencia" type="text" autocomplete="off" placeholder="Referencia (opcional)" aria-label="Referencia" class="${INPUT}">
                            <div class="flex justify-end gap-2">
                                <button type="button" id="cat-cancelar" data-accion="cat-cancelar" style="display:none" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300 text-sm">Cancelar edición</button>
                                <button type="submit" id="cat-guardar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-full font-medium text-sm">Añadir</button>
                            </div>
                        </form>
                        <p id="cat-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
                        <input id="cat-buscar" type="text" autocomplete="off" placeholder="Buscar en el catálogo..." aria-label="Buscar en el catálogo" class="${INPUT}">
                        <div id="cat-lista" class="border border-slate-200 dark:border-zinc-800 rounded-xl"></div>
                    </div>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        document.getElementById('view-materiales').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const { accion, id } = btn.dataset;
            if (accion === 'ver') abrirVista(id);
            else if (accion === 'editar') abrirFormulario('editar', id);
            else if (accion === 'eliminar') eliminar(id);
            else if (accion === 'pdf') descargarPdf(id);
            else if (accion === 'catalogo') abrirCatalogo();
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('fab-new-material').addEventListener('click', () => abrirFormulario('nuevo'));
        document.getElementById('search-materiales').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-materiales');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const a = btn.dataset.accion;
            const id = btn.dataset.id;
            if (a === 'cerrar') cerrarModal();
            else if (a === 'añadir-linea') {
                document.getElementById('m-lineas').insertAdjacentHTML('beforeend', htmlLinea(null));
                const ls = document.querySelectorAll('#m-lineas [data-linea]');
                ls[ls.length - 1].querySelector('[data-campo=cantidad]').focus();
            } else if (a === 'quitar-linea') {
                const ls = document.querySelectorAll('#m-lineas [data-linea]');
                const l = btn.closest('[data-linea]');
                if (ls.length > 1) l.remove();
                else l.querySelectorAll('input').forEach((i) => { i.value = ''; i.dataset.auto = ''; });
            } else if (a === 'editar-desde-ver') { cerrarModal(); abrirFormulario('editar', id); }
            else if (a === 'pedido') cambiarEstado(id, true);
            else if (a === 'pendiente') cambiarEstado(id, false);
            else if (a === 'pdf') descargarPdf(id);
        });
        const alCambiar = (e) => {
            const t = e.target;
            if (t.id === 'm-cliente') sincronizar('cliente');
            else if (t.id === 'm-obra') sincronizar('obra');
            else if (t.dataset && t.dataset.campo === 'material') productoCambiado(t);
            else if (t.dataset && t.dataset.campo === 'referencia') t.dataset.auto = '';
        };
        modal.addEventListener('input', alCambiar);
        modal.addEventListener('change', alCambiar);
        document.getElementById('form-materiales').addEventListener('submit', enviar);

        const mc = document.getElementById('modal-mat-catalogo');
        mc.addEventListener('click', (e) => {
            if (e.target === mc) { ocultar('modal-mat-catalogo'); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const a = btn.dataset.accion;
            if (a === 'cerrar') ocultar('modal-mat-catalogo');
            else if (a === 'cat-editar') { catEditando = btn.dataset.id; pintarFormCatalogo(); document.getElementById('cat-error').classList.add('hidden'); document.getElementById('cat-material').focus(); }
            else if (a === 'cat-cancelar') { catEditando = null; pintarFormCatalogo(); }
            else if (a === 'cat-eliminar') eliminarCatalogo(btn.dataset.id);
        });
        document.getElementById('form-catalogo').addEventListener('submit', guardarCatalogo);
        document.getElementById('cat-buscar').addEventListener('input', (e) => { busquedaCat = e.target.value; pintarCatalogo(); });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('modal-mat-catalogo').classList.contains('flex')) ocultar('modal-mat-catalogo');
            else if (modo) cerrarModal();
        });
        window.addEventListener('clientesActualizados', () => { clientesViejos = true; });
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        construirVista();
        enlazarEventos();
    }

    window.BomiMateriales = {
        abrir() { iniciar(); return cargar(); },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
    };
})();
