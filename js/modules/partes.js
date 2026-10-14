// js/modules/partes.js
// Partes de trabajo: operarios y horas, descripción (escrita o dictada), materiales y firma del cliente.
// Los admins pueden bloquear un parte (ya no se edita ni se elimina). Se descarga en PDF.
// Script clásico: expone window.BomiPartes. Depende de `supabaseClient`, `window.currentUserProfile` y html2pdf.
(function () {
    'use strict';

    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-full font-medium flex items-center gap-1.5';
    const LIMITE = 500;
    const COLS = 'id, cliente, obra, direccion, localidad, fecha, detalle_trabajo, bloqueado, bloqueado_por, bloqueado_at, created_by, created_by_id, updated_by, updated_at, created_at';
    const SELECT = COLS + ', partes_operarios ( id, operario_nombre, operario_id, horas ), partes_materiales ( id, unidades, material, referencia )';
    const CLAVE_LOCAL = 'bomi_partes_solo_mios';

    let partes = [];
    let clientes = [];
    let clientesViejos = true;
    let empleados = [];          // { id, nombre }
    let catalogo = [];           // materiales_catalogo
    let claveCat = new Map();
    let iniciado = false;
    let busqueda = '';
    let soloMios = false;
    let guardando = false;
    let modo = null;             // 'nuevo' | 'editar' | 'ver'
    let actual = null;
    let firma = { url: '', quitada: false };   // firma del formulario (dataURL)
    let reconocimiento = null;
    let escuchando = false;
    let obraAutorrellena = false;

    // ---------- Utilidades ----------
    const db = () => supabaseClient;
    const yo = () => window.currentUserProfile || {};
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const val = (id) => (document.getElementById(id)?.value ?? '').trim();
    const nombreDe = (p) => [p.nombre, p.apellido].filter((x) => x && String(x).trim()).join(' ').trim() || p.email || 'Usuario';
    const miNombre = () => nombreDe(yo());
    const esAdmin = () => ['admin', 'superadmin'].includes(String(yo().rol ?? '').trim().toLowerCase());
    const mapsHref = (dir, loc) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dir, loc].filter(Boolean).join(', '));
    const hoy = () => new Date().toLocaleDateString('sv-SE');   // AAAA-MM-DD en hora local
    const fechaES = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (f || ''); };
    const fechaHora = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const cant = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 });
    const modificado = (p) => !!p.updated_at && !!p.created_at && (new Date(p.updated_at) - new Date(p.created_at) > 5000);
    const ops = (p) => p.partes_operarios || [];
    const mats = (p) => p.partes_materiales || [];
    const fallo = (el, txt) => { el.textContent = txt; el.classList.remove('hidden'); };
    const imagenSegura = (u) => /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u || '') || /^https:\/\//.test(u || '') ? u : '';

    function mensajeError(ex) {
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }
    async function exigir(consulta, mensajeSinFilas) {
        const { data, error } = await consulta;
        if (error) throw error;
        if (mensajeSinFilas && (!data || !data.length)) throw new Error(mensajeSinFilas);
        return data;
    }
    const columnaFalta = (ex) => !!ex && (ex.code === '42703' || ex.code === 'PGRST204' || /bloqueado_(por|at)/.test(ex.message || ''));

    // ---------- Permisos ----------
    const figuro = (p) => ops(p).some((o) => (o.operario_id && o.operario_id === yo().id) || norm(o.operario_nombre) === norm(miNombre()));
    // Un parte bloqueado no se toca nunca más. Mientras no lo esté: Admin/SuperAdmin, quien lo creó o los operarios que figuran.
    const puedeEditar = (p) => !p.bloqueado && (esAdmin() || p.created_by_id === yo().id || figuro(p));

    // ---------- Preferencia: todos / míos (se guarda en el usuario) ----------
    function leerSoloMios() {
        const pref = yo().ui_preferencias;
        if (pref && pref.partes_solo_mios !== undefined) return !!pref.partes_solo_mios;
        try { return localStorage.getItem(CLAVE_LOCAL) === '1'; } catch (e) { return false; }
    }
    async function guardarSoloMios(v) {
        const p = yo();
        p.ui_preferencias = { ...(p.ui_preferencias || {}), partes_solo_mios: v };
        try { localStorage.setItem(CLAVE_LOCAL, v ? '1' : '0'); } catch (e) { /* sin almacenamiento local */ }
        try { await db().from('perfiles').update({ ui_preferencias: p.ui_preferencias }).eq('id', p.id); } catch (e) { /* queda en el dispositivo */ }
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

    const texto = (p) => [p.cliente, p.obra, p.direccion, p.localidad].concat(ops(p).map((o) => o.operario_nombre)).join(' ');
    function filtrar() {
        const tokens = norm(busqueda).split(' ').filter(Boolean);
        return partes.filter((p) => {
            if (soloMios && !figuro(p)) return false;
            if (!tokens.length) return true;
            const t = norm(texto(p));
            return tokens.every((k) => t.includes(k));
        });
    }

    function htmlParte(p) {
        const os = ops(p);
        const chips = os.map((o) => `<span class="text-xs bg-slate-100 dark:bg-zinc-800 rounded-full px-2.5 py-1 break-words">${esc(o.operario_nombre)}${o.horas ? ` · ${esc(o.horas)}` : ''}</span>`).join('');
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <p class="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">event</span>${esc(fechaES(p.fecha))}${p.bloqueado ? ' <span class="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 ml-1"><span class="material-symbols-outlined text-[16px]">lock</span>Bloqueado</span>' : ''}</p>
                    <h3 class="font-bold text-base break-words">${esc(p.cliente || 'Sin cliente')}</h3>
                    <p class="text-sm font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(p.obra || 'Sin obra')}</span></p>
                    ${direccionHtml(p.direccion, p.localidad)}
                </div>
                <div class="flex gap-1 shrink-0 flex-wrap justify-end">
                    ${btnAccion('ver', p.id, 'visibility', 'Ver parte')}
                    ${puedeEditar(p) ? btnAccion('editar', p.id, 'edit', 'Editar parte') : ''}
                    ${puedeEditar(p) ? btnAccion('eliminar', p.id, 'delete', 'Eliminar parte', BTN_DANGER) : ''}
                </div>
            </div>
            ${os.length ? `<div class="flex flex-wrap gap-1.5">${chips}</div>` : ''}
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('partes-lista');
        const badge = document.getElementById('partes-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'parte' : 'partes'}`;
        if (!partes.length) { cont.innerHTML = aviso('Aún no hay partes. Pulsa + para crear el primero.'); return; }
        if (!lista.length) { cont.innerHTML = aviso(soloMios && !busqueda ? 'No hay partes en los que figures como operario.' : 'No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map(htmlParte).join('');
    }

    function pintarInterruptor() {
        document.querySelectorAll('#view-partes [data-filtro]').forEach((b) => {
            const act = (b.dataset.filtro === 'mios') === soloMios;
            b.className = 'flex-1 py-2 rounded-full text-sm font-medium transition-colors ' + (act ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300');
            b.setAttribute('aria-pressed', String(act));
        });
    }

    // ---------- Carga ----------
    async function cargarEmpleados() {
        const { data, error } = await db().from('perfiles').select('id, nombre, apellido, email, activo');
        if (error) throw error;
        empleados = (data || []).filter((p) => p.activo !== false).map((p) => ({ id: p.id, nombre: nombreDe(p) }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    }
    const claveDe = (m) => m.referencia ? `${m.nombre_material} · ${m.referencia}` : m.nombre_material;
    async function cargarCatalogo() {
        // Supabase devuelve como máximo 1000 filas por consulta: se lee por páginas.
        const data = [];
        for (let desde = 0; ; desde += 1000) {
            const { data: pag, error } = await db().from('materiales_catalogo').select('id, nombre_material, referencia').order('id', { ascending: true }).range(desde, desde + 999);
            if (error) throw error;
            data.push(...(pag || []));
            if (!pag || pag.length < 1000) break;
        }
        catalogo = data.slice().sort((a, b) => String(a.nombre_material).localeCompare(String(b.nombre_material), 'es', { sensitivity: 'base' }));
        claveCat = new Map(catalogo.map((m) => [norm(claveDe(m)), m]));
        const dm = document.getElementById('par-materiales-dl');
        if (dm) dm.innerHTML = catalogo.map((m) => `<option value="${esc(claveDe(m))}"></option>`).join('');
        const dr = document.getElementById('par-referencias-dl');
        if (dr) dr.innerHTML = catalogo.filter((m) => m.referencia).map((m) => `<option value="${esc(m.referencia)}" label="${esc(m.nombre_material)}"></option>`).join('');
    }
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

    async function cargar() {
        const cont = document.getElementById('partes-lista');
        if (cont && !partes.length) cont.innerHTML = spinner;
        soloMios = leerSoloMios();
        pintarInterruptor();
        const [res] = await Promise.all([
            db().from('partes_trabajo').select(SELECT).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(LIMITE),
            cargarEmpleados().catch(() => {}),
            cargarCatalogo().catch(() => {}),
        ]);
        if (res.error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar los partes: ${esc(res.error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        partes = res.data || [];
        pintarLista();
    }

    // La firma es pesada: no viaja con la lista, se pide al ver, editar o descargar.
    async function cargarFirma(id) {
        const { data, error } = await db().from('partes_trabajo').select('firma_digital').eq('id', id).limit(1);
        if (error) throw error;
        return imagenSegura(data && data[0] && data[0].firma_digital);
    }

    // ---------- Formulario ----------
    function htmlOperario(o) {
        return `
        <div class="grid grid-cols-[1fr_5.5rem_auto] gap-2 items-center" data-operario>
            <input type="text" list="par-operarios-dl" autocomplete="off" data-campo="nombre" aria-label="Operario" placeholder="Operario" value="${esc(o?.nombre ?? '')}" class="${INPUT}">
            <input type="text" maxlength="10" autocomplete="off" data-campo="horas" aria-label="Horas" placeholder="Horas" value="${esc(o?.horas ?? '')}" class="${INPUT}">
            <button type="button" data-accion="quitar-operario" aria-label="Quitar operario" title="Quitar operario" class="${BTN_DANGER}"><span class="material-symbols-outlined text-[20px]">close</span></button>
        </div>`;
    }
    function htmlMaterial(m) {
        return `
        <div class="grid grid-cols-[4.5rem_1fr_auto] gap-2 items-start" data-material>
            <input type="number" inputmode="decimal" min="0" step="any" data-campo="cantidad" aria-label="Cantidad" placeholder="Cant." value="${esc(m?.unidades ?? '')}" class="${INPUT} !px-2">
            <div class="flex flex-col gap-2 min-w-0">
                <input type="text" list="par-materiales-dl" autocomplete="off" data-campo="material" aria-label="Material" placeholder="Material (escribe o elige)" value="${esc(m?.material ?? '')}" class="${INPUT}">
                <input type="text" list="par-referencias-dl" autocomplete="off" data-campo="referencia" aria-label="Referencia" placeholder="Referencia (opcional)" value="${esc(m?.referencia ?? '')}" class="${INPUT}">
            </div>
            <button type="button" data-accion="quitar-material" aria-label="Quitar material" title="Quitar material" class="${BTN_DANGER} mt-1"><span class="material-symbols-outlined text-[20px]">close</span></button>
        </div>`;
    }

    function htmlFormulario(p) {
        const os = p ? ops(p).map((o) => ({ nombre: o.operario_nombre, horas: o.horas })) : [{ nombre: miNombre(), horas: '' }];
        const ms = p ? mats(p) : [];
        return `
            <div class="flex flex-col gap-1">
                <label for="par-cliente" class="text-xs font-medium">Cliente</label>
                <input id="par-cliente" type="text" autocomplete="off" list="par-clientes-dl" value="${esc(p?.cliente)}" placeholder="Elige uno existente o escribe uno nuevo" class="${INPUT}">
            </div>
            <div class="flex flex-col gap-1">
                <label for="par-obra" class="text-xs font-medium">Obra</label>
                <input id="par-obra" type="text" required autocomplete="off" list="par-obras-dl" value="${esc(p?.obra)}" placeholder="Elige una obra del cliente o escribe una nueva" class="${INPUT}">
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="par-direccion" class="text-xs font-medium">Dirección</label><input id="par-direccion" type="text" autocomplete="off" value="${esc(p?.direccion)}" class="${INPUT} read-only:opacity-70"></div>
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="par-localidad" class="text-xs font-medium">Localidad</label><input id="par-localidad" type="text" autocomplete="off" value="${esc(p?.localidad)}" class="${INPUT} read-only:opacity-70"></div>
            </div>
            <p id="par-hint" class="hidden text-xs text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl p-3"></p>
            <div class="flex flex-col gap-1">
                <label for="par-fecha" class="text-xs font-medium">Fecha</label>
                <input id="par-fecha" type="date" required value="${esc(p?.fecha || hoy())}" class="${INPUT}">
            </div>
            <div class="flex flex-col gap-2">
                <div class="grid grid-cols-[1fr_5.5rem_auto] gap-2 text-xs font-medium"><span>Operario</span><span>Horas</span><span class="w-9"></span></div>
                <div id="par-operarios" class="flex flex-col gap-2">${os.map(htmlOperario).join('')}</div>
                <button type="button" data-accion="añadir-operario" class="${BTN_SEC} self-start"><span class="material-symbols-outlined text-[18px]">person_add</span> Añadir operario</button>
            </div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center">
                    <label for="par-detalle" class="text-xs font-medium">Trabajo realizado</label>
                    <button type="button" id="par-dictar" data-accion="dictar" class="${BTN_SEC} !py-1 !px-3 text-xs"><span class="material-symbols-outlined text-[16px]">mic</span> <span id="par-dictar-txt">Dictar</span></button>
                </div>
                <textarea id="par-detalle" rows="6" class="${INPUT}" placeholder="Describe el trabajo realizado (escribe o dicta)...">${esc(p?.detalle_trabajo)}</textarea>
                <p id="par-dictado-aviso" class="hidden text-xs text-slate-500"></p>
            </div>
            <div class="flex flex-col gap-2">
                <span class="text-xs font-medium">Material utilizado</span>
                <div id="par-materiales" class="flex flex-col gap-3">${ms.map(htmlMaterial).join('')}</div>
                <button type="button" data-accion="añadir-material" class="${BTN_SEC} self-start"><span class="material-symbols-outlined text-[18px]">add</span> Añadir material</button>
            </div>
            <div class="flex flex-col gap-2">
                <span class="text-xs font-medium">Firma del cliente <span class="font-normal text-slate-500">(solo si es necesaria)</span></span>
                <div id="par-firma" class="flex flex-col gap-2 items-start"></div>
            </div>
            <p id="par-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex justify-end gap-3">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="par-guardar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-full font-medium">Guardar</button>
            </div>`;
    }

    function pintarFirmaForm() {
        const cont = document.getElementById('par-firma');
        if (!cont) return;
        const img = firma.quitada ? '' : firma.url;
        cont.innerHTML = `
            ${img ? `<img src="${esc(img)}" alt="Firma" class="max-h-32 max-w-full object-contain bg-white rounded-xl border border-slate-200 dark:border-zinc-700">` : ''}
            <div class="flex flex-wrap gap-2">
                <button type="button" data-accion="firmar" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">draw</span> ${img ? 'Cambiar firma' : 'Firmar'}</button>
                ${img ? `<button type="button" data-accion="quitar-firma" class="${BTN_SEC} text-red-600 dark:text-red-400"><span class="material-symbols-outlined text-[18px]">delete</span> Quitar</button>` : ''}
            </div>`;
    }

    function actualizarDatalists() {
        const dlc = document.getElementById('par-clientes-dl');
        if (dlc) dlc.innerHTML = clientes.map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
        const dlo = document.getElementById('par-obras-dl');
        if (dlo) {
            const cli = clientePorNombre(val('par-cliente'));
            const obras = cli ? cli.obras : (val('par-cliente') ? [] : clientes.flatMap((c) => c.obras));
            const vistos = new Set();
            dlo.innerHTML = obras.filter((o) => { const k = norm(o.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; })
                .map((o) => `<option value="${esc(o.nombre)}"></option>`).join('');
        }
        const dle = document.getElementById('par-operarios-dl');
        if (dle) dle.innerHTML = empleados.map((e) => `<option value="${esc(e.nombre)}"></option>`).join('');
    }

    function sincronizar(origen) {
        const inCli = document.getElementById('par-cliente');
        const inObra = document.getElementById('par-obra');
        const inDir = document.getElementById('par-direccion');
        const inLoc = document.getElementById('par-localidad');
        const hint = document.getElementById('par-hint');
        if (!inCli) return;
        let cli = clientePorNombre(inCli.value);
        const obraTxt = inObra.value;
        let obra = null;
        let obraAmbigua = false;
        if (cli) obra = cli.obras.find((o) => norm(o.nombre) === norm(obraTxt)) || null;
        else if (!norm(inCli.value) && norm(obraTxt)) {
            // Sin cliente: si el nombre de la obra identifica una sola, se completa también el cliente.
            const coinc = clientes.flatMap((c) => c.obras.filter((o) => norm(o.nombre) === norm(obraTxt)).map((o) => ({ c, o })));
            if (coinc.length === 1 && origen === 'obra') { cli = coinc[0].c; obra = coinc[0].o; inCli.value = cli.nombre; }
            else if (coinc.length > 1 && origen === 'obra') obraAmbigua = true;
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
        if (obraAmbigua) msg = 'Hay varias obras con ese nombre en distintos clientes: elige primero el cliente.';
        else if (norm(inCli.value) && !cli) msg = `«${inCli.value.trim()}» es un cliente nuevo: se creará junto con esta obra. Rellena dirección y localidad.`;
        else if (cli && norm(obraTxt) && !obra) msg = `Obra nueva en «${cli.nombre}»: se creará con esta dirección y localidad.`;
        else if (cli && obra) msg = `Obra existente de «${cli.nombre}»: se usan su dirección y localidad.`;
        if (hint) { hint.textContent = msg; hint.classList.toggle('hidden', !msg); }
    }

    // Material ↔ referencia: al elegir un material de la lista se rellena la referencia, y al elegir una referencia se rellena el material.
    function materialCambiado(inp) {
        const fila = inp.closest('[data-material]');
        if (!fila) return;
        const ref = fila.querySelector('[data-campo=referencia]');
        const hallado = claveCat.get(norm(inp.value));
        if (hallado) {
            inp.value = hallado.nombre_material;
            if (hallado.referencia) { ref.value = hallado.referencia; ref.dataset.auto = '1'; }
            else if (ref.dataset.auto === '1') { ref.value = ''; ref.dataset.auto = ''; }
            return;
        }
        const mismos = catalogo.filter((m) => norm(m.nombre_material) === norm(inp.value));
        if (mismos.length === 1 && mismos[0].referencia && !ref.value.trim()) { ref.value = mismos[0].referencia; ref.dataset.auto = '1'; }
        else if (ref.dataset.auto === '1' && !mismos.length) { ref.value = ''; ref.dataset.auto = ''; }
    }
    function referenciaCambiada(inp) {
        const fila = inp.closest('[data-material]');
        if (!fila) return;
        inp.dataset.auto = '';
        const mat = fila.querySelector('[data-campo=material]');
        const coinc = catalogo.filter((m) => m.referencia && norm(m.referencia) === norm(inp.value));
        if (coinc.length === 1) { inp.value = coinc[0].referencia; mat.value = coinc[0].nombre_material; }
    }

    function leerOperarios() {
        return [...document.querySelectorAll('#par-operarios [data-operario]')].map((f) => ({
            nombre: f.querySelector('[data-campo=nombre]').value.trim(),
            horas: f.querySelector('[data-campo=horas]').value.trim(),
        })).filter((o) => o.nombre || o.horas);
    }
    function leerMateriales() {
        return [...document.querySelectorAll('#par-materiales [data-material]')].map((f) => ({
            cantidad: f.querySelector('[data-campo=cantidad]').value.trim(),
            material: f.querySelector('[data-campo=material]').value.trim(),
            referencia: f.querySelector('[data-campo=referencia]').value.trim(),
        })).filter((m) => m.cantidad || m.material || m.referencia);
    }

    // ---------- Dictado por voz ----------
    function soporteDictado() { return window.SpeechRecognition || window.webkitSpeechRecognition; }
    function pintarDictado() {
        const t = document.getElementById('par-dictar-txt');
        const b = document.getElementById('par-dictar');
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
        const p = document.getElementById('par-dictado-aviso');
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
            const area = document.getElementById('par-detalle');
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

    // ---------- Firma ----------
    let trazos = { dibujando: false, hayTrazo: false, ult: null };
    function abrirFirma() {
        const m = document.getElementById('modal-firma');
        m.classList.remove('hidden'); m.classList.add('flex');
        document.getElementById('firma-error').classList.add('hidden');
        const c = document.getElementById('firma-canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = c.clientWidth || 320, h = c.clientHeight || 180;
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        const g = c.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#0f172a'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
        trazos = { dibujando: false, hayTrazo: false, ult: null };
    }
    function cerrarFirma() { const m = document.getElementById('modal-firma'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
    function posFirma(e) { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function enlazarFirma() {
        const c = document.getElementById('firma-canvas');
        c.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            try { c.setPointerCapture(e.pointerId); } catch (x) { /* sin captura */ }
            trazos.dibujando = true; trazos.ult = posFirma(e);
            const g = c.getContext('2d'); g.beginPath(); g.arc(trazos.ult.x, trazos.ult.y, 1.1, 0, Math.PI * 2); g.fillStyle = '#0f172a'; g.fill();
            trazos.hayTrazo = true;
        });
        c.addEventListener('pointermove', (e) => {
            if (!trazos.dibujando) return;
            e.preventDefault();
            const p = posFirma(e), g = c.getContext('2d');
            g.beginPath(); g.moveTo(trazos.ult.x, trazos.ult.y); g.lineTo(p.x, p.y); g.stroke();
            trazos.ult = p; trazos.hayTrazo = true;
        });
        const fin = () => { trazos.dibujando = false; };
        c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin); c.addEventListener('pointerleave', fin);
        document.getElementById('modal-firma').addEventListener('click', (e) => {
            const b = e.target.closest('[data-firma]');
            if (e.target.id === 'modal-firma') { cerrarFirma(); return; }
            if (!b) return;
            if (b.dataset.firma === 'cancelar') cerrarFirma();
            else if (b.dataset.firma === 'borrar') abrirFirma();
            else if (b.dataset.firma === 'aceptar') {
                if (!trazos.hayTrazo) { const er = document.getElementById('firma-error'); er.textContent = 'Dibuja la firma antes de aceptar.'; er.classList.remove('hidden'); return; }
                firma = { url: c.toDataURL('image/png'), quitada: false, cambiada: true };
                cerrarFirma();
                pintarFirmaForm();
            }
        });
    }

    // ---------- Modal ----------
    function mostrarModal(titulo) {
        document.getElementById('modal-parte-titulo').textContent = titulo;
        const m = document.getElementById('modal-parte');
        m.classList.remove('hidden'); m.classList.add('flex');
    }
    function cerrarModal() {
        pararDictado(); cerrarFirma();
        const m = document.getElementById('modal-parte');
        if (!m) return;
        m.classList.add('hidden'); m.classList.remove('flex');
        modo = null; actual = null; obraAutorrellena = false;
    }

    async function abrirFormulario(m, id) {
        const p = id ? partes.find((x) => x.id === id) : null;
        if (m === 'editar' && (!p || !puedeEditar(p))) return;
        try {
            await Promise.all([clientesViejos ? cargarClientes() : null, cargarEmpleados(), cargarCatalogo().catch(() => {})]);
            firma = { url: p ? await cargarFirma(p.id) : '', quitada: false, cambiada: false };
        } catch (ex) { alert('No se pudieron cargar los datos: ' + mensajeError(ex)); return; }
        modo = m; actual = p; obraAutorrellena = false;
        document.getElementById('form-parte').innerHTML = htmlFormulario(p);
        mostrarModal(m === 'nuevo' ? 'Nuevo parte' : 'Editar parte');
        actualizarDatalists();
        if (p) {
            const cli = clientePorNombre(p.cliente);
            const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(p.obra));
            if (obra) { document.getElementById('par-direccion').readOnly = true; document.getElementById('par-localidad').readOnly = true; obraAutorrellena = true; }
        }
        sincronizar('inicio');
        pintarFirmaForm();
        // style en vez de la clase hidden: el botón ya trae "flex" y ambas clases competirían.
        document.getElementById('par-dictar').style.display = soporteDictado() ? '' : 'none';
        document.getElementById(p ? 'par-detalle' : 'par-cliente').focus();
    }

    // ---------- Ver ----------
    function tablaOperarios(p) {
        const os = ops(p);
        if (!os.length) return '<p class="text-sm text-slate-500">Sin operarios.</p>';
        return `<ul class="flex flex-col divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl">${os.map((o) => `<li class="flex justify-between gap-3 p-3 text-sm"><span class="break-words min-w-0">${esc(o.operario_nombre)}</span><strong class="shrink-0">${esc(o.horas || '—')}</strong></li>`).join('')}</ul>`;
    }
    function tablaMateriales(p) {
        const ms = mats(p);
        if (!ms.length) return '<p class="text-sm text-slate-500">Sin material.</p>';
        return `<ul class="flex flex-col divide-y divide-slate-200 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl">${ms.map((m) => `<li class="flex gap-3 p-3 text-sm"><strong class="shrink-0 min-w-[3rem]">${esc(cant(m.unidades))}</strong><span class="min-w-0 break-words">${esc(m.material)}${m.referencia ? `<span class="block text-xs text-slate-500">Ref.: ${esc(m.referencia)}</span>` : ''}</span></li>`).join('')}</ul>`;
    }
    function autoriaHtml(p) {
        const l = [`Creado por <strong>${esc(p.created_by || 'desconocido')}</strong> · ${esc(fechaHora(p.created_at))}`];
        if (modificado(p)) l.push(`Modificado por <strong>${esc(p.updated_by || 'desconocido')}</strong> · ${esc(fechaHora(p.updated_at))}`);
        if (p.bloqueado) l.push(`Bloqueado por <strong>${esc(p.bloqueado_por || 'un administrador')}</strong>${p.bloqueado_at ? ' · ' + esc(fechaHora(p.bloqueado_at)) : ''}`);
        return l.map((x) => `<p class="text-xs text-slate-500">${x}</p>`).join('');
    }

    async function abrirVista(id) {
        const p = partes.find((x) => x.id === id);
        if (!p) return;
        modo = 'ver'; actual = p;
        let imgFirma = '';
        try { imgFirma = await cargarFirma(id); } catch (ex) { /* se muestra sin firma */ }
        if (modo !== 'ver' || actual !== p) return;
        document.getElementById('form-parte').innerHTML = `
            <div class="flex flex-col gap-1">
                <p class="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">event</span>${esc(fechaES(p.fecha))}${p.bloqueado ? ' <span class="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 ml-1"><span class="material-symbols-outlined text-[16px]">lock</span>Bloqueado</span>' : ''}</p>
                <h3 class="font-bold text-lg break-words">${esc(p.cliente || 'Sin cliente')}</h3>
                <p class="font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(p.obra || 'Sin obra')}</span></p>
                ${direccionHtml(p.direccion, p.localidad)}
            </div>
            <div class="flex flex-col gap-1"><span class="text-xs font-medium">Operarios y horas</span>${tablaOperarios(p)}</div>
            <div class="flex flex-col gap-1"><span class="text-xs font-medium">Trabajo realizado</span>${p.detalle_trabajo ? `<p class="text-sm whitespace-pre-wrap break-words">${esc(p.detalle_trabajo)}</p>` : '<p class="text-sm text-slate-500">Sin descripción.</p>'}</div>
            <div class="flex flex-col gap-1"><span class="text-xs font-medium">Material utilizado</span>${tablaMateriales(p)}</div>
            ${imgFirma ? `<div class="flex flex-col gap-1"><span class="text-xs font-medium">Firma del cliente</span><img src="${esc(imgFirma)}" alt="Firma del cliente" class="max-h-40 max-w-full object-contain bg-white rounded-xl border border-slate-200 dark:border-zinc-700 self-start"></div>` : ''}
            <div class="flex flex-col gap-0.5 border-t border-slate-200 dark:border-zinc-800 pt-3">${autoriaHtml(p)}</div>
            <p id="par-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cerrar</button>
                <button type="button" data-accion="pdf" data-id="${esc(p.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span> PDF</button>
                ${esAdmin() && !p.bloqueado ? `<button type="button" data-accion="bloquear" data-id="${esc(p.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">lock</span> Bloquear</button>` : ''}
                ${puedeEditar(p) ? `<button type="button" data-accion="eliminar-desde-ver" data-id="${esc(p.id)}" class="${BTN_SEC} text-red-600 dark:text-red-400"><span class="material-symbols-outlined text-[18px]">delete</span> Eliminar</button>` : ''}
                ${puedeEditar(p) ? `<button type="button" data-accion="editar-desde-ver" data-id="${esc(p.id)}" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-medium text-sm flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">edit</span> Editar</button>` : ''}
            </div>`;
        mostrarModal('Parte de trabajo');
    }

    // El bloqueo es definitivo: un parte bloqueado ya no se puede editar, eliminar ni desbloquear.
    async function bloquear(id) {
        if (!esAdmin()) return;
        const p = partes.find((x) => x.id === id);
        if (!p || p.bloqueado) return;
        if (!confirm('¿Bloquear este parte?\n\nUna vez bloqueado NO se podrá editar, eliminar ni desbloquear.')) return;
        const err = document.getElementById('par-error');
        const msg = 'No se pudo bloquear: no tienes permiso o el parte ya no existe.';
        try {
            try {
                await exigir(db().from('partes_trabajo').update({ bloqueado: true, bloqueado_por: miNombre(), bloqueado_at: new Date().toISOString() }).eq('id', id).select('id'), msg);
            } catch (ex) {
                if (!columnaFalta(ex)) throw ex;
                await exigir(db().from('partes_trabajo').update({ bloqueado: true }).eq('id', id).select('id'), msg);
            }
            await cargar();
            await abrirVista(id);
        } catch (ex) { if (err) fallo(err, mensajeError(ex)); else alert(mensajeError(ex)); }
    }

    // ---------- Guardado ----------
    async function resolverObra(f) {
        const cli = clientePorNombre(f.cliente);
        const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(f.obra));
        if (obra) return { cliente: cli.nombre, obra: obra.nombre, direccion: obra.direccion, localidad: obra.localidad, creados: false };
        if (!f.cliente) throw new Error('Indica el cliente de la obra.');
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
        const err = document.getElementById('par-error');
        const btn = document.getElementById('par-guardar');
        const f = { cliente: val('par-cliente'), obra: val('par-obra'), direccion: val('par-direccion'), localidad: val('par-localidad'), fecha: val('par-fecha'), detalle: val('par-detalle') };
        err.classList.add('hidden');
        const operarios = leerOperarios();
        const materiales = leerMateriales();
        if (!f.obra) return fallo(err, 'Indica la obra.');
        if (!f.fecha) return fallo(err, 'Indica la fecha.');
        if (!operarios.length || operarios.some((o) => !o.nombre)) return fallo(err, 'Indica el nombre de cada operario (o quita las líneas vacías).');
        const yoEstoy = operarios.some((o) => norm(o.nombre) === norm(miNombre()));
        if (modo === 'editar' && !esAdmin() && actual.created_by_id !== yo().id && !yoEstoy) return fallo(err, 'Tu nombre debe seguir figurando entre los operarios para poder guardar el parte.');
        const items = [];
        for (const [i, m] of materiales.entries()) {
            const n = Number(String(m.cantidad).replace(',', '.'));
            if (!m.material) return fallo(err, `Material ${i + 1}: indica el material.`);
            if (!m.cantidad || !isFinite(n) || n <= 0) return fallo(err, `Material ${i + 1}: indica la cantidad (un número mayor que 0).`);
            items.push({ unidades: n, material: m.material, referencia: m.referencia || null });
        }
        pararDictado();
        guardando = true; btn.disabled = true; btn.textContent = 'Guardando...';
        let idNuevo = null;
        let insertadosOp = [], insertadosMat = [];
        try {
            const igual = modo === 'editar' && ['cliente', 'obra', 'direccion', 'localidad'].every((k) => norm(f[k]) === norm(actual[k]));
            let datos; let creados = false;
            if (igual) datos = { cliente: actual.cliente, obra: actual.obra, direccion: actual.direccion, localidad: actual.localidad };
            else { datos = await resolverObra(f); creados = datos.creados; }
            const quien = miNombre();
            const fila = { cliente: datos.cliente, obra: datos.obra, direccion: datos.direccion, localidad: datos.localidad, fecha: f.fecha, detalle_trabajo: f.detalle || null };
            if (firma.quitada) fila.firma_digital = null; else if (firma.cambiada && firma.url) fila.firma_digital = firma.url;   // sin tocar, se conserva la guardada
            let parteId;
            if (modo === 'nuevo') {
                const [s] = await exigir(db().from('partes_trabajo').insert([{ ...fila, bloqueado: false, created_by: quien, created_by_id: yo().id, updated_by: quien }]).select('id'), 'No se pudo guardar el parte.');
                parteId = idNuevo = s.id;
            } else {
                parteId = actual.id;
                await exigir(db().from('partes_trabajo').update({ ...fila, updated_by: quien, updated_at: new Date().toISOString() }).eq('id', parteId).select('id'), 'No se pudo guardar: el parte está bloqueado, no tienes permiso o ya no existe.');
            }
            try {
                const filasOp = operarios.map((o) => { const emp = empleados.find((x) => norm(x.nombre) === norm(o.nombre)); return { parte_id: parteId, operario_nombre: emp ? emp.nombre : o.nombre, operario_id: emp ? emp.id : null, horas: o.horas }; });
                insertadosOp = (await exigir(db().from('partes_operarios').insert(filasOp).select('id'), 'No se pudieron guardar los operarios.')).map((x) => x.id);
                if (items.length) insertadosMat = (await exigir(db().from('partes_materiales').insert(items.map((it) => ({ ...it, parte_id: parteId }))).select('id'), 'No se pudo guardar el material.')).map((x) => x.id);
            } catch (ex) {
                // Se deshace lo insertado para no dejar un parte a medias.
                if (idNuevo) { try { await db().from('partes_trabajo').delete().eq('id', idNuevo); } catch (x) { /* sin más */ } }
                else {
                    if (insertadosOp.length) { try { await db().from('partes_operarios').delete().in('id', insertadosOp); } catch (x) { /* sin más */ } }
                    if (insertadosMat.length) { try { await db().from('partes_materiales').delete().in('id', insertadosMat); } catch (x) { /* sin más */ } }
                }
                throw ex;
            }
            if (modo === 'editar') {
                const viejosOp = ops(actual).map((o) => o.id), viejosMat = mats(actual).map((m) => m.id);
                if (viejosOp.length) await exigir(db().from('partes_operarios').delete().in('id', viejosOp).select('id'), 'No se pudieron sustituir los operarios anteriores.');
                if (viejosMat.length) await exigir(db().from('partes_materiales').delete().in('id', viejosMat).select('id'), 'No se pudo sustituir el material anterior.');
            }
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
        const p = partes.find((x) => x.id === id);
        if (!p || !puedeEditar(p)) return;
        if (!confirm(`¿Eliminar el parte del ${fechaES(p.fecha)} de «${p.cliente || 'sin cliente'} · ${p.obra || 'sin obra'}»? Esta acción no se puede deshacer.`)) return;
        try {
            await exigir(db().from('partes_trabajo').delete().eq('id', id).select('id'), 'No se pudo eliminar: el parte está bloqueado, no tienes permiso o ya no existe.');
            cerrarModal();
            await cargar();
        } catch (ex) { alert('No se pudo eliminar: ' + mensajeError(ex)); cargar(); }
    }

    // ---------- PDF ----------
    function htmlPdf(p, imgFirma) {
        const td = 'padding:6px 8px;border:1px solid #cbd5e1';
        return `<div>
            <h1 style="font-size:20px;margin:0 0 4px">Parte de trabajo</h1>
            <p style="margin:0 0 14px;color:#475569">Fecha: ${esc(fechaES(p.fecha))}${p.bloqueado ? ' · Bloqueado' : ''}</p>
            <p style="margin:2px 0"><strong>Cliente:</strong> ${esc(p.cliente)}</p>
            <p style="margin:2px 0"><strong>Obra:</strong> ${esc(p.obra)}</p>
            <p style="margin:2px 0"><strong>Dirección:</strong> ${esc(p.direccion || '—')}</p>
            <p style="margin:2px 0 14px"><strong>Localidad:</strong> ${esc(p.localidad || '—')}</p>
            <h2 style="font-size:14px;margin:0 0 6px">Operarios</h2>
            <table style="border-collapse:collapse;width:100%;margin-bottom:14px"><thead><tr style="background:#e2e8f0"><th style="${td};text-align:left">Operario</th><th style="${td};text-align:left;width:100px">Horas</th></tr></thead><tbody>${ops(p).map((o) => `<tr><td style="${td}">${esc(o.operario_nombre)}</td><td style="${td}">${esc(o.horas || '')}</td></tr>`).join('')}</tbody></table>
            <h2 style="font-size:14px;margin:0 0 6px">Trabajo realizado</h2>
            <p style="margin:0 0 14px;white-space:pre-wrap">${esc(p.detalle_trabajo || '—')}</p>
            ${mats(p).length ? `<h2 style="font-size:14px;margin:0 0 6px">Material utilizado</h2>
            <table style="border-collapse:collapse;width:100%;margin-bottom:14px"><thead><tr style="background:#e2e8f0"><th style="${td};text-align:right;width:60px">Cant.</th><th style="${td};text-align:left">Material</th><th style="${td};text-align:left">Referencia</th></tr></thead><tbody>${mats(p).map((m) => `<tr><td style="${td};text-align:right">${esc(cant(m.unidades))}</td><td style="${td}">${esc(m.material)}</td><td style="${td}">${esc(m.referencia || '')}</td></tr>`).join('')}</tbody></table>` : ''}
            ${imgFirma ? `<h2 style="font-size:14px;margin:0 0 6px">Firma del cliente</h2><img src="${esc(imgFirma)}" alt="Firma" style="max-height:120px;max-width:300px;border:1px solid #cbd5e1">` : ''}
            <p style="margin:16px 0 0;font-size:11px;color:#64748b">Creado por ${esc(p.created_by || 'desconocido')} · ${esc(fechaHora(p.created_at))}${modificado(p) ? `<br>Modificado por ${esc(p.updated_by || 'desconocido')} · ${esc(fechaHora(p.updated_at))}` : ''}${p.bloqueado ? `<br>Bloqueado por ${esc(p.bloqueado_por || 'un administrador')}` : ''}</p>
        </div>`;
    }

    async function descargarPdf(id) {
        const p = partes.find((x) => x.id === id);
        if (!p) return;
        let imgFirma = '';
        try { imgFirma = await cargarFirma(id); } catch (ex) { /* sin firma */ }
        const nombre = window.BomiPdf.nombreSeguro(['parte', p.fecha, p.cliente, p.obra], 90);
        try { await window.BomiPdf.generar(htmlPdf(p, imgFirma), nombre); }
        catch (ex) { alert('No se pudo crear el PDF: ' + mensajeError(ex)); }
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-partes').innerHTML = `
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">assignment</span> Partes</h2>
                <span id="partes-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span>
            </div>
            <div class="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-full p-1" role="group" aria-label="Qué partes ver">
                <button type="button" data-filtro="todos" class="flex-1 py-2 rounded-full text-sm font-medium">Todos los partes</button>
                <button type="button" data-filtro="mios" class="flex-1 py-2 rounded-full text-sm font-medium">Mis partes</button>
            </div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-partes" aria-label="Buscar partes" placeholder="Buscar cliente, obra, dirección, localidad, operario..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="partes-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-nuevo-parte" aria-label="Nuevo parte" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">add</span></button>`;

        document.body.insertAdjacentHTML('beforeend', `
            <datalist id="par-clientes-dl"></datalist>
            <datalist id="par-obras-dl"></datalist>
            <datalist id="par-operarios-dl"></datalist>
            <datalist id="par-materiales-dl"></datalist>
            <datalist id="par-referencias-dl"></datalist>
            <div id="modal-parte" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-parte-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="modal-parte-titulo" class="font-semibold text-lg"></h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-parte" class="flex flex-col gap-4 p-6 overflow-y-auto"></form>
                </div>
            </div>
            <div id="modal-firma" class="hidden fixed inset-0 z-[60] justify-center items-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label="Firma del cliente">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl flex flex-col gap-3 p-5">
                    <h3 class="font-semibold">Firma del cliente</h3>
                    <canvas id="firma-canvas" style="touch-action:none;width:100%;height:180px" class="bg-white rounded-xl border border-slate-300 dark:border-zinc-600"></canvas>
                    <p id="firma-error" class="hidden text-sm text-red-600 dark:text-red-400" role="alert"></p>
                    <div class="flex justify-between gap-2">
                        <button type="button" data-firma="borrar" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">ink_eraser</span> Borrar</button>
                        <div class="flex gap-2">
                            <button type="button" data-firma="cancelar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                            <button type="button" data-firma="aceptar" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-medium">Aceptar</button>
                        </div>
                    </div>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        const vista = document.getElementById('view-partes');
        vista.addEventListener('click', (e) => {
            const fl = e.target.closest('[data-filtro]');
            if (fl) {
                const nuevo = fl.dataset.filtro === 'mios';
                if (nuevo !== soloMios) { soloMios = nuevo; guardarSoloMios(nuevo); }
                pintarInterruptor(); pintarLista();
                return;
            }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const { accion, id } = btn.dataset;
            if (accion === 'ver') abrirVista(id);
            else if (accion === 'editar') abrirFormulario('editar', id);
            else if (accion === 'eliminar') eliminar(id);
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('fab-nuevo-parte').addEventListener('click', () => abrirFormulario('nuevo'));
        document.getElementById('search-partes').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-parte');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const a = btn.dataset.accion, id = btn.dataset.id;
            if (a === 'cerrar') cerrarModal();
            else if (a === 'añadir-operario') {
                document.getElementById('par-operarios').insertAdjacentHTML('beforeend', htmlOperario(null));
                const fs = document.querySelectorAll('#par-operarios [data-operario]');
                fs[fs.length - 1].querySelector('[data-campo=nombre]').focus();
            } else if (a === 'quitar-operario') {
                const fs = document.querySelectorAll('#par-operarios [data-operario]');
                const f = btn.closest('[data-operario]');
                if (fs.length > 1) f.remove(); else f.querySelectorAll('input').forEach((i) => { i.value = ''; });
            } else if (a === 'añadir-material') {
                document.getElementById('par-materiales').insertAdjacentHTML('beforeend', htmlMaterial(null));
                const fs = document.querySelectorAll('#par-materiales [data-material]');
                fs[fs.length - 1].querySelector('[data-campo=cantidad]').focus();
            } else if (a === 'quitar-material') btn.closest('[data-material]').remove();
            else if (a === 'dictar') alternarDictado();
            else if (a === 'firmar') abrirFirma();
            else if (a === 'quitar-firma') { firma = { url: '', quitada: true, cambiada: false }; pintarFirmaForm(); }
            else if (a === 'editar-desde-ver') { cerrarModal(); abrirFormulario('editar', id); }
            else if (a === 'eliminar-desde-ver') eliminar(id);
            else if (a === 'pdf') descargarPdf(id);
            else if (a === 'bloquear') bloquear(id);
        });
        const alCambiar = (e) => {
            const t = e.target;
            if (t.id === 'par-cliente') sincronizar('cliente');
            else if (t.id === 'par-obra') sincronizar('obra');
            else if (t.dataset && t.dataset.campo === 'material') materialCambiado(t);
            else if (t.dataset && t.dataset.campo === 'referencia') referenciaCambiada(t);
        };
        modal.addEventListener('input', alCambiar);
        modal.addEventListener('change', alCambiar);
        document.getElementById('form-parte').addEventListener('submit', enviar);
        enlazarFirma();
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (document.getElementById('modal-firma').classList.contains('flex')) cerrarFirma();
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

    window.BomiPartes = {
        abrir() { iniciar(); return cargar(); },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
    };
})();
