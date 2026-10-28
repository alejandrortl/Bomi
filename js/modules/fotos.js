// js/modules/fotos.js
// Bitácora fotográfica: fotos de obra (hechas al momento o elegidas de la galería), reducidas en el móvil a 1600 px
// (y una miniatura de 400 px) antes de subirlas. Se guardan en Cloudflare R2 a través de la Edge Function `fotos-obra`,
// que además hace una copia en Google Drive (Bomi - Fotos / Cliente / Obra). La base de datos solo guarda la referencia.
// Script clásico: expone window.BomiFotos. Depende de `supabaseClient`, `window.currentUserProfile` y window.BomiOffline.
(function () {
    'use strict';

    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const BTN_ICON = 'p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-full font-medium flex items-center gap-1.5';
    const FUNCION = 'fotos-obra';
    const LADO = 1600, LADO_MINI = 400, CALIDAD = 0.8, CALIDAD_MINI = 0.7;
    const MAX_FOTOS = 30;               // por subida
    const LIMITE = 3000;                // filas que se cargan
    const EN_TARJETA = 6;               // miniaturas por obra antes de "Ver todas"
    const COLUMNAS = 'id, lote, cliente_id, obra_id, cliente, obra, direccion, localidad, nota, clave, clave_miniatura, ancho, alto, tomada_at, subida_por, subida_por_id, created_at, drive_estado, drive_enlace, drive_error';

    let fotos = [];
    let clientes = [];
    let clientesViejos = true;
    let iniciado = false;
    let cargado = false;
    let busqueda = '';
    let config = null;                  // { r2, drive } o null si aún no se sabe
    let guardando = false;
    let seleccion = [];                 // fotos ya reducidas en el formulario: { blob, mini, vista, ancho, alto, tomada, nombre }
    let procesando = 0;
    let driveReintentado = false;
    const abiertos = new Set();         // obras desplegadas ("Ver todas")
    const enlaces = new Map();          // clave R2 -> { url, hasta }
    let visor = null;                   // { lista, i }

    // ---------- Utilidades ----------
    const db = () => supabaseClient;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const val = (id) => (document.getElementById(id)?.value ?? '').trim();
    const yo = () => window.currentUserProfile || {};
    const esAdmin = () => ['admin', 'superadmin'].includes(String(yo().rol ?? '').trim().toLowerCase());
    const puedeBorrar = (f) => esAdmin() || (!!f.subida_por_id && f.subida_por_id === yo().id);
    const mapsHref = (dir, loc) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dir, loc].filter(Boolean).join(', '));
    const nombreUsuario = () => [yo().nombre, yo().apellido].filter((x) => x && String(x).trim()).join(' ').trim() || yo().email || 'Usuario';
    const fechaHora = (iso) => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };
    const fechaDe = (f) => f.tomada_at || f.created_at;

    function mensajeError(ex) {
        if (window.BomiOffline && window.BomiOffline.esRed(ex)) return window.BomiOffline.mensaje(ex);
        if (ex && ex.code === '42501') return 'No tienes permiso para realizar esta acción.';
        return (ex && ex.message) ? ex.message : 'Ha ocurrido un error inesperado.';
    }

    // Llamada a la Edge Function con el mensaje de error que devuelve.
    async function llamar(cuerpo) {
        const { data, error } = await db().functions.invoke(FUNCION, { body: cuerpo });
        if (error) {
            let msg = error.message;
            try { const d = await error.context.json(); if (d && d.error) msg = d.error; } catch (e) { /* sin detalle */ }
            const e = new Error(error.name === 'FunctionsFetchError' ? 'Failed to fetch' : msg);
            throw e;
        }
        if (data && data.error) throw new Error(data.error);
        return data || {};
    }

    // ---------- Enlaces temporales para ver las fotos ----------
    function enlace(clave) {
        const e = clave && enlaces.get(clave);
        return e && e.hasta > Date.now() ? e.url : '';
    }
    async function pedirEnlaces(claves) {
        const faltan = [...new Set(claves.filter((c) => c && !enlace(c)))];
        for (let i = 0; i < faltan.length; i += 200) {
            const d = await llamar({ accion: 'enlaces', claves: faltan.slice(i, i + 200) });
            const hasta = Date.now() + Math.max(60, (d.caduca_en || 21600) - 600) * 1000;
            Object.entries(d.enlaces || {}).forEach(([c, url]) => { if (/^https:\/\//.test(url)) enlaces.set(c, { url, hasta }); });
        }
    }
    // Pone la imagen a las <img data-clave> que aún no la tienen.
    async function rellenarImagenes(raiz) {
        const imgs = Array.from((raiz || document).querySelectorAll('img[data-clave]'));
        if (!imgs.length || !(config && config.r2)) return;
        try { await pedirEnlaces(imgs.map((i) => i.dataset.clave)); } catch (ex) { /* se quedan en gris; se reintenta al volver a pintar */ }
        imgs.forEach((i) => { const u = enlace(i.dataset.clave); if (u && i.getAttribute('src') !== u) i.src = u; });
    }

    // ---------- Búsqueda y agrupado por obra ----------
    const texto = (f) => [f.cliente, f.obra, f.direccion, f.localidad, f.nota, f.subida_por].join(' ');
    function filtrar() {
        const tokens = norm(busqueda).split(' ').filter(Boolean);
        if (!tokens.length) return fotos;
        return fotos.filter((f) => { const t = norm(texto(f)); return tokens.every((k) => t.includes(k)); });
    }
    function agrupar(lista) {
        const grupos = new Map();
        for (const f of lista) {
            const k = f.obra_id || norm(f.cliente) + '|' + norm(f.obra);
            if (!grupos.has(k)) grupos.set(k, { k, cliente: f.cliente, obra: f.obra, direccion: f.direccion, localidad: f.localidad, fotos: [] });
            grupos.get(k).fotos.push(f);
        }
        // La lista ya viene de la más nueva a la más antigua: la obra con la foto más reciente va primero.
        return Array.from(grupos.values());
    }

    // ---------- Pintado ----------
    const spinner = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
    const aviso = (txt) => `<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">${esc(txt)}</p>`;

    function direccionHtml(dir, loc) {
        const txt = [dir, loc].filter(Boolean).join(', ');
        if (!txt) return '';
        return `<a href="${esc(mapsHref(dir, loc))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-start gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"><span class="material-symbols-outlined text-[16px] mt-0.5">location_on</span><span>${esc(txt)}</span></a>`;
    }

    function htmlGrupo(g) {
        const todas = abiertos.has(g.k) || busqueda;
        const vistas = todas ? g.fotos : g.fotos.slice(0, EN_TARJETA);
        const ultima = fechaHora(fechaDe(g.fotos[0])).split(',')[0];
        return `
        <article class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex flex-col gap-1">
                    <h3 class="font-bold text-base break-words">${esc(g.cliente || 'Sin cliente')}</h3>
                    <p class="text-sm font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200"><span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">construction</span><span class="break-words">${esc(g.obra || 'Sin obra')}</span></p>
                    ${direccionHtml(g.direccion, g.localidad)}
                    <p class="text-xs text-slate-500">${g.fotos.length} ${g.fotos.length === 1 ? 'foto' : 'fotos'} · última del ${esc(ultima)}</p>
                </div>
                <button type="button" data-accion="subir-aqui" data-grupo="${esc(g.k)}" aria-label="Añadir fotos a esta obra" title="Añadir fotos a esta obra" class="${BTN_ICON} shrink-0"><span class="material-symbols-outlined text-[22px]">add_a_photo</span></button>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
                ${vistas.map((f) => `<button type="button" data-accion="ver-foto" data-id="${esc(f.id)}" data-grupo="${esc(g.k)}" aria-label="Ver foto" class="relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-zinc-800">
                    <img data-clave="${esc(f.clave_miniatura || f.clave)}" alt="" loading="lazy" class="w-full h-full object-cover">
                </button>`).join('')}
            </div>
            ${!todas && g.fotos.length > EN_TARJETA ? `<button type="button" data-accion="ver-todas" data-grupo="${esc(g.k)}" class="${BTN_SEC} self-start"><span class="material-symbols-outlined text-[18px]">photo_library</span> Ver las ${g.fotos.length} fotos</button>` : ''}
        </article>`;
    }

    function pintarAvisoConfig() {
        const el = document.getElementById('fotos-config');
        if (!el) return;
        const falta = config && !config.r2;
        el.classList.toggle('hidden', !falta);
        el.innerHTML = falta ? `<span class="material-symbols-outlined text-[18px]">info</span><span>La bitácora fotográfica aún no está activada: falta configurar el almacén de fotos. Avisa a un administrador.${esAdmin() && config.motivo ? `<br><span class="text-xs">${esc(config.motivo)}</span>` : ''}</span>` : '';
    }

    function pintarLista() {
        const cont = document.getElementById('fotos-lista');
        const badge = document.getElementById('fotos-count');
        if (!cont) return;
        const lista = filtrar();
        if (badge) badge.textContent = `${lista.length} ${lista.length === 1 ? 'foto' : 'fotos'}`;
        if (!fotos.length) { cont.innerHTML = aviso('Aún no hay fotos. Pulsa el botón de la cámara para subir las primeras.'); return; }
        if (!lista.length) { cont.innerHTML = aviso('No se encontraron fotos.'); return; }
        cont.innerHTML = agrupar(lista).map(htmlGrupo).join('');
        rellenarImagenes(cont);
    }

    // ---------- Carga ----------
    async function cargarConfig() {
        // El motivo se enseña en el aviso para saber qué paso falta.
        try {
            const d = await llamar({ accion: 'estado' });
            config = { r2: !!d.r2, drive: !!d.drive, motivo: d.r2 ? '' : 'La función fotos-obra responde, pero faltan o están mal los secretos de R2 (R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).' };
        } catch (ex) {
            // Si no hay red se vuelve a preguntar más tarde; cualquier otro fallo (p. ej. la función aún no está instalada) = sin configurar.
            if (navigator.onLine !== false) config = { r2: false, drive: false, motivo: 'No se puede usar la función fotos-obra (' + (ex && ex.message ? ex.message : 'sin respuesta') + '). Revisa que exista con ese nombre y que «Verify JWT» esté desactivado.' };
        }
        pintarAvisoConfig();
    }

    async function cargar() {
        const cont = document.getElementById('fotos-lista');
        if (cont && !cargado) cont.innerHTML = spinner;
        if (!config || !config.r2) await cargarConfig();   // si aún no estaba activada, se vuelve a comprobar cada vez
        if (config && !config.r2) {
            if (cont) cont.innerHTML = aviso('Cuando se active el almacén de fotos, aquí aparecerán las fotos de obra.');
            return;
        }
        const { data, error } = await db().from('fotos_obra').select(COLUMNAS).order('created_at', { ascending: false }).limit(LIMITE);
        if (error) {
            if (cont) cont.innerHTML = `<div class="text-center mt-6 flex flex-col items-center gap-3"><p class="text-red-500">Error al cargar las fotos: ${esc(error.message)}</p><button type="button" data-accion="reintentar" class="text-sm bg-slate-200 dark:bg-zinc-800 px-4 py-2 rounded-full font-medium">Reintentar</button></div>`;
            return;
        }
        fotos = data || [];
        cargado = true;
        pintarLista();
        reintentarDrive();
    }

    // Fotos que no llegaron a copiarse en Drive (p. ej. se subieron sin señal): se reintenta una vez por sesión.
    function reintentarDrive() {
        if (driveReintentado || !config || !config.drive || !navigator.onLine) return;
        const hace = Date.now() - 2 * 60000;
        if (!fotos.some((f) => f.drive_estado !== 'guardada' && new Date(f.created_at) < hace)) return;
        driveReintentado = true;
        llamar({ accion: 'drive' }).catch(() => {});
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

    // ---------- Reducir fotos en el móvil ----------
    async function decodificar(file) {
        if (window.createImageBitmap) {
            try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* se prueba con <img> */ }
        }
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.decoding = 'async';
            await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('formato')); img.src = url; });
            return img;
        } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    function aJpg(fuente, ancho, alto, lado, calidad) {
        const k = Math.min(1, lado / Math.max(ancho, alto));
        const w = Math.max(1, Math.round(ancho * k)), h = Math.max(1, Math.round(alto * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(fuente, 0, 0, w, h);
        return new Promise((ok, ko) => c.toBlob((b) => (b ? ok({ blob: b, ancho: w, alto: h }) : ko(new Error('No se pudo reducir la foto'))), 'image/jpeg', calidad));
    }
    async function reducir(file) {
        const fuente = await decodificar(file);
        const ancho = fuente.width || fuente.naturalWidth, alto = fuente.height || fuente.naturalHeight;
        try {
            const grande = await aJpg(fuente, ancho, alto, LADO, CALIDAD);
            const mini = await aJpg(fuente, ancho, alto, LADO_MINI, CALIDAD_MINI);
            return { blob: grande.blob, ancho: grande.ancho, alto: grande.alto, mini: mini.blob, vista: URL.createObjectURL(mini.blob),
                tomada: file.lastModified ? new Date(file.lastModified).toISOString() : null, nombre: file.name || 'foto' };
        } finally { if (fuente.close) fuente.close(); }
    }

    async function anadirArchivos(lista) {
        const err = document.getElementById('f-error');
        const archivos = Array.from(lista || []);
        const libres = MAX_FOTOS - seleccion.length - procesando;
        if (archivos.length > libres) fallo(err, `Como máximo ${MAX_FOTOS} fotos por subida: se han añadido las ${Math.max(0, libres)} primeras.`);
        const fallidas = [];
        for (const file of archivos.slice(0, Math.max(0, libres))) {
            procesando++;
            pintarSeleccion();
            try { seleccion.push(await reducir(file)); }
            catch (ex) { fallidas.push(file.name || 'foto'); }
            finally { procesando--; pintarSeleccion(); }
        }
        if (fallidas.length) fallo(err, `No se pudo leer: ${fallidas.join(', ')}. Prueba a hacer la foto desde la app o a elegir otra.`);
    }

    function pintarSeleccion() {
        const cont = document.getElementById('f-seleccion');
        const btn = document.getElementById('f-guardar');
        if (!cont) return;
        const kb = Math.round(seleccion.reduce((s, f) => s + f.blob.size, 0) / 1024);
        cont.innerHTML = (seleccion.length || procesando) ? `
            <div class="grid grid-cols-3 gap-1.5">
                ${seleccion.map((f, i) => `<div class="relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-zinc-800">
                    <img src="${esc(f.vista)}" alt="" class="w-full h-full object-cover">
                    <button type="button" data-accion="quitar-foto" data-i="${i}" aria-label="Quitar foto" class="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 flex"><span class="material-symbols-outlined text-[16px]">close</span></button>
                </div>`).join('')}
                ${Array.from({ length: procesando }, () => '<div class="aspect-square rounded-xl bg-slate-200 dark:bg-zinc-800 flex items-center justify-center"><span class="material-symbols-outlined animate-spin text-blue-600">sync</span></div>').join('')}
            </div>
            <p class="text-xs text-slate-500">${seleccion.length} ${seleccion.length === 1 ? 'foto' : 'fotos'} · ${kb >= 1024 ? (kb / 1024).toFixed(1).replace('.', ',') + ' MB' : kb + ' KB'} en total (ya reducidas)</p>` : '';
        if (btn && !guardando) {
            btn.disabled = !!procesando;
            btn.textContent = seleccion.length > 1 ? `Subir ${seleccion.length} fotos` : 'Subir foto';
        }
    }

    function liberarSeleccion() {
        seleccion.forEach((f) => { try { URL.revokeObjectURL(f.vista); } catch (e) { /* nada */ } });
        seleccion = [];
    }

    // ---------- Formulario de subida ----------
    function htmlFormulario() {
        return `
            <div class="flex flex-col gap-1">
                <label for="f-cliente" class="text-xs font-medium">Cliente</label>
                <input id="f-cliente" type="text" required autocomplete="off" placeholder="Elige uno existente o escribe uno nuevo" class="${INPUT}">
            </div>
            <div class="flex flex-col gap-1">
                <label for="f-obra" class="text-xs font-medium">Obra</label>
                <input id="f-obra" type="text" required autocomplete="off" placeholder="Elige una obra del cliente o escribe una nueva" class="${INPUT}">
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="f-direccion" class="text-xs font-medium">Dirección</label><input id="f-direccion" type="text" autocomplete="off" class="${INPUT} read-only:opacity-70"></div>
                <div class="flex flex-col gap-1 flex-1 min-w-0"><label for="f-localidad" class="text-xs font-medium">Localidad</label><input id="f-localidad" type="text" autocomplete="off" class="${INPUT} read-only:opacity-70"></div>
            </div>
            <p id="f-hint" class="hidden text-xs text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl p-3"></p>
            <div class="flex flex-col gap-2">
                <span class="text-xs font-medium">Fotos</span>
                <div class="flex flex-wrap gap-2">
                    <label class="${BTN_SEC} cursor-pointer"><span class="material-symbols-outlined text-[18px]">photo_camera</span> Hacer foto
                        <input id="f-camara" type="file" accept="image/*" capture="environment" class="hidden"></label>
                    <label class="${BTN_SEC} cursor-pointer"><span class="material-symbols-outlined text-[18px]">photo_library</span> Elegir de la galería
                        <input id="f-galeria" type="file" accept="image/*" multiple class="hidden"></label>
                </div>
                <div id="f-seleccion" class="flex flex-col gap-1"></div>
            </div>
            <div class="flex flex-col gap-1">
                <label for="f-nota" class="text-xs font-medium">Nota <span class="font-normal text-slate-500">(opcional)</span></label>
                <textarea id="f-nota" rows="2" class="${INPUT}" placeholder="Por ejemplo: antes de tapar la roza"></textarea>
            </div>
            <p id="f-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-xl p-3" role="alert"></p>
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" data-accion="cerrar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                <button type="submit" id="f-guardar" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-full font-medium">Subir foto</button>
            </div>`;
    }

    let obraAutorrellena = false;
    function sincronizar(origen) {
        const inCli = document.getElementById('f-cliente');
        const inObra = document.getElementById('f-obra');
        const inDir = document.getElementById('f-direccion');
        const inLoc = document.getElementById('f-localidad');
        const hint = document.getElementById('f-hint');
        if (!inCli) return;
        let cli = clientePorNombre(inCli.value);
        const obraTxt = inObra.value;
        let obra = null;
        let obraAmbigua = false;
        if (cli) obra = cli.obras.find((o) => norm(o.nombre) === norm(obraTxt)) || null;
        else if (!norm(inCli.value) && norm(obraTxt)) {
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
        let msg = '';
        const nCli = norm(inCli.value);
        if (obraAmbigua) msg = 'Hay varias obras con ese nombre en distintos clientes: elige primero el cliente.';
        else if (nCli && !cli) msg = `«${inCli.value.trim()}» es un cliente nuevo: se creará junto con esta obra. Rellena dirección y localidad.`;
        else if (cli && norm(obraTxt) && !obra) msg = `Obra nueva en «${cli.nombre}»: se creará con esta dirección y localidad.`;
        else if (cli && obra) msg = `Obra existente de «${cli.nombre}»: se usan su dirección y localidad.`;
        if (hint) { hint.textContent = msg; hint.classList.toggle('hidden', !msg); }
    }

    function mostrarModal() {
        const m = document.getElementById('modal-fotos');
        m.classList.remove('hidden');
        m.classList.add('flex');
    }
    function cerrarModal() {
        const m = document.getElementById('modal-fotos');
        if (!m || guardando) return;
        m.classList.add('hidden');
        m.classList.remove('flex');
        liberarSeleccion();
        obraAutorrellena = false;
    }
    const modalAbierto = () => { const m = document.getElementById('modal-fotos'); return !!m && !m.classList.contains('hidden'); };

    async function abrirFormulario(datos) {
        if (config && !config.r2) await cargarConfig();
        if (config && !config.r2) { alert('La bitácora fotográfica aún no está activada: falta configurar el almacén de fotos.\n\n' + config.motivo); return; }
        try { if (clientesViejos) await cargarClientes(); } catch (ex) { alert('No se pudieron cargar los clientes: ' + mensajeError(ex)); return; }
        liberarSeleccion();
        obraAutorrellena = false;
        document.getElementById('form-fotos').innerHTML = htmlFormulario();
        mostrarModal();
        if (datos) {
            document.getElementById('f-cliente').value = datos.cliente || '';
            document.getElementById('f-obra').value = datos.obra || '';
            document.getElementById('f-direccion').value = datos.direccion || '';
            document.getElementById('f-localidad').value = datos.localidad || '';
            const cli = clientePorNombre(datos.cliente);
            if (cli && cli.obras.some((o) => norm(o.nombre) === norm(datos.obra))) obraAutorrellena = true;
        }
        sincronizar('inicio');
        pintarSeleccion();
        if (!datos) document.getElementById('f-cliente').focus();
    }

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

    const pasoSubir = (clave, blob) => ({ k: 'funcion', nombre: FUNCION, cuerpo: blob, cabeceras: { 'x-accion': 'subir', 'x-clave': clave, 'Content-Type': 'image/jpeg' } });

    async function enviar(e) {
        e.preventDefault();
        if (guardando || procesando) return;
        const err = document.getElementById('f-error');
        const btn = document.getElementById('f-guardar');
        const f = { cliente: val('f-cliente'), obra: val('f-obra'), direccion: val('f-direccion'), localidad: val('f-localidad'), nota: val('f-nota') };
        err.classList.add('hidden');
        if (!f.cliente) return fallo(err, 'Indica el cliente.');
        if (!f.obra) return fallo(err, 'Indica la obra.');
        if (!seleccion.length) return fallo(err, 'Añade al menos una foto.');
        const O = window.BomiOffline;
        guardando = true;
        btn.disabled = true;
        btn.textContent = seleccion.length > 1 ? `Subiendo ${seleccion.length} fotos...` : 'Subiendo...';
        try {
            const datos = resolverObra(f);
            const quien = nombreUsuario();
            const lote = O.uuid();
            const ahora = new Date();
            const carpeta = `fotos/${ahora.getFullYear()}/${String(ahora.getMonth() + 1).padStart(2, '0')}/`;
            const pasos = [...datos.pasos];
            const filas = seleccion.map((s) => {
                const id = O.uuid();
                const clave = carpeta + id + '.jpg', mini = carpeta + id + '-m.jpg';
                pasos.push(pasoSubir(clave, s.blob), pasoSubir(mini, s.mini));
                return { id, lote, cliente_id: datos.clienteId, obra_id: datos.obraId, cliente: datos.cliente, obra: datos.obra, direccion: datos.direccion, localidad: datos.localidad,
                    nota: f.nota || null, clave, clave_miniatura: mini, ancho: s.ancho, alto: s.alto, bytes: s.blob.size, tomada_at: s.tomada, subida_por: quien, subida_por_id: yo().id };
            });
            pasos.push({ k: 'insert', tabla: 'fotos_obra', deshacer: true, filas });
            pasos.push({ k: 'gancho', nombre: 'fotosDrive', datos: { ids: filas.map((x) => x.id) } });
            const n = filas.length;
            const r = await O.guardar({ tipo: 'fotos', etiqueta: `Fotos (${n}) · ${datos.cliente} · ${datos.obra}`, pasos, clientes: datos.creados });
            guardando = false;
            cerrarModal();
            if (r.estado === 'enviado') {
                O.toast(n === 1 ? 'Foto subida.' : `${n} fotos subidas.`, 'ok');
                await cargar();
                if (datos.creados) { clientesViejos = true; window.dispatchEvent(new CustomEvent('clientesActualizados')); }
            }
        } catch (ex) {
            fallo(err, mensajeError(ex));
            clientesViejos = true;
        } finally {
            guardando = false;
            if (btn.isConnected) { btn.disabled = false; pintarSeleccion(); }
        }
    }

    function fallo(el, txt) { el.textContent = txt; el.classList.remove('hidden'); }

    // ---------- Visor ----------
    function abrirVisor(grupoK, id) {
        const lista = agrupar(filtrar()).find((g) => g.k === grupoK)?.fotos || [];
        const i = lista.findIndex((f) => f.id === id);
        if (i < 0) return;
        visor = { lista, i };
        const v = document.getElementById('visor-fotos');
        v.classList.remove('hidden');
        v.classList.add('flex');
        pintarVisor();
    }
    function cerrarVisor() {
        const v = document.getElementById('visor-fotos');
        if (!v) return;
        v.classList.add('hidden');
        v.classList.remove('flex');
        visor = null;
    }
    const visorAbierto = () => !!visor;
    function mover(d) {
        if (!visor) return;
        const n = visor.lista.length;
        visor.i = (visor.i + d + n) % n;
        pintarVisor();
    }

    function estadoDrive(f) {
        if (f.drive_estado === 'guardada') return '<span class="material-symbols-outlined text-[16px] text-emerald-400">cloud_done</span> Copia guardada en Drive';
        if (f.drive_estado === 'error') return `<span class="material-symbols-outlined text-[16px] text-amber-400">cloud_off</span> Copia en Drive pendiente (se reintentará)`;
        return '<span class="material-symbols-outlined text-[16px]">cloud_upload</span> Copia en Drive pendiente';
    }

    function pintarVisor() {
        const f = visor.lista[visor.i];
        const v = document.getElementById('visor-fotos');
        const n = visor.lista.length;
        const flecha = (d, icono, etq) => n > 1 ? `<button type="button" data-visor="${d}" aria-label="${etq}" class="absolute top-1/2 -translate-y-1/2 ${d === 'ant' ? 'left-2' : 'right-2'} bg-black/50 hover:bg-black/70 text-white rounded-full p-2 flex"><span class="material-symbols-outlined">${icono}</span></button>` : '';
        v.innerHTML = `
            <div class="flex justify-between items-center px-4 py-3 text-white shrink-0">
                <span class="text-sm font-medium">${visor.i + 1} / ${n}</span>
                <button type="button" data-visor="cerrar" aria-label="Cerrar" class="p-2 rounded-full hover:bg-white/10 flex"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div id="visor-zona" class="relative flex-1 min-h-0 flex items-center justify-center px-2">
                <img id="visor-img" data-clave="${esc(f.clave)}" alt="Foto de obra" class="max-w-full max-h-full object-contain select-none" ${enlace(f.clave_miniatura) ? `src="${esc(enlace(f.clave_miniatura))}"` : ''}>
                ${flecha('ant', 'chevron_left', 'Foto anterior')}${flecha('sig', 'chevron_right', 'Foto siguiente')}
            </div>
            <div class="text-white px-4 pt-3 pb-5 flex flex-col gap-1.5 shrink-0 max-h-[40dvh] overflow-y-auto">
                <p class="font-semibold break-words">${esc(f.cliente)} · ${esc(f.obra)}</p>
                ${f.direccion || f.localidad ? `<p class="text-xs text-white/70 break-words">${esc([f.direccion, f.localidad].filter(Boolean).join(', '))}</p>` : ''}
                ${f.nota ? `<p class="text-sm whitespace-pre-wrap break-words">${esc(f.nota)}</p>` : ''}
                <p class="text-xs text-white/70">${esc(fechaHora(fechaDe(f)))} · Subida por <strong>${esc(f.subida_por || 'desconocido')}</strong></p>
                <p class="text-xs text-white/70 flex items-center gap-1">${estadoDrive(f)}</p>
                <div class="flex flex-wrap gap-2 pt-1">
                    <button type="button" data-visor="abrir" class="text-sm bg-white/15 hover:bg-white/25 px-4 py-2 rounded-full font-medium flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">open_in_new</span> Abrir original</button>
                    ${f.drive_enlace && /^https:\/\//.test(f.drive_enlace) ? `<a href="${esc(f.drive_enlace)}" target="_blank" rel="noopener noreferrer" class="text-sm bg-white/15 hover:bg-white/25 px-4 py-2 rounded-full font-medium flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">folder_open</span> Ver en Drive</a>` : ''}
                    ${puedeBorrar(f) ? `<button type="button" data-visor="borrar" class="text-sm bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded-full font-medium flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px]">delete</span> Eliminar</button>` : ''}
                </div>
            </div>`;
        rellenarImagenes(v);
    }

    async function abrirOriginal() {
        const f = visor && visor.lista[visor.i];
        if (!f) return;
        const w = window.open('', '_blank');
        try {
            await pedirEnlaces([f.clave]);
            const u = enlace(f.clave);
            if (!u) throw new Error('No se pudo abrir la foto.');
            if (w) w.location.href = u; else window.location.href = u;
        } catch (ex) {
            if (w) w.close();
            alert(mensajeError(ex));
        }
    }

    async function borrarFoto() {
        const f = visor && visor.lista[visor.i];
        if (!f || !puedeBorrar(f)) return;
        if (!confirm('¿Eliminar esta foto de la app?\n\nSi ya tiene copia en Google Drive, allí se conserva.')) return;
        try {
            await llamar({ accion: 'borrar', id: f.id });
            fotos = fotos.filter((x) => x.id !== f.id);
            visor.lista = visor.lista.filter((x) => x.id !== f.id);
            if (!visor.lista.length) cerrarVisor();
            else { visor.i = Math.min(visor.i, visor.lista.length - 1); pintarVisor(); }
            pintarLista();
            window.dispatchEvent(new CustomEvent('bomiRegistrosCambiados', { detail: { tipo: 'fotos' } }));
        } catch (ex) {
            alert('No se pudo eliminar: ' + mensajeError(ex));
        }
    }

    // ---------- Montaje ----------
    function construirVista(cont) {
        cont.innerHTML = `
            <div class="flex justify-end -mt-2"><span id="fotos-count" class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-medium"></span></div>
            <div id="fotos-config" class="hidden flex items-start gap-2 text-sm bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100 rounded-2xl p-3"></div>
            <div class="sticky top-0 z-10 bg-slate-50 dark:bg-black pt-1 pb-2">
                <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full flex items-center px-4 py-2 shadow-sm">
                    <span class="material-symbols-outlined text-slate-400 mr-2">search</span>
                    <input type="text" id="search-fotos" aria-label="Buscar fotos" placeholder="Buscar cliente, obra, dirección, localidad..." autocomplete="off" class="bg-transparent border-none outline-none w-full text-sm placeholder:text-slate-400">
                </div>
            </div>
            <div id="fotos-lista" class="flex flex-col gap-3 pb-6"></div>
            <button type="button" id="fab-nuevas-fotos" aria-label="Subir fotos" class="fixed bottom-20 right-4 sm:right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-2xl z-30 flex items-center justify-center transition-transform active:scale-95"><span class="material-symbols-outlined">add_a_photo</span></button>`;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-fotos" class="hidden fixed inset-0 z-50 justify-center items-end sm:items-center sm:p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-fotos-titulo">
                <div class="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
                    <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                        <h3 id="modal-fotos-titulo" class="font-semibold text-lg">Subir fotos de obra</h3>
                        <button type="button" data-accion="cerrar" aria-label="Cerrar" class="${BTN_ICON}"><span class="material-symbols-outlined">close</span></button>
                    </div>
                    <form id="form-fotos" class="flex flex-col gap-4 p-6 overflow-y-auto"></form>
                </div>
            </div>
            <div id="visor-fotos" class="hidden fixed inset-0 z-[60] flex-col bg-black" role="dialog" aria-modal="true" aria-label="Visor de fotos"></div>`);
    }

    function enlazarEventos(cont) {
        cont.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            const a = btn.dataset.accion;
            if (a === 'ver-foto') abrirVisor(btn.dataset.grupo, btn.dataset.id);
            else if (a === 'ver-todas') { abiertos.add(btn.dataset.grupo); pintarLista(); }
            else if (a === 'subir-aqui') {
                const g = agrupar(fotos).find((x) => x.k === btn.dataset.grupo);
                if (g) abrirFormulario({ cliente: g.cliente, obra: g.obra, direccion: g.direccion, localidad: g.localidad });
            } else if (a === 'reintentar') cargar();
        });
        document.getElementById('fab-nuevas-fotos').addEventListener('click', () => abrirFormulario());
        document.getElementById('search-fotos').addEventListener('input', (e) => { busqueda = e.target.value; pintarLista(); });

        const modal = document.getElementById('modal-fotos');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { cerrarModal(); return; }
            const btn = e.target.closest('[data-accion]');
            if (!btn) return;
            if (btn.dataset.accion === 'cerrar') cerrarModal();
            else if (btn.dataset.accion === 'quitar-foto') {
                const [q] = seleccion.splice(Number(btn.dataset.i), 1);
                if (q) URL.revokeObjectURL(q.vista);
                pintarSeleccion();
            }
        });
        modal.addEventListener('input', (e) => {
            if (e.target.id === 'f-cliente') sincronizar('cliente');
            else if (e.target.id === 'f-obra') sincronizar('obra');
        });
        modal.addEventListener('change', (e) => {
            if (e.target.id === 'f-cliente') sincronizar('cliente');
            else if (e.target.id === 'f-obra') sincronizar('obra');
            else if (e.target.id === 'f-camara' || e.target.id === 'f-galeria') {
                const files = e.target.files;
                anadirArchivos(files).finally(() => { e.target.value = ''; });
            }
        });
        document.getElementById('form-fotos').addEventListener('submit', enviar);

        const v = document.getElementById('visor-fotos');
        v.addEventListener('click', (e) => {
            const b = e.target.closest('[data-visor]');
            if (!b) { if (e.target.id === 'visor-zona') cerrarVisor(); return; }
            const a = b.dataset.visor;
            if (a === 'cerrar') cerrarVisor();
            else if (a === 'ant') mover(-1);
            else if (a === 'sig') mover(1);
            else if (a === 'abrir') abrirOriginal();
            else if (a === 'borrar') borrarFoto();
        });
        // Deslizar con el dedo para pasar de foto.
        let x0 = null, y0 = null;
        v.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
        v.addEventListener('touchend', (e) => {
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
            x0 = null;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) mover(dx < 0 ? 1 : -1);
        }, { passive: true });
        document.addEventListener('keydown', (e) => {
            if (visorAbierto()) {
                if (e.key === 'Escape') cerrarVisor();
                else if (e.key === 'ArrowLeft') mover(-1);
                else if (e.key === 'ArrowRight') mover(1);
            } else if (e.key === 'Escape' && modalAbierto()) cerrarModal();
        });
        window.addEventListener('clientesActualizados', () => { clientesViejos = true; });
        window.addEventListener('bomiSincronizado', (e) => {
            const tipos = (e.detail && e.detail.tipos) || [];
            if (iniciado && tipos.includes('fotos')) cargar().catch(() => {});
        });
    }

    function montar(cont) {
        if (iniciado || !cont) return;
        iniciado = true;
        construirVista(cont);
        enlazarEventos(cont);
    }

    // Copia a Drive justo después de subir (si falla, se reintenta al abrir las fotos más tarde).
    if (window.BomiOffline) {
        window.BomiOffline.registrarGancho('fotosDrive', async (d) => {
            const ids = (d && d.ids) || [];
            for (let i = 0; i < ids.length; i += 5) await llamar({ accion: 'drive', ids: ids.slice(i, i + 5) });
        });
    }
    if (window.BomiAuto) window.BomiAuto.registrar({ cliente: 'f-cliente', obra: 'f-obra', fuente: () => clientes });

    // ---------- Historial de una obra (se abre desde Clientes) ----------
    // El visor vive junto a la pestaña de fotos de la Bitácora: se monta (oculto) si aún no se había abierto.
    function prepararVisor() {
        if (iniciado) return;
        if (!document.getElementById('bitacora-fotos') && window.BomiBitacora) window.BomiBitacora.preparar();
        montar(document.getElementById('bitacora-fotos'));
    }
    const historial = {
        // Devuelve null si la bitácora fotográfica aún no está activada.
        async buscar(o) {
            if (!config || !config.r2) await cargarConfig();
            if (!config || !config.r2) return null;
            if (!o.obraId) return [];
            const { data, error } = await db().from('fotos_obra').select(COLUMNAS).eq('obra_id', o.obraId).order('created_at', { ascending: false }).limit(LIMITE);
            if (error) throw error;
            return (data || []).sort((a, b) => String(fechaDe(b)).localeCompare(String(fechaDe(a))));
        },
        rellenar: rellenarImagenes,
        fecha: (f) => fechaHora(fechaDe(f)).split(',')[0],
        ver(lista, id) {
            prepararVisor();
            const i = lista.findIndex((f) => f.id === id);
            if (i < 0) return;
            visor = { lista: lista.slice(), i };
            const v = document.getElementById('visor-fotos');
            v.classList.remove('hidden');
            v.classList.add('flex');
            pintarVisor();
        },
    };

    window.BomiFotos = {
        historial,
        montar,
        abrir() { return cargar(); },
        nuevoConDatos(datos) { return abrirFormulario(datos || null); },
    };
})();
