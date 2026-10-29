// js/modules/bitacora.js
// Bitácora: registros de información de obra (notas por escrito o dictadas + pizarra opcional).
// Script clásico: expone window.BomiBitacora. Depende de `supabaseClient`, `window.currentUserProfile`
// y (para la pizarra) window.BomiPizarra.
(function () {
    'use strict';

    const INPUT_BASE = 'bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const INPUT = 'w-full ' + INPUT_BASE;
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_DANGER = 'p-1.5 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-full font-medium flex items-center gap-1.5';
    const LIMITE = 500;
    const COLUMNAS = 'id, cliente_id, obra_id, cliente, obra, direccion, localidad, notas, imagen_pizarra, pizarra_data, created_by, updated_by, created_at, updated_at';

    let registros = [];
    let clientes = [];          // para autocompletar: { id, nombre, obras: [{ id, nombre, direccion, localidad }] }
    let clientesViejos = true;
    let iniciado = false;
    let busqueda = '';
    let guardando = false;
    let modo = null;            // 'nuevo' | 'editar' | 'ver'
    let actual = null;          // registro en edición / visualización
    let pizarra = null;         // { url, nueva, pend, vistaPrevia, quitada } estado de la pizarra en el formulario
    let reconocimiento = null;
    let escuchando = false;

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
    const fechaHora = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    // Solo se pintan pizarras de R2 ("r2:..."), imágenes de almacenamiento (https) o PNG incrustados de registros antiguos.
    const nube = () => window.BomiPizarraNube;
    const imagenSegura = (u) => ((nube() && nube().esNube(u)) || /^https:\/\//.test(u || '') || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(u || '')) ? u : '';
    const imgPizarra = (v, clases) => (nube() ? nube().img(v, clases) : `<img src="${esc(v)}" alt="Pizarra" class="${esc(clases)}">`);
    const rellenarPizarras = (raiz) => { if (nube()) nube().rellenar(raiz); };
    const imagenDe = (r) => imagenSegura(r.imagen_pizarra) || imagenSegura(r.pizarra_data);
    const modificado = (r) => !!r.updated_at && !!r.created_at && (new Date(r.updated_at) - new Date(r.created_at) > 5000);

    function mensajeError(ex) {
        if (window.BomiOffline && window.BomiOffline.esRed(ex)) return window.BomiOffline.mensaje(ex);
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        if (ex && ex.code === '23503') return 'Hay registros que dependen de este elemento.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }

    async function exigir(consulta, mensajeSinFilas) {
        const { data, error } = await consulta;
        if (error) throw error;
        if (mensajeSinFilas && (!data || !data.length)) throw new Error(mensajeSinFilas);
        return data;
    }

    // ---------- Búsqueda: cliente, obra, dirección, localidad, notas y creador ----------
    const texto = (r) => [r.cliente, r.obra, r.direccion, r.localidad, r.notas, r.created_by].join(' ');
    function filtrar() {
        const tokens = norm(busqueda).split(' ').filter(Boolean);
        if (!tokens.length) return registros;
        return registros.filter((r) => { const t = norm(texto(r)); return tokens.every((k) => t.includes(k)); });
    }

    // ---------- Pintado de la lista ----------
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;
    const btnAccion = (accion, id, icono, etiqueta, clase = BTN_ICON) =>
        `<button type="button" data-accion="${accion}" data-id="${esc(id)}" aria-label="${esc(etiqueta)}" title="${esc(etiqueta)}" class="${clase}"><span class="material-symbols-outlined text-[20px]">${icono}</span></button>`;

    function direccionHtml(dir, loc) {
        const txt = [dir, loc].filter(Boolean).join(', ');
        if (!txt) return '';
        return `<a href="${esc(mapsHref(dir, loc))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-start gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"><span class="material-symbols-outlined text-[16px] mt-0.5">location_on</span><span>${esc(txt)}</span></a>`;
    }

    function autoriaHtml(r, detallada) {
        const creado = `Creado por <strong>${esc(r.created_by || 'desconocido')}</strong> · ${esc(fechaHora(r.created_at))}`;
        const mod = modificado(r) ? `Modificado por <strong>${esc(r.updated_by || 'desconocido')}</strong> · ${esc(fechaHora(r.updated_at))}` : '';
        return detallada
            ? `<p class="text-xs text-slate-500">${creado}</p>${mod ? `<p class="text-xs text-slate-500">${mod}</p>` : ''}`
            : `<p class="text-xs text-slate-500">${creado}${mod ? `<br>${mod}` : ''}</p>`;
    }

    function htmlRegistro(r) {
        const img = imagenDe(r);
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <h3 class="font-bold text-base break-words">${esc(r.cliente || 'Sin cliente')}</h3>
                    <p class="text-sm font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(r.obra || 'Sin obra')}</span></p>
                    ${direccionHtml(r.direccion, r.localidad)}
                </div>
                <div class="flex gap-1 shrink-0">
                    ${btnAccion('ver', r.id, 'visibility', 'Ver registro')}
                    ${btnAccion('editar', r.id, 'edit', 'Editar registro')}
                    ${btnAccion('eliminar', r.id, 'delete', 'Eliminar registro', BTN_DANGER)}
                </div>
            </div>
            ${r.notas ? `<p class="text-sm whitespace-pre-wrap break-words" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(r.notas)}</p>` : ''}
            ${img ? `<div class="flex items-center gap-2 text-xs text-slate-500">${imgPizarra(img, 'h-14 w-20 object-contain bg-white rounded-lg border border-slate-200 dark:border-zinc-700')}<span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">draw</span> Incluye pizarra</span></div>` : ''}
            ${autoriaHtml(r, false)}
        </article>`;
    }

    function pintarLista() {
        const cont = document.getElementById('bitacora-lista');
        const badge = document.getElementById('bitacora-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'registro' : 'registros'}`;
        if (!registros.length) { cont.innerHTML = aviso('Aún no hay registros. Pulsa + para añadir el primero.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron resultados.'); return; }
        cont.innerHTML = lista.map(htmlRegistro).join('');
        rellenarPizarras(cont);
    }

    // ---------- Carga ----------
    async function cargar() {
        const cont = document.getElementById('bitacora-lista');
        if (cont && !registros.length) cont.innerHTML = spinner;
        const { data, error } = await db().from('bitacora').select(COLUMNAS).order('created_at', { ascending: false }).limit(LIMITE);
        if (error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar la bitácora: ${esc(error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        registros = data || [];
        pintarLista();
        window.dispatchEvent(new CustomEvent('bomiRegistrosCambiados', { detail: { tipo: 'bitacora' } }));
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

    // ---------- Formulario ----------
    function htmlFormulario(r) {
        const img = r ? imagenDe(r) : '';
        return `
            <div class="flex flex-col gap-1">
                <label for="b-cliente" class="text-xs font-medium">Cliente</label>
                <input id="b-cliente" type="text" required autocomplete="off" value="${esc(r?.cliente)}" placeholder="Elige uno existente o escribe uno nuevo" class="${INPUT}">
            </div>
            <div class="flex flex-col gap-1">
                <label for="b-obra" class="text-xs font-medium">Obra</label>
                <input id="b-obra" type="text" required autocomplete="off" value="${esc(r?.obra)}" placeholder="Elige una obra del cliente o escribe una nueva" class="${INPUT}">
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="b-direccion" class="text-xs font-medium">Dirección</label><input id="b-direccion" type="text" autocomplete="off" value="${esc(r?.direccion)}" class="${INPUT} read-only:opacity-70"></div>
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="b-localidad" class="text-xs font-medium">Localidad</label><input id="b-localidad" type="text" autocomplete="off" value="${esc(r?.localidad)}" class="${INPUT} read-only:opacity-70"></div>
            </div>
            <p id="b-hint" class="hidden text-xs text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl p-3"></p>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center">
                    <label for="b-notas" class="text-xs font-medium">Notas / información</label>
                    <button type="button" id="b-dictar" data-accion="dictar" class="${BTN_SEC} !py-1 !px-3 text-xs"><span class="material-symbols-outlined text-[16px]">mic</span> <span id="b-dictar-txt">Dictar</span></button>
                </div>
                <textarea id="b-notas" rows="6" class="${INPUT}" placeholder="Escribe o dicta la información...">${esc(r?.notas)}</textarea>
                <p id="b-dictado-aviso" class="hidden text-xs text-slate-500"></p>
            </div>
            <div class="flex flex-col gap-2">
                <span class="text-xs font-medium">Pizarra <span class="font-normal text-slate-500">(opcional)</span></span>
                <div id="b-pizarra" class="flex flex-col gap-2 items-start"></div>
            </div>
            <p id="b-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="b-guardar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-full font-medium">Guardar</button>
            </div>`;
    }

    function pintarPizarraForm() {
        const cont = document.getElementById('b-pizarra');
        if (!cont) return;
        const img = pizarra.nueva ? pizarra.vistaPrevia : (pizarra.quitada ? '' : pizarra.url);
        cont.innerHTML = `
            ${img ? imgPizarra(img, 'max-h-48 max-w-full object-contain bg-white rounded-xl border border-slate-200 dark:border-zinc-700') : ''}
            <div class="flex flex-wrap gap-2">
                <button type="button" data-accion="pizarra" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">draw</span> ${img ? 'Editar pizarra' : 'Añadir pizarra'}</button>
                ${img ? `<button type="button" data-accion="quitar-pizarra" class="${BTN_SEC} text-red-600 dark:text-red-400"><span class="material-symbols-outlined text-[18px]">delete</span> Quitar</button>` : ''}
            </div>`;
        rellenarPizarras(cont);
    }

    function actualizarDatalists() {
        const dlc = document.getElementById('bit-clientes-dl');
        if (dlc) dlc.innerHTML = clientes.map((c) => `<option value="${esc(c.nombre)}"></option>`).join('');
        const dlo = document.getElementById('bit-obras-dl');
        if (!dlo) return;
        const cli = clientePorNombre(val('b-cliente'));
        const obras = cli ? cli.obras : (val('b-cliente') ? [] : clientes.flatMap((c) => c.obras));
        const vistos = new Set();
        dlo.innerHTML = obras.filter((o) => { const k = norm(o.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; })
            .map((o) => `<option value="${esc(o.nombre)}"></option>`).join('');
    }

    // Mantiene coherentes cliente, obra, dirección y localidad mientras se escribe.
    let obraAutorrellena = false;
    function sincronizar(origen) {
        const inCli = document.getElementById('b-cliente');
        const inObra = document.getElementById('b-obra');
        const inDir = document.getElementById('b-direccion');
        const inLoc = document.getElementById('b-localidad');
        const hint = document.getElementById('b-hint');
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
        if (origen === 'cliente') actualizarDatalists();
        if (origen === 'obra' && cli) actualizarDatalists();

        let msg = '';
        if (obraAmbigua) msg = 'Hay varias obras con ese nombre en distintos clientes: elige primero el cliente.';
        const nCli = norm(inCli.value);
        if (obraAmbigua) { /* ya avisado */ } else if (nCli && !cli) msg = `«${inCli.value.trim()}» es un cliente nuevo: se creará junto con esta obra. Rellena dirección y localidad.`;
        else if (cli && norm(obraTxt) && !obra) msg = `Obra nueva en «${cli.nombre}»: se creará con esta dirección y localidad.`;
        else if (cli && obra) msg = `Obra existente de «${cli.nombre}»: se usan su dirección y localidad.`;
        if (hint) { hint.textContent = msg; hint.classList.toggle('hidden', !msg); }
    }

    // ---------- Dictado por voz ----------
    function soporteDictado() { return window.SpeechRecognition || window.webkitSpeechRecognition; }

    function pintarDictado() {
        const t = document.getElementById('b-dictar-txt');
        const b = document.getElementById('b-dictar');
        if (!t || !b) return;
        t.textContent = escuchando ? 'Parar' : 'Dictar';
        b.classList.toggle('animate-pulse', escuchando);
        const ic = b.querySelector('.material-symbols-outlined');
        if (ic) ic.textContent = escuchando ? 'stop_circle' : 'mic';
    }

    function pararDictado() {
        if (reconocimiento) { try { reconocimiento.onend = null; reconocimiento.stop(); } catch (e) { /* ya parado */ } }
        reconocimiento = null;
        escuchando = false;
        pintarDictado();
    }

    function avisoDictado(txt) {
        const p = document.getElementById('b-dictado-aviso');
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
        rec.lang = 'es-ES';
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (ev) => {
            const area = document.getElementById('b-notas');
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

    // ---------- Modal ----------
    function mostrarModal(titulo) {
        document.getElementById('modal-bitacora-titulo').textContent = titulo;
        const m = document.getElementById('modal-bitacora');
        m.classList.remove('hidden');
        m.classList.add('flex');
    }

    function cerrarModal() {
        pararDictado();
        const m = document.getElementById('modal-bitacora');
        if (!m) return;
        m.classList.add('hidden');
        m.classList.remove('flex');
        modo = null; actual = null; pizarra = null; obraAutorrellena = false;
    }

    async function abrirFormulario(m, id, datos) {
        const r = id ? registros.find((x) => x.id === id) : null;
        if (m === 'editar' && !r) return;
        try { if (clientesViejos) await cargarClientes(); } catch (ex) { alert('No se pudieron cargar los clientes: ' + mensajeError(ex)); return; }
        modo = m;
        actual = r;
        obraAutorrellena = false;
        pizarra = { url: r ? imagenDe(r) : '', nueva: false, pend: null, vistaPrevia: '', quitada: false };
        const form = document.getElementById('form-bitacora');
        form.innerHTML = htmlFormulario(r);
        mostrarModal(m === 'nuevo' ? 'Nuevo registro' : 'Editar registro');
        actualizarDatalists();
        pintarPizarraForm();
        if (!r && datos) { // nuevo registro con los datos de otro (p. ej. una tarea del Diario)
            document.getElementById('b-cliente').value = datos.cliente || '';
            document.getElementById('b-obra').value = datos.obra || '';
            document.getElementById('b-direccion').value = datos.direccion || '';
            document.getElementById('b-localidad').value = datos.localidad || '';
            document.getElementById('b-notas').value = datos.notas || '';
        }
        if (r || datos) {
            // Al editar se respeta lo guardado; solo se bloquean dirección/localidad si coinciden con una obra existente.
            const base = r || datos;
            const cli = clientePorNombre(base.cliente);
            const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(base.obra));
            if (obra) { document.getElementById('b-direccion').readOnly = true; document.getElementById('b-localidad').readOnly = true; obraAutorrellena = true; }
        }
        sincronizar('inicio');
        // style en vez de la clase hidden: el botón ya trae "flex" y ambas clases competirían.
        if (!soporteDictado()) document.getElementById('b-dictar').style.display = 'none';
        document.getElementById(r ? 'b-notas' : 'b-cliente').focus();
    }

    function abrirVista(id) {
        const r = registros.find((x) => x.id === id);
        if (!r) return;
        modo = 'ver';
        actual = r;
        const img = imagenDe(r);
        document.getElementById('form-bitacora').innerHTML = `
            <div class="flex flex-col gap-1">
                <h3 class="font-bold text-lg break-words">${esc(r.cliente || 'Sin cliente')}</h3>
                <p class="font-semibold flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(r.obra || 'Sin obra')}</span></p>
                ${direccionHtml(r.direccion, r.localidad)}
            </div>
            <div class="flex flex-col gap-1"><span class="text-xs font-medium">Notas</span>${r.notas ? `<p class="text-sm whitespace-pre-wrap break-words">${esc(r.notas)}</p>` : '<p class="text-sm text-slate-500">Sin notas.</p>'}</div>
            ${img ? `<div class="flex flex-col gap-1"><span class="text-xs font-medium">Pizarra</span>${imgPizarra(img, 'w-full object-contain bg-white rounded-xl border border-slate-200 dark:border-zinc-700')}</div>` : ''}
            <div class="flex flex-col gap-0.5 border-t border-slate-200 dark:border-zinc-800 pt-3">${autoriaHtml(r, true)}</div>
            <div class="flex justify-end gap-3">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cerrar</button>
                <button type="button" data-accion="pdf" data-id="${esc(r.id)}" class="${BTN_SEC}"><span class="material-symbols-outlined text-[18px]">picture_as_pdf</span> PDF</button>
                <button type="button" data-accion="editar-desde-ver" data-id="${esc(r.id)}" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">edit</span> Editar</button>
            </div>`;
        mostrarModal('Registro de bitácora');
        rellenarPizarras(document.getElementById('form-bitacora'));
    }

    // ---------- PDF ----------
    function itemsPdf(r) {
        const it = [
            { t: 'title', text: 'Registro de bitácora', sub: 'Fecha: ' + fechaHora(r.created_at).split(',')[0] },
            { t: 'kv', label: 'Cliente', value: r.cliente },
            { t: 'kv', label: 'Obra', value: r.obra },
            { t: 'kv', label: 'Dirección', value: r.direccion || '—' },
            { t: 'kv', label: 'Localidad', value: r.localidad || '—' },
            { t: 'h', text: 'Notas' },
            { t: 'p', text: r.notas || 'Sin notas.' },
        ];
        const img = imagenDe(r);
        if (img) { it.push({ t: 'h', text: 'Pizarra' }); it.push({ t: 'img', src: img, maxW: 500, maxH: 380 }); }
        it.push({ t: 'note', text: 'Creado por ' + (r.created_by || 'desconocido') + ' · ' + fechaHora(r.created_at)
            + (modificado(r) ? '\nModificado por ' + (r.updated_by || 'desconocido') + ' · ' + fechaHora(r.updated_at) : '') });
        return it;
    }
    async function descargarPdf(id) {
        const r = registros.find((x) => x.id === id);
        if (!r) return;
        const nombre = window.BomiPdf.nombreSeguro(['bitacora', r.cliente, r.obra], 80);
        try { await window.BomiPdf.generar(itemsPdf(r), nombre); }
        catch (ex) { alert('No se pudo crear el PDF: ' + mensajeError(ex)); }
    }

    // ---------- Guardado ----------
    // Decide qué hay que crear (cliente y/o obra nuevos) sin tocar la base de datos: devuelve los pasos a ejecutar.
    function resolverObra(f) {
        const cli = clientePorNombre(f.cliente);
        const obra = cli && cli.obras.find((o) => norm(o.nombre) === norm(f.obra));
        if (obra) return { clienteId: cli.id, obraId: obra.id, cliente: cli.nombre, obra: obra.nombre, direccion: obra.direccion, localidad: obra.localidad, creados: false, pasos: [] };
        if (!f.direccion || !f.localidad) throw new Error('Para una obra nueva hay que indicar dirección y localidad.');
        const O = window.BomiOffline;
        const pasos = [];
        let clienteId = cli ? cli.id : null;
        if (!clienteId) {
            clienteId = O.uuid();
            pasos.push({ k: 'insert', tabla: 'clientes', filas: [{ id: clienteId, nombre_cliente: f.cliente, nombre: f.cliente }] });
        }
        const obraId = O.uuid();
        pasos.push({ k: 'insert', tabla: 'obras', filas: [{ id: obraId, cliente_id: clienteId, nombre: f.obra, direccion: f.direccion, localidad: f.localidad }] });
        return { clienteId, obraId, cliente: f.cliente, obra: f.obra, direccion: f.direccion, localidad: f.localidad, creados: true, pasos };
    }

    async function enviar(e) {
        e.preventDefault();
        if (guardando || (modo !== 'nuevo' && modo !== 'editar')) return;
        const err = document.getElementById('b-error');
        const btn = document.getElementById('b-guardar');
        const f = { cliente: val('b-cliente'), obra: val('b-obra'), direccion: val('b-direccion'), localidad: val('b-localidad'), notas: val('b-notas') };
        err.classList.add('hidden');
        const hayPizarra = pizarra.nueva ? !!pizarra.pend : (!pizarra.quitada && !!pizarra.url);
        if (!f.cliente) return fallo(err, 'Indica el cliente.');
        if (!f.obra) return fallo(err, 'Indica la obra.');
        if (!f.notas && !hayPizarra) return fallo(err, 'Escribe alguna nota o añade una pizarra.');
        pararDictado();
        guardando = true;
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        const O = window.BomiOffline;
        const quien = nombreUsuario();
        // PDF con lo que hay escrito (por si no se puede guardar).
        const pdfActual = () => ({
            items: itemsPdf({ cliente: f.cliente, obra: f.obra, direccion: f.direccion, localidad: f.localidad, notas: f.notas, created_by: quien, created_at: new Date().toISOString(),
                imagen_pizarra: pizarra.nueva ? pizarra.vistaPrevia : (pizarra.quitada ? '' : pizarra.url) }),
            nombre: window.BomiPdf.nombreSeguro(['bitacora', f.cliente, f.obra], 80),
        });
        try {
            // Al editar, si no se tocó cliente/obra/dirección/localidad se conservan tal cual (también en registros antiguos).
            const igual = modo === 'editar' && ['cliente', 'obra', 'direccion', 'localidad'].every((k) => norm(f[k]) === norm(actual[k]));
            const datos = igual ? { clienteId: actual.cliente_id, obraId: actual.obra_id, cliente: actual.cliente, obra: actual.obra, direccion: actual.direccion, localidad: actual.localidad, creados: false, pasos: [] } : resolverObra(f);
            const creados = datos.creados;
            const fila = { cliente_id: datos.clienteId, obra_id: datos.obraId, cliente: datos.cliente, obra: datos.obra, direccion: datos.direccion, localidad: datos.localidad, notas: f.notas || null };
            const pasos = [...datos.pasos];
            const registroId = modo === 'nuevo' ? O.uuid() : actual.id;
            if (pizarra.nueva && pizarra.pend) {
                // La pizarra va a R2 (con copia en Drive) antes que el registro que la usa.
                const sp = nube().plan(pizarra.pend, { origen: 'bitacora', registroId, cliente: datos.cliente, obra: datos.obra, clienteId: datos.clienteId, obraId: datos.obraId });
                pasos.push(...sp.pasos); fila.imagen_pizarra = sp.valor; fila.pizarra_data = null;
            }
            else if (pizarra.quitada) { fila.imagen_pizarra = null; fila.pizarra_data = null; }

            if (modo === 'nuevo') {
                // Un registro nuevo se puede guardar sin conexión: queda en el móvil y se envía solo.
                pasos.push({ k: 'insert', tabla: 'bitacora', deshacer: true, filas: [{ id: registroId, ...fila, created_by: quien, updated_by: quien }] });
                const r = await O.guardar({ tipo: 'bitacora', etiqueta: `Bitácora · ${datos.cliente} · ${datos.obra}`, pasos, clientes: creados, pdf: pdfActual() });
                cerrarModal();
                if (r.estado === 'enviado') {
                    await cargar();
                    if (creados) { clientesViejos = true; window.dispatchEvent(new CustomEvent('clientesActualizados')); }
                }
                return;
            }

            // Editar (requiere conexión).
            if (pasos.length) await O.correr(pasos);
            await exigir(db().from('bitacora').update({ ...fila, updated_by: quien, updated_at: new Date().toISOString() }).eq('id', actual.id).select('id'), 'No se pudo guardar: no tienes permiso o el registro ya no existe.');
            cerrarModal();
            await cargar();
            if (creados) { clientesViejos = true; window.dispatchEvent(new CustomEvent('clientesActualizados')); }
        } catch (ex) {
            O.falloConPdf(err, ex, pdfActual, modo === 'editar' && O.esRed(ex) ? 'Los cambios no se han guardado. Vuelve a pulsar Guardar cuando tengas conexión.' : '');
            clientesViejos = true;
        } finally {
            guardando = false;
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    function fallo(el, txt) { el.textContent = txt; el.classList.remove('hidden'); }

    async function eliminar(id) {
        const r = registros.find((x) => x.id === id);
        if (!r) return;
        if (!confirm(`¿Eliminar el registro de «${r.cliente || 'sin cliente'} · ${r.obra || 'sin obra'}»? Esta acción no se puede deshacer.`)) return;
        try {
            await exigir(db().from('bitacora').delete().eq('id', id).select('id'), 'No se pudo eliminar: no tienes permiso o el registro ya no existe.');
            await cargar();
        } catch (ex) {
            alert('No se pudo eliminar: ' + mensajeError(ex));
            cargar();
        }
    }

    let abriendoPizarra = false;
    async function abrirPizarra() {
        if (!window.BomiPizarra || !nube()) { alert('La pizarra no está disponible.'); return; }
        if (abriendoPizarra) return;
        pararDictado();
        // Qué se abre: lo dibujado sin guardar todavía, la pizarra guardada (foto de fondo + líneas) o una en blanco.
        let previo = { claveFondo: null, fondoCambiado: false };
        let abrir = {};
        abriendoPizarra = true;
        try {
            if (pizarra.nueva && pizarra.pend) {
                previo = pizarra.pend;
                abrir = { fondo: previo.fondoBlob ? URL.createObjectURL(previo.fondoBlob) : '', trazos: previo.trazos };
            } else if (!pizarra.quitada && pizarra.url) {
                const e = await nube().paraEditar(pizarra.url);
                previo = { claveFondo: e.claveFondo, fondoCambiado: false };
                abrir = { fondo: e.fondo, trazos: e.trazos };
            }
        } catch (ex) {
            alert('No se pudo abrir la pizarra guardada: ' + mensajeError(ex) + '\nPara editarla hace falta conexión.');
            return;
        } finally { abriendoPizarra = false; }
        const res = await window.BomiPizarra.abrir(abrir);
        if (/^blob:/.test(abrir.fondo || '')) URL.revokeObjectURL(abrir.fondo);
        if (!res) return;
        if (res.vacia) { pizarra = { ...pizarra, nueva: false, pend: null, vistaPrevia: '', quitada: true }; }
        else { pizarra = { ...pizarra, nueva: true, pend: nube().pendiente(res, previo), vistaPrevia: await blobADataUrl(res.blob), quitada: false }; }
        pintarPizarraForm();
    }

    const blobADataUrl = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });

    // ---------- Pestañas: bitácora escrita / fotográfica (la elección se recuerda en este móvil) ----------
    const CLAVE_PESTANA = 'bomi-bitacora-pestana';
    let pestana = 'escrita';
    try { if (localStorage.getItem(CLAVE_PESTANA) === 'fotos') pestana = 'fotos'; } catch (e) { /* sin almacenamiento */ }

    function cambiarPestana(p, recordar) {
        pestana = p === 'fotos' && window.BomiFotos ? 'fotos' : 'escrita';
        if (recordar) { try { localStorage.setItem(CLAVE_PESTANA, pestana); } catch (e) { /* sin almacenamiento */ } }
        const fotos = pestana === 'fotos';
        document.getElementById('bitacora-escrita').classList.toggle('hidden', fotos);
        const cf = document.getElementById('bitacora-fotos');
        cf.classList.toggle('hidden', !fotos);
        cf.classList.toggle('flex', fotos);
        document.querySelectorAll('#view-bitacora [data-pestana]').forEach((b) => {
            const act = b.dataset.pestana === pestana;
            b.className = 'flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ' + (act ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300');
            b.setAttribute('aria-pressed', String(act));
        });
        if (fotos) { window.BomiFotos.montar(cf); return window.BomiFotos.abrir(); }
        return cargar();
    }

    // ---------- Montaje ----------
    function construirVista() {
        document.getElementById('view-bitacora').innerHTML = `
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">menu_book</span> Bitácora</h2>
            </div>
            <div class="flex gap-1 bg-slate-100 dark:bg-zinc-800 rounded-full p-1" role="group" aria-label="Qué bitácora ver">
                <button type="button" data-pestana="escrita" class="flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]">edit_note</span> Escrita</button>
                <button type="button" data-pestana="fotos" class="flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5"><span class="material-symbols-outlined text-[18px]">photo_camera</span> Fotográfica</button>
            </div>
            <div id="bitacora-escrita" class="flex flex-col gap-4">
            <div class="flex justify-end -mt-2"><span id="bitacora-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span></div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-bitacora" aria-label="Buscar en la bitácora" placeholder="Buscar cliente, obra, dirección, localidad, notas, creador..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="bitacora-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-new-bitacora" aria-label="Añadir registro" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">add</span></button>
            </div>
            <div id="bitacora-fotos" class="hidden flex-col gap-4"></div>`;

        document.body.insertAdjacentHTML('beforeend', `
            <datalist id="bit-clientes-dl"></datalist>
            <datalist id="bit-obras-dl"></datalist>
            <div id="modal-bitacora" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-bitacora-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="modal-bitacora-titulo" class="font-semibold text-lg"></h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-bitacora" class="flex flex-col gap-4 p-6 overflow-y-auto"></form>
                </div>
            </div>`);
    }

    function enlazarEventos() {
        document.getElementById('view-bitacora').addEventListener('click', (e) => {
            const pb = e.target.closest('[data-pestana]');
            if (pb) { cambiarPestana(pb.dataset.pestana, true); return; }
            const btn = e.target.closest('#bitacora-escrita [data-accion]');
            if (!btn) return;
            const { accion, id } = btn.dataset;
            if (accion === 'ver') abrirVista(id);
            else if (accion === 'editar') abrirFormulario('editar', id);
            else if (accion === 'eliminar') eliminar(id);
            else if (accion === 'reintentar') cargar();
        });
        document.getElementById('fab-new-bitacora').addEventListener('click', () => abrirFormulario('nuevo'));
        document.getElementById('search-bitacora').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-bitacora');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const a = btn.dataset.accion;
            if (a === 'cerrar') cerrarModal();
            else if (a === 'dictar') alternarDictado();
            else if (a === 'pizarra') abrirPizarra();
            else if (a === 'quitar-pizarra') { pizarra = { ...pizarra, nueva: false, pend: null, vistaPrevia: '', quitada: true }; pintarPizarraForm(); }
            else if (a === 'pdf') descargarPdf(btn.dataset.id);
            else if (a === 'editar-desde-ver') { const id = btn.dataset.id; cerrarModal(); abrirFormulario('editar', id); }
        });
        modal.addEventListener('input', (e) => {
            if (e.target.id === 'b-cliente') sincronizar('cliente');
            else if (e.target.id === 'b-obra') sincronizar('obra');
        });
        modal.addEventListener('change', (e) => {
            if (e.target.id === 'b-cliente') sincronizar('cliente');
            else if (e.target.id === 'b-obra') sincronizar('obra');
        });
        document.getElementById('form-bitacora').addEventListener('submit', enviar);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modo && !(window.BomiPizarra && window.BomiPizarra.estaAbierta())) cerrarModal();
        });
        window.addEventListener('clientesActualizados', () => { clientesViejos = true; });
        window.addEventListener('bomiSincronizado', (e) => {
            const tipos = (e.detail && e.detail.tipos) || [];
            if (iniciado && (!tipos.length || tipos.includes('bitacora'))) cargar().catch(() => {});
        });
    }

    function iniciar() {
        if (iniciado) return;
        iniciado = true;
        construirVista();
        enlazarEventos();
    }

    if (window.BomiAuto) window.BomiAuto.registrar({ cliente: 'b-cliente', obra: 'b-obra', fuente: () => clientes });

    // ---------- Historial de una obra (se abre desde Clientes) ----------
    async function asegurar(id) {
        const { data, error } = await db().from('bitacora').select(COLUMNAS).eq('id', id).limit(1);
        if (error || !data || !data.length) { alert('No se encontró el registro. Puede que se haya eliminado.'); return false; }
        const i = registros.findIndex((x) => x.id === id);
        if (i >= 0) registros[i] = data[0]; else registros.push(data[0]);
        return true;
    }
    const patronObra = (t) => '%' + String(t ?? '').trim().replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    const historial = {
        async buscar(o) {
            const { data, error } = await db().from('bitacora').select(COLUMNAS).ilike('obra', patronObra(o.obra)).limit(LIMITE);
            if (error) throw error;
            const filas = (data || []).filter((r) => (o.obraId && r.obra_id === o.obraId) || (norm(r.obra) === norm(o.obra) && norm(r.cliente) === norm(o.cliente)));
            filas.forEach((f) => { const i = registros.findIndex((x) => x.id === f.id); if (i >= 0) registros[i] = f; else registros.push(f); });
            return filas.map((r) => ({
                id: r.id,
                fecha: fechaHora(r.created_at).split(',')[0],
                orden: r.created_at || '',
                titulo: 'Por ' + (r.created_by || 'desconocido'),
                detalle: r.notas || '',
                etiquetas: imagenDe(r) ? [{ texto: 'Pizarra', tono: 'gris', icono: 'draw' }] : [],
                puedeEditar: true,
                puedeEliminar: true,
            }));
        },
        async ver(id) { iniciar(); if (await asegurar(id)) abrirVista(id); },
        async editar(id) { iniciar(); if (await asegurar(id)) abrirFormulario('editar', id); },
        async eliminar(id) { iniciar(); if (await asegurar(id)) eliminar(id); },
    };

    window.BomiBitacora = {
        historial,
        preparar() { iniciar(); },
        abrir() { iniciar(); return cambiarPestana(pestana, false); },
        recargar() { return iniciado ? cargar() : Promise.resolve(); },
        // Abre un registro nuevo con cliente, obra, dirección, localidad y notas ya rellenos.
        nuevoConDatos(datos) { iniciar(); cambiarPestana('escrita', false); return abrirFormulario('nuevo', null, datos || {}); },
    };
})();
