// js/modules/tutorial.js
// Tutorial de bienvenida para operarios: un recorrido por la app sobre una SIMULACIÓN con datos inventados
// (no lee ni guarda nada real). Se puede ver mientras la cuenta espera aprobación, sale solo en el primer
// acceso de un Operario y se repite desde Mi Perfil. Botones: Más tarde (vuelve a salir al abrir la app otra vez)
// y No volver a mostrar. La elección se guarda en el móvil y, con sesión iniciada, en ui_preferencias.tutorial.
// Script clásico: expone window.BomiTutorial. Depende de `supabaseClient` y `window.currentUserProfile` (opcionales).
(function () {
    'use strict';

    const CLAVE_LOCAL = 'bomi_tutorial';          // 'visto' | 'descartado'
    const CLAVE_LUEGO = 'bomi_tutorial_luego';    // sessionStorage: "más tarde" hasta que se vuelva a abrir la app
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const yo = () => window.currentUserProfile || null;
    const icono = (n, extra = '') => `<span class="material-symbols-outlined ${extra}">${n}</span>`;
    const TARJETA = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm';
    const BTN_SEC = 'text-sm bg-slate-100 dark:bg-zinc-800 px-3 py-2 rounded-full font-medium flex items-center gap-1.5';
    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';

    // ---------- Datos de ejemplo (inventados) ----------
    const CLIENTES = [
        { nombre: 'Comunidad Las Acacias', obras: [
            { nombre: 'Portal 3 - Bajantes', direccion: 'C/ Acacias 3', localidad: 'Getafe' },
            { nombre: 'Garaje - Grupo de presión', direccion: 'C/ Acacias 5', localidad: 'Getafe' }] },
        { nombre: 'Hotel Mirador', obras: [
            { nombre: 'Habitaciones 2ª planta', direccion: 'Av. del Mar 12', localidad: 'Leganés' },
            { nombre: 'Cocina', direccion: 'Av. del Mar 12', localidad: 'Leganés' }] },
        { nombre: 'Ana Pérez', obras: [
            { nombre: 'Reforma de baño', direccion: 'C/ Olmo 8, 2ºB', localidad: 'Alcorcón' }] },
    ];
    const todasObras = () => CLIENTES.flatMap((c) => c.obras.map((o) => ({ ...o, cliente: c.nombre })));
    const hoy = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

    function nuevoEstado() {
        return {
            paso: 0,
            soloMias: true,
            hechas: { 2: true },
            cliente: '', obra: '', direccion: '', localidad: '',
            foco: 'cliente',
            union: 'unir',
            obraAbierta: null,
        };
    }

    let st = null;          // estado de la simulación mientras está abierta
    let raiz = null;        // overlay
    let origen = 'app';     // 'app' | 'pendiente' | 'perfil'

    const miNombre = () => { const p = yo(); return (p && [p.nombre, p.apellido].filter(Boolean).join(' ').trim()) || 'Tú'; };
    function tareas() {
        return [
            { id: 1, cliente: 'Comunidad Las Acacias', obra: 'Portal 3 - Bajantes', dir: 'C/ Acacias 3, Getafe', op: miNombre(), mia: true, notas: 'Revisar bajante del 2º' },
            { id: 2, cliente: 'Ana Pérez', obra: 'Reforma de baño', dir: 'C/ Olmo 8, 2ºB, Alcorcón', op: miNombre(), mia: true, notas: 'Montar plato de ducha' },
            { id: 3, cliente: 'Hotel Mirador', obra: 'Cocina', dir: 'Av. del Mar 12, Leganés', op: 'Luis Gómez', mia: false, notas: 'Cambiar grifo fregadero' },
        ];
    }

    // ---------- Pantallas simuladas ----------
    function pantallaDiario() {
        const lista = tareas().filter((t) => !st.soloMias || t.mia)
            .sort((a, b) => (st.hechas[a.id] ? 1 : 0) - (st.hechas[b.id] ? 1 : 0));
        const boton = (mias, txt) => `<button type="button" data-tuto="filtro" data-mias="${mias ? 1 : 0}" class="flex-1 py-2 rounded-full text-sm font-medium ${st.soloMias === mias ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}">${txt}</button>`;
        return `
            <div class="flex flex-col gap-3">
                <div class="${TARJETA} p-3 flex flex-col gap-3">
                    <div class="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 rounded-full px-3 py-2 text-sm text-slate-400">${icono('search', 'text-[20px]')} Buscar cliente, obra, dirección...</div>
                    <div data-foco="filtro" class="flex bg-slate-100 dark:bg-zinc-800 rounded-full p-1">${boton(false, 'Todas las tareas')}${boton(true, 'Mis tareas')}</div>
                    <div data-foco="fecha" class="flex items-center gap-2 text-sm font-medium self-start bg-slate-100 dark:bg-zinc-800 rounded-lg px-3 py-2">${icono('calendar_month', 'text-[18px]')} Hoy, ${hoy()}</div>
                </div>
                <div data-foco="tareas" class="flex flex-col gap-3">
                    ${lista.map((t) => `
                        <div class="${TARJETA} p-4 flex items-start gap-3 ${st.hechas[t.id] ? 'opacity-60' : ''}">
                            <button type="button" data-tuto="hecha" data-id="${t.id}" ${t.mia ? '' : 'disabled'} aria-label="Marcar como hecha" class="shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center ${st.hechas[t.id] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-zinc-600'}">${st.hechas[t.id] ? icono('check', 'text-[18px]') : ''}</button>
                            <div class="flex flex-col min-w-0">
                                <span class="font-semibold text-sm ${st.hechas[t.id] ? 'line-through' : ''}">${esc(t.cliente)} · ${esc(t.obra)}</span>
                                <span class="text-xs text-slate-500 flex items-center gap-1">${icono('location_on', 'text-[14px]')} ${esc(t.dir)}</span>
                                <span class="text-xs text-slate-500">${esc(t.notas)} · ${esc(t.op)}</span>
                            </div>
                        </div>`).join('')}
                </div>
                <div class="flex justify-end"><span data-foco="nueva" class="bg-blue-600 text-white p-4 rounded-2xl shadow-xl flex">${icono('add')}</span></div>
            </div>`;
    }

    function pantallaDetalleTarea() {
        const t = tareas()[0];
        return `
            <div class="${TARJETA} p-5 flex flex-col gap-3">
                <h3 class="font-semibold">${esc(t.cliente)}</h3>
                <p class="text-sm">${esc(t.obra)}</p>
                <p class="text-xs text-slate-500 flex items-center gap-1">${icono('location_on', 'text-[14px]')} ${esc(t.dir)}</p>
                <p class="text-sm bg-slate-50 dark:bg-zinc-800 rounded-xl p-3">${esc(t.notas)}</p>
                <p class="text-xs text-slate-500">Asignada a ${esc(t.op)} · Hoy</p>
            </div>
            <div data-foco="acciones-tarea" class="flex flex-wrap gap-2 justify-end mt-3">
                <span class="${BTN_SEC}">${icono('picture_as_pdf', 'text-[18px]')} PDF</span>
                <span class="${BTN_SEC}">${icono('assignment', 'text-[18px]')} Crear parte</span>
                <span class="${BTN_SEC}">${icono('menu_book', 'text-[18px]')} Crear bitácora</span>
                <span class="${BTN_SEC}">${icono('inventory_2', 'text-[18px]')} Pedir material</span>
            </div>`;
    }

    // Sugerencias + dirección/localidad: se repinta sola al escribir, sin tocar los campos (así no se cierra el teclado).
    function restoBuscador() {
        const filtroCli = CLIENTES.find((c) => norm(c.nombre) === norm(st.cliente));
        let sugerencias = [];
        if (st.foco === 'cliente') {
            sugerencias = CLIENTES.filter((c) => !st.cliente || norm(c.nombre).includes(norm(st.cliente)))
                .map((c) => ({ tipo: 'cliente', titulo: c.nombre, sub: c.obras.length + (c.obras.length === 1 ? ' obra' : ' obras') }));
        } else if (st.foco === 'obra') {
            const base = filtroCli ? filtroCli.obras.map((o) => ({ ...o, cliente: filtroCli.nombre })) : todasObras();
            sugerencias = base.filter((o) => !st.obra || norm(o.nombre).includes(norm(st.obra)))
                .map((o) => ({ tipo: 'obra', titulo: o.nombre, sub: o.cliente + ' · ' + o.localidad }));
        }
        const aviso = st.foco === 'obra'
            ? (filtroCli ? `Solo salen las obras de <b>${esc(filtroCli.nombre)}</b>.` : 'Sin cliente elegido salen <b>todas</b> las obras.')
            : 'Toca un cliente, o pasa directamente a Obra.';
        return `
            ${sugerencias.length ? `<div class="flex flex-col border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <p data-tuto-aviso class="text-xs text-slate-500 px-3 py-2 bg-slate-50 dark:bg-zinc-800">${aviso}</p>
                ${sugerencias.map((s) => `<button type="button" data-tuto="sugerencia" data-tipo="${s.tipo}" data-valor="${esc(s.titulo)}" class="text-left px-3 py-2 text-sm border-t border-slate-100 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800"><span class="font-medium">${esc(s.titulo)}</span><span class="block text-xs text-slate-500">${esc(s.sub)}</span></button>`).join('')}
            </div>` : ''}
            <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1"><span class="text-xs font-medium">Dirección</span><p id="tuto-direccion" class="${INPUT} min-h-[2.75rem] ${st.direccion ? 'ring-2 ring-emerald-500' : 'text-slate-400'}">${esc(st.direccion || 'Se rellena sola')}</p></div>
                <div class="flex flex-col gap-1"><span class="text-xs font-medium">Localidad</span><p id="tuto-localidad" class="${INPUT} min-h-[2.75rem] ${st.localidad ? 'ring-2 ring-emerald-500' : 'text-slate-400'}">${esc(st.localidad || 'Se rellena sola')}</p></div>
            </div>
            ${(st.cliente || st.obra) ? `<button type="button" data-tuto="limpiar" class="${BTN_SEC} self-start">${icono('undo', 'text-[18px]')} Probar otra vez</button>` : ''}`;
    }

    function pantallaBuscador() {
        return `
            <div class="${TARJETA} p-5 flex flex-col gap-3">
                <h3 class="font-semibold">Nueva tarea (ejemplo)</h3>
                <div data-foco="buscador" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1"><label class="text-xs font-medium" for="tuto-cliente">Cliente</label>
                        <div class="relative"><input id="tuto-cliente" data-tuto="campo" data-campo="cliente" autocomplete="off" value="${esc(st.cliente)}" placeholder="Escribe o elige un cliente" class="${INPUT} pr-10"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex">${icono('mic', 'text-[20px]')}</span></div></div>
                    <div class="flex flex-col gap-1"><label class="text-xs font-medium" for="tuto-obra">Obra</label>
                        <div class="relative"><input id="tuto-obra" data-tuto="campo" data-campo="obra" autocomplete="off" value="${esc(st.obra)}" placeholder="Escribe o elige una obra" class="${INPUT} pr-10"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 flex">${icono('mic', 'text-[20px]')}</span></div></div>
                    <div id="tuto-buscador-resto" class="flex flex-col gap-3">${restoBuscador()}</div>
                </div>
            </div>`;
    }
    function repintarBuscador() {
        const resto = raiz && raiz.querySelector('#tuto-buscador-resto');
        if (!resto) return;
        resto.innerHTML = restoBuscador();
        const cli = raiz.querySelector('#tuto-cliente'); const obra = raiz.querySelector('#tuto-obra');
        if (cli && cli.value !== st.cliente) cli.value = st.cliente;
        if (obra && obra.value !== st.obra) obra.value = st.obra;
    }

    function pantallaPartes() {
        return `
            <div class="flex flex-col gap-3">
                <div class="${TARJETA} p-3 flex flex-col gap-3">
                    <div data-foco="buscar-semana" class="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 rounded-full px-3 py-2 text-sm">${icono('search', 'text-[20px] text-slate-400')} S43</div>
                    <div class="flex bg-slate-100 dark:bg-zinc-800 rounded-full p-1"><span class="flex-1 py-2 text-center text-sm font-medium text-slate-600 dark:text-slate-300">Todos</span><span class="flex-1 py-2 text-center rounded-full text-sm font-medium bg-blue-600 text-white">Mis partes</span></div>
                </div>
                <div data-foco="parte" class="${TARJETA} p-4 flex flex-col gap-2">
                    <div class="flex justify-between gap-2"><span class="font-semibold text-sm">Comunidad Las Acacias · Portal 3 - Bajantes</span><span class="text-xs bg-slate-100 dark:bg-zinc-800 rounded-full px-2 py-0.5 shrink-0">S43</span></div>
                    <p class="text-xs text-slate-500">${esc(miNombre())} 4 h · Luis Gómez 4 h</p>
                    <p class="text-xs text-slate-500">Cambio de bajante · 2 codos PVC 110, 1 manguito</p>
                    <p class="text-xs text-slate-500 flex items-center gap-1">${icono('draw', 'text-[14px]')} Firmado por el cliente</p>
                    <div class="flex gap-2 justify-end"><span class="${BTN_SEC}">${icono('picture_as_pdf', 'text-[18px]')} PDF</span><span class="${BTN_SEC}">${icono('edit', 'text-[18px]')} Editar</span></div>
                </div>
                <div data-foco="bloqueado" class="${TARJETA} p-4 flex items-center justify-between gap-2 opacity-80">
                    <span class="text-sm">Hotel Mirador · Cocina</span><span class="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-300">${icono('lock', 'text-[16px]')} Cerrado</span>
                </div>
            </div>`;
    }

    // Crear un parte cuando ese día ya hay otro en la misma obra
    function pantallaUnirParte() {
        const opcion = (v, txt) => `<button type="button" data-tuto="union" data-valor="${v}" class="text-sm px-4 py-2 rounded-full font-medium border ${st.union === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-zinc-700'}">${txt}</button>`;
        return `
            <div class="${TARJETA} p-5 flex flex-col gap-3">
                <h3 class="font-semibold">Nuevo parte (ejemplo)</h3>
                <p class="text-sm">Comunidad Las Acacias · Portal 3 - Bajantes · Hoy</p>
                <div data-foco="unir" class="flex flex-col gap-3 bg-blue-50 dark:bg-blue-950 rounded-xl p-3">
                    <p class="text-sm">Hoy ya hay un parte de <b>Luis Gómez</b> en esta obra. ¿Qué quieres hacer?</p>
                    <div class="flex flex-wrap gap-2">${opcion('unir', 'Añadir a ese parte')}${opcion('nuevo', 'Crear parte nuevo')}</div>
                    <p class="text-xs text-slate-600 dark:text-slate-300">${st.union === 'unir'
                        ? 'Tu trabajo se añade en un apartado «Añadido por ' + esc(miNombre()) + '», tú pasas a figurar en el parte y tu material queda a tu nombre.'
                        : 'Se guarda un parte aparte, solo con lo tuyo.'}</p>
                </div>
                <p data-foco="firma" class="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950 rounded-xl p-3 flex items-start gap-2">${icono('draw', 'text-[18px] shrink-0')} Ese parte ya tiene la firma del cliente. Si vuelves a pedir firma, se creará un parte nuevo.</p>
            </div>`;
    }

    function pestanasBitacora(activa) {
        const b = (k, ic, txt) => `<span class="flex-1 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 ${activa === k ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}">${icono(ic, 'text-[18px]')} ${txt}</span>`;
        return `<div data-foco="pestanas-bitacora" class="flex bg-slate-100 dark:bg-zinc-800 rounded-full p-1">${b('escrita', 'edit_note', 'Escrita')}${b('fotos', 'photo_camera', 'Fotográfica')}</div>`;
    }

    function pantallaFotos() {
        const foto = (txt) => `<div class="aspect-square rounded-xl bg-slate-200 dark:bg-zinc-800 flex flex-col items-center justify-center text-slate-400 text-[11px] gap-1">${icono('photo_library')}${txt}</div>`;
        return `
            <div class="flex flex-col gap-3">
                ${pestanasBitacora('fotos')}
                <div data-foco="fotos" class="${TARJETA} p-4 flex flex-col gap-3">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold text-sm">Ana Pérez · Reforma de baño</span>
                        <span class="p-1.5 rounded-full text-slate-500 flex">${icono('add_a_photo', 'text-[22px]')}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">${foto('Antes')}${foto('Tuberías')}${foto('Plato')}</div>
                </div>
                <div class="flex justify-end"><span data-foco="subir-fotos" class="bg-blue-600 text-white p-4 rounded-2xl shadow-xl flex">${icono('add_a_photo')}</span></div>
            </div>`;
    }

    function pantallaPizarra() {
        const color = (c) => `<span class="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 shadow" style="background:${c}"></span>`;
        return `
            <div class="${TARJETA} p-4 flex flex-col gap-3">
                <h3 class="font-semibold flex items-center gap-2">${icono('draw', 'text-blue-600')} Pizarra</h3>
                <div data-foco="pizarra-herramientas" class="flex flex-wrap items-center gap-2">
                    <span class="${BTN_SEC}">${icono('photo_camera', 'text-[18px]')} Foto</span>
                    <span class="${BTN_SEC}">${icono('crop', 'text-[18px]')} Encuadrar</span>
                    <span class="${BTN_SEC}">${icono('text_fields', 'text-[18px]')} Texto</span>
                    <span class="flex gap-1">${['#111827', '#dc2626', '#2563eb', '#16a34a', '#facc15'].map(color).join('')}</span>
                </div>
                <div data-foco="pizarra" class="relative h-48 rounded-xl overflow-hidden bg-gradient-to-br from-slate-300 to-slate-400 dark:from-zinc-700 dark:to-zinc-800">
                    <span class="absolute left-3 top-3 text-[11px] text-white/80 flex items-center gap-1">${icono('photo_camera', 'text-[16px]')} Foto de fondo</span>
                    <svg viewBox="0 0 300 160" class="absolute inset-0 w-full h-full" aria-hidden="true"><path d="M40 120 C 90 40, 150 40, 200 110" stroke="#dc2626" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M200 110 l-14 -2 m14 2 l-4 -13" stroke="#dc2626" stroke-width="5" fill="none" stroke-linecap="round"/></svg>
                    <span class="absolute right-4 bottom-4 bg-yellow-300 text-slate-900 text-xs font-semibold px-2 py-1 rounded">Llave de paso aquí</span>
                </div>
            </div>`;
    }

    function pantallaBitacora() {
        return `
            <div class="flex flex-col gap-3">
                ${pestanasBitacora('escrita')}
                <div data-foco="bitacora" class="${TARJETA} p-4 flex flex-col gap-2">
                    <span class="font-semibold text-sm">Hotel Mirador · Habitaciones 2ª planta</span>
                    <p class="text-sm">Llave de corte general detrás de la puerta del cuarto de limpieza. Tuberías de cobre de 22.</p>
                    <div class="h-24 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 gap-1 text-sm">${icono('draw')} Dibujo de la pizarra</div>
                </div>
                <div data-foco="herramientas" class="flex gap-2"><span class="${BTN_SEC}">${icono('mic', 'text-[18px]')} Dictar</span><span class="${BTN_SEC}">${icono('draw', 'text-[18px]')} Abrir Pizarra</span></div>
            </div>`;
    }

    function pantallaMateriales() {
        const estado = (txt, cls) => `<span class="text-xs rounded-full px-2 py-0.5 font-medium ${cls}">${txt}</span>`;
        const fila = (titulo, items, est) => `
            <div class="${TARJETA} p-4 flex flex-col gap-1">
                <div class="flex justify-between gap-2"><span class="font-semibold text-sm">${titulo}</span>${est}</div>
                <p class="text-xs text-slate-500">${items}</p>
            </div>`;
        return `
            <div data-foco="estados" class="flex flex-col gap-3">
                ${fila('Ana Pérez · Reforma de baño', '1 plato de ducha 80×120 · 1 válvula sifónica', estado('Pendiente', 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'))}
                ${fila('Comunidad Las Acacias · Garaje', '2 manguitos 110 · 4 abrazaderas', estado('Pedido', 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'))}
                ${fila('Hotel Mirador · Cocina', '1 grifo monomando', estado('Recibido', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'))}
            </div>`;
    }

    function pantallaClientes() {
        const historial = (o) => {
            const grupo = (ic, titulo, filas) => `
                <div class="flex flex-col gap-1">
                    <span class="text-xs font-semibold flex items-center gap-1">${icono(ic, 'text-[16px] text-blue-600')} ${titulo}</span>
                    ${filas.map((f) => `<p class="text-xs text-slate-500 pl-5">${f}</p>`).join('')}
                </div>`;
            return `
                <div class="flex flex-col gap-2 border-l-2 border-blue-200 dark:border-blue-900 pl-3 ml-1">
                    ${grupo('assignment', 'Partes', ['Hoy · Cambio de bajante (' + esc(miNombre()) + ', Luis Gómez)', '14/10 · Revisión de arquetas'])}
                    ${grupo('inventory_2', 'Materiales pedidos', ['Ayer · 2 codos PVC 110 · Recibido'])}
                    ${grupo('menu_book', 'Bitácora', ['10/10 · Llave de corte en el cuarto de contadores'])}
                    ${grupo('photo_library', 'Bitácora fotográfica', ['3 fotos'])}
                    ${grupo('list_alt', 'Diario', ['Hoy · Revisar bajante del 2º'])}
                </div>`;
        };
        return `
            <div data-foco="clientes" class="flex flex-col gap-3">
                ${CLIENTES.slice(0, 2).map((c) => `
                    <div class="${TARJETA} p-4 flex flex-col gap-2">
                        <span class="font-semibold text-sm flex items-center gap-2">${icono('business_center', 'text-[18px] text-blue-600')} ${esc(c.nombre)}</span>
                        ${c.obras.map((o) => `
                            <button type="button" data-tuto="obra" data-valor="${esc(o.nombre)}" ${o.nombre === 'Portal 3 - Bajantes' ? 'data-foco="obra-historial"' : ''} aria-expanded="${st.obraAbierta === o.nombre}" class="text-left text-xs leading-5 hover:underline rounded-lg">
                                ${icono('construction', 'text-[16px] align-middle text-blue-600 dark:text-blue-400')} <span class="font-medium">${esc(o.nombre)}</span> <span class="text-slate-500">· ${esc(o.direccion)}, ${esc(o.localidad)}</span>
                            </button>
                            ${st.obraAbierta === o.nombre ? historial(o) : ''}`).join('')}
                        <span class="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">${icono('call', 'text-[14px]')} 600 000 000</span>
                    </div>`).join('')}
            </div>`;
    }

    function pantallaEmpleados() {
        const companeros = [[miNombre(), '600 111 222'], ['Luis Gómez', '600 333 444'], ['Marta Ruiz', '600 555 666']];
        return `
            <div data-foco="empleados" class="flex flex-col gap-3">
                ${companeros.map(([n, t]) => `
                    <div class="${TARJETA} p-4 flex items-center gap-2">
                        <div class="flex flex-col min-w-0">
                            <span class="font-semibold text-sm flex items-center gap-2">${icono('person', 'text-[18px] text-blue-600')} ${esc(n)}</span>
                            <span class="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">${icono('call', 'text-[14px]')} ${t}</span>
                        </div>
                    </div>`).join('')}
            </div>`;
    }

    function pantallaPerfil() {
        const fila = (ic, txt) => `<p class="text-sm flex items-center gap-2">${icono(ic, 'text-[20px] text-blue-600')} ${txt}</p>`;
        return `
            <div data-foco="perfil-opciones" class="${TARJETA} p-5 flex flex-col gap-3">
                <h3 class="font-semibold flex items-center gap-2">${icono('person', 'text-blue-600')} Mi perfil</h3>
                ${fila('person', 'Nombre, apellido y teléfono')}
                ${fila('checkroom', 'Mis tallas de ropa de trabajo')}
                ${fila('format_size', 'Tamaño de la letra')}
                ${fila('notifications', 'Qué avisos quiero recibir')}
                ${fila('phonelink_ring', 'Activar avisos en este móvil')}
                ${fila('lock', 'Cambiar contraseña')}
                ${fila('visibility', 'Ver este tutorial otra vez')}
            </div>`;
    }

    function pantallaFinal() {
        const pend = origen === 'pendiente';
        return `
            <div class="${TARJETA} p-6 flex flex-col items-center text-center gap-3">
                <span class="material-symbols-outlined text-emerald-600 text-[48px]">task_alt</span>
                <h3 class="font-semibold text-lg">¡Listo!</h3>
                <p class="text-sm text-slate-500">${pend
                    ? 'Cuando un responsable apruebe tu cuenta, entra con tu correo y tu contraseña y verás tus tareas reales.'
                    : 'Ya conoces lo principal. Puedes repetir este tutorial cuando quieras desde Mi Perfil.'}</p>
            </div>`;
    }

    // ---------- Pasos ----------
    // pestana: pestaña simulada activa · foco: elemento a resaltar (data-foco)
    const PASOS = [
        { titulo: '¡Bienvenido a Bomi!', pestana: 'diario', pantalla: pantallaDiario,
          texto: 'Te enseñamos dónde está cada cosa en un minuto. Esto es una <b>práctica con datos inventados</b>: puedes tocar lo que quieras, no se guarda nada.' },
        { titulo: 'Las pestañas de abajo', pestana: 'diario', pantalla: pantallaDiario, foco: 'nav',
          texto: 'Desde aquí cambias de sección: <b>Diario</b>, <b>Partes</b>, <b>Bitácora</b>, <b>Materiales</b>, <b>Clientes</b> y <b>Empleados</b>.' },
        { titulo: 'Diario: tus tareas', pestana: 'diario', pantalla: pantallaDiario, foco: 'filtro',
          texto: 'Al entrar ves <b>Mis tareas</b>, las que tienes asignadas. Pulsa <b>Todas las tareas</b> para ver las de todo el equipo. La app recuerda lo que elijas.' },
        { titulo: 'Cambiar de día', pestana: 'diario', pantalla: pantallaDiario, foco: 'fecha',
          texto: 'Con el calendario eliges el día que quieres ver. Por defecto se muestra hoy.' },
        { titulo: 'Marcar una tarea como hecha', pestana: 'diario', pantalla: pantallaDiario, foco: 'tareas',
          texto: 'Toca el círculo de una tarea tuya para marcarla <b>hecha</b> (o pendiente otra vez). Las completadas bajan al final. Pruébalo.' },
        { titulo: 'Dentro de una tarea', pestana: 'diario', pantalla: pantallaDetalleTarea, foco: 'acciones-tarea',
          texto: 'Al abrir una tarea tienes <b>Crear parte</b>, <b>Crear bitácora</b> y <b>Pedir material</b>, que ya vienen con el cliente, la obra y la dirección (el parte y la bitácora, además, con las notas de la tarea). También la puedes guardar en <b>PDF</b>.' },
        { titulo: 'Crear una tarea', pestana: 'diario', pantalla: pantallaDiario, foco: 'nueva',
          texto: 'Con el botón <b>+</b> creas una tarea nueva. Las notas se pueden escribir o dictar con el micrófono, y puedes hacer un dibujo en la pizarra.' },
        { titulo: 'Buscar cliente y obra', pestana: 'diario', pantalla: pantallaBuscador, foco: 'buscador',
          texto: 'Puedes buscar <b>directamente por la obra</b>. Si eliges antes un <b>cliente</b>, solo salen <b>las obras de ese cliente</b>. Al elegir la obra se rellenan solas la dirección y la localidad. Funciona igual en Diario, Partes, Materiales y Bitácora, y con el <b>micrófono</b> también los puedes dictar. Pruébalo.' },
        { titulo: 'Partes de trabajo', pestana: 'partes', pantalla: pantallaPartes, foco: 'parte',
          texto: 'En el parte apuntas quién ha trabajado y cuántas horas, lo que se ha hecho (escrito o dictado), los materiales usados y la <b>firma del cliente</b>. Se descarga en <b>PDF</b>. Puedes editar los partes en los que figuras.' },
        { titulo: 'Varios en la misma obra y día', pestana: 'partes', pantalla: pantallaUnirParte, foco: 'unir',
          texto: 'Si ese día ya hay un parte en la misma obra, eliges <b>Añadir a ese parte</b> (lo normal) o <b>Crear parte nuevo</b>. Al añadir, quien hizo el parte recibe un aviso. Si ya figuras en ese parte, te lo dice y puedes modificarlo. Pruébalo.' },
        { titulo: 'La firma del cliente', pestana: 'partes', pantalla: pantallaUnirParte, foco: 'firma',
          texto: 'Un parte solo lleva una firma. Si el parte del día ya está firmado y necesitas otra firma, se crea un parte nuevo para ti.' },
        { titulo: 'Buscar por semana', pestana: 'partes', pantalla: pantallaPartes, foco: 'buscar-semana',
          texto: 'Escribe la semana, por ejemplo <b>S43</b>, para ver los partes de esa semana. Arriba eliges ver <b>Todos</b> o <b>Mis partes</b>.' },
        { titulo: 'Partes cerrados', pestana: 'partes', pantalla: pantallaPartes, foco: 'bloqueado',
          texto: 'Si un parte tiene el <b>candado</b> ya está cerrado: se puede ver y descargar, pero no cambiar.' },
        { titulo: 'Bitácora', pestana: 'bitacora', pantalla: pantallaBitacora, foco: 'bitacora',
          texto: 'Aquí se apunta información útil de cada obra para que la vea todo el equipo: dónde está una llave, qué tubería hay, medidas...' },
        { titulo: 'Notas por voz y pizarra', pestana: 'bitacora', pantalla: pantallaBitacora, foco: 'herramientas',
          texto: 'Puedes <b>dictar</b> la nota en vez de escribirla y hacer un dibujo o esquema en la <b>pizarra</b>.' },
        { titulo: 'Pizarra con foto', pestana: 'bitacora', pantalla: pantallaPizarra, foco: 'pizarra-herramientas',
          texto: 'En la pizarra puedes <b>hacer una foto</b> o elegirla de la galería y dibujar encima. La foto se <b>encuadra</b> (acercar, girar, mover), puedes poner <b>cajas de texto</b> y elegir entre cinco colores, amarillo incluido. Después se puede seguir editando. También está en las tareas del Diario.' },
        { titulo: 'Bitácora fotográfica', pestana: 'bitacora', pantalla: pantallaFotos, foco: 'pestanas-bitacora',
          texto: 'La Bitácora tiene dos pestañas: <b>Escrita</b> y <b>Fotográfica</b>. En la fotográfica se guardan las fotos de cada obra, agrupadas por obra y con buscador.' },
        { titulo: 'Subir fotos de obra', pestana: 'bitacora', pantalla: pantallaFotos, foco: 'subir-fotos',
          texto: 'Con este botón <b>haces una foto</b> o las eliges de la galería (puedes subir varias a la vez). Sin cobertura esperan en el móvil y se suben solas. Puedes borrar las fotos que hayas subido tú.' },
        { titulo: 'Pedir material', pestana: 'materiales', pantalla: pantallaMateriales, foco: 'estados',
          texto: 'Crea una solicitud con lo que necesitas. Verás su estado: <b>Pendiente</b>, <b>Pedido</b> o <b>Recibido</b>. Te llega un aviso cuando se pide. Cuando tengas el material, abre la solicitud y márcala como <b>Recibido</b>.' },
        { titulo: 'Clientes y obras', pestana: 'clientes', pantalla: pantallaClientes, foco: 'clientes',
          texto: 'La agenda de clientes con sus obras, direcciones y teléfonos de contacto.' },
        { titulo: 'Historial de cada obra', pestana: 'clientes', pantalla: pantallaClientes, foco: 'obra-historial',
          texto: 'Toca el nombre de una obra y se despliega <b>todo su historial</b>: partes, material pedido, bitácora, fotos y tareas del Diario, de lo más nuevo a lo más antiguo. Pruébalo con «Portal 3 - Bajantes».' },
        { titulo: 'Empleados', pestana: 'empleados', pantalla: pantallaEmpleados, foco: 'empleados',
          texto: 'Aquí están tus compañeros con su teléfono, para llamarles con un toque.' },
        { titulo: 'Mensajes y avisos', pestana: 'diario', pantalla: pantallaDiario, foco: 'cabecera-avisos',
          texto: 'Arriba tienes los <b>mensajes</b> para escribir a tus compañeros y la <b>campana</b> con los avisos (tareas que te asignan, material...). Un punto rojo indica que hay algo nuevo.' },
        { titulo: 'Mi Perfil', pestana: null, pantalla: pantallaPerfil, foco: 'cabecera-perfil',
          texto: 'Pulsando tu nombre entras en <b>Mi Perfil</b>: tus datos, tus tallas, el <b>tamaño de la letra</b> y los avisos. <b>Activa los avisos en el móvil</b> para enterarte aunque la app esté cerrada.' },
        { titulo: 'Sin cobertura', pestana: 'diario', pantalla: pantallaDiario,
          texto: 'Si te quedas sin señal, lo que crees se guarda en el móvil y <b>se envía solo</b> al volver la conexión. Para editar algo que ya existe sí hace falta conexión.' },
        { titulo: 'Fin del tutorial', pestana: null, pantalla: pantallaFinal,
          texto: '' },
    ];

    // ---------- Pintado ----------
    const NAV = [
        ['diario', 'list_alt', 'Diario'], ['partes', 'assignment', 'Partes'], ['bitacora', 'menu_book', 'Bitácora'],
        ['materiales', 'inventory_2', 'Materiales'], ['clientes', 'business_center', 'Clientes'], ['empleados', 'group', 'Empleados'],
    ];
    // Al tocar una pestaña simulada se salta a su primer paso (el del Diario, después de los dos de presentación).
    const PRIMER_PASO = {};
    PASOS.forEach((p, i) => { if (i > 1 && p.pestana && PRIMER_PASO[p.pestana] === undefined) PRIMER_PASO[p.pestana] = i; });

    function pintar() {
        if (!raiz) return;
        const p = PASOS[st.paso];
        const ultimo = st.paso === PASOS.length - 1;
        raiz.innerHTML = `
            <div class="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100 text-xs font-medium text-center px-3 py-1.5 shrink-0">Modo práctica · datos de ejemplo, no se guarda nada</div>
            <header class="w-full bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-3 py-3 flex justify-between items-center gap-2 shrink-0">
                <div class="flex items-center gap-2 min-w-0">${icono('engineering', 'text-blue-600 dark:text-blue-400')}<span class="font-semibold truncate">Diario de Obra</span></div>
                <div class="flex items-center gap-1">
                    <span data-foco="cabecera-avisos" class="flex items-center gap-1 rounded-full">
                        <span class="relative p-1.5 text-slate-600 dark:text-slate-300 flex">${icono('chat')}<span class="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full"></span></span>
                        <span class="relative p-1.5 text-slate-600 dark:text-slate-300 flex">${icono('notifications')}</span>
                    </span>
                    <span data-foco="cabecera-perfil" class="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium">${icono('account_circle', 'text-[18px]')}<span class="truncate max-w-[5rem]">${esc(miNombre())}</span>${icono('arrow_drop_down', 'text-[18px]')}</span>
                </div>
            </header>
            <main id="tuto-pantalla" class="flex-1 overflow-y-auto p-4 w-full max-w-2xl mx-auto">${p.pantalla()}<div id="tuto-hueco" class="h-64"></div></main>
            <nav data-foco="nav" class="w-full bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-2 py-2 flex justify-around items-center shrink-0">
                ${NAV.map(([k, ic, txt]) => `<button type="button" data-tuto="pestana" data-pestana="${k}" class="flex flex-col items-center ${p.pestana === k ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}"><span class="material-symbols-outlined px-2 py-1 rounded-full mb-1">${ic}</span><span class="text-[11px] font-medium">${txt}</span></button>`).join('')}
            </nav>
            <div id="tuto-burbuja" role="dialog" aria-modal="true" aria-labelledby="tuto-titulo" class="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-[24rem] z-[230] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex flex-col">
                        <span class="text-[11px] text-slate-500">Paso ${st.paso + 1} de ${PASOS.length}</span>
                        <h2 id="tuto-titulo" class="font-semibold">${p.titulo}</h2>
                    </div>
                    <button type="button" data-tuto="luego" aria-label="Cerrar y recordar más tarde" class="p-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">${icono('close', 'text-[20px]')}</button>
                </div>
                ${p.texto ? `<p data-tuto-texto class="text-sm text-slate-700 dark:text-slate-200">${p.texto}</p>
                <button type="button" data-tuto="explicacion" class="hidden text-xs text-blue-600 dark:text-blue-400 self-start hover:underline">Ver explicación</button>` : ''}
                <div class="h-1 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden"><div class="h-full bg-blue-600" style="width:${Math.round((st.paso + 1) * 100 / PASOS.length)}%"></div></div>
                <div class="flex items-center justify-between gap-2">
                    <button type="button" data-tuto="atras" class="text-sm px-3 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300 ${st.paso === 0 ? 'invisible' : ''}">Atrás</button>
                    <button type="button" data-tuto="siguiente" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-medium text-sm">${ultimo ? 'Terminar' : 'Siguiente'}</button>
                </div>
                ${ultimo ? '' : `<div class="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-zinc-800 pt-2">
                    <button type="button" data-tuto="luego" class="text-xs text-slate-500 hover:underline py-1">Más tarde</button>
                    <button type="button" data-tuto="descartar" class="text-xs text-slate-500 hover:underline py-1">No volver a mostrar</button>
                </div>`}
            </div>`;
        colocar(p);
        if (st.recogida) recogerBurbuja(true);
    }

    // Resalta el elemento del paso y pone la burbuja arriba o abajo para no taparlo.
    function colocar(p) {
        const burbuja = raiz.querySelector('#tuto-burbuja');
        const foco = p.foco ? raiz.querySelector(`[data-foco="${p.foco}"]`) : null;
        burbuja.style.top = ''; burbuja.style.bottom = '';
        if (!foco) { burbuja.style.bottom = '5.5rem'; ajustarHueco(); return; }
        foco.classList.add('tuto-foco');
        const pantalla = raiz.querySelector('#tuto-pantalla');
        if (pantalla.contains(foco)) foco.scrollIntoView({ block: 'start' });
        const r = foco.getBoundingClientRect();
        const enLaParteBaja = (r.top + r.bottom) / 2 > window.innerHeight / 2;
        if (enLaParteBaja) burbuja.style.top = '2.25rem';
        else burbuja.style.bottom = '5.5rem';   // nunca tapa las pestañas de abajo
        ajustarHueco();
    }

    // ---------- Acciones ----------
    function irA(i) {
        st.paso = Math.max(0, Math.min(PASOS.length - 1, i));
        st.recogida = false;
        if (PASOS[st.paso].pantalla === pantallaBuscador) Object.assign(st, { cliente: '', obra: '', direccion: '', localidad: '', foco: 'cliente' });
        pintar();
        const b = raiz && raiz.querySelector('[data-tuto="siguiente"]');
        if (b) b.focus({ preventScroll: true });
    }

    // Deja sitio al final de la pantalla para poder desplazar el contenido por encima de la burbuja.
    function ajustarHueco() {
        const hueco = raiz && raiz.querySelector('#tuto-hueco');
        const burbuja = raiz && raiz.querySelector('#tuto-burbuja');
        if (hueco && burbuja) hueco.style.height = (burbuja.style.top ? 16 : burbuja.offsetHeight + 16) + 'px';
    }
    // Al practicar en la pantalla, la explicación se recoge para que la burbuja tape menos.
    function recogerBurbuja(recoger) {
        const burbuja = raiz && raiz.querySelector('#tuto-burbuja');
        const texto = burbuja && burbuja.querySelector('[data-tuto-texto]');
        if (!texto) return;
        st.recogida = recoger;
        texto.classList.toggle('hidden', recoger);
        burbuja.querySelector('[data-tuto="explicacion"]').classList.toggle('hidden', !recoger);
        ajustarHueco();
    }

    function alPulsar(e) {
        if (e.target.closest('#tuto-pantalla')) recogerBurbuja(true);
        const el = e.target.closest('[data-tuto]');
        if (!el || !raiz.contains(el)) return;
        const a = el.dataset.tuto;
        if (a === 'siguiente') { if (st.paso === PASOS.length - 1) cerrar('visto'); else irA(st.paso + 1); }
        else if (a === 'atras') irA(st.paso - 1);
        else if (a === 'explicacion') recogerBurbuja(false);
        else if (a === 'luego') cerrar('luego');
        else if (a === 'descartar') cerrar('descartado');
        else if (a === 'pestana') irA(PRIMER_PASO[el.dataset.pestana] ?? st.paso);
        else if (a === 'union') { st.union = el.dataset.valor; pintar(); }
        else if (a === 'obra') { st.obraAbierta = st.obraAbierta === el.dataset.valor ? null : el.dataset.valor; pintar(); }
        else if (a === 'filtro') { st.soloMias = el.dataset.mias === '1'; pintar(); }
        else if (a === 'hecha') { const id = Number(el.dataset.id); st.hechas[id] = !st.hechas[id]; pintar(); }
        else if (a === 'sugerencia') elegir(el.dataset.tipo, el.dataset.valor);
        else if (a === 'limpiar') { Object.assign(st, { cliente: '', obra: '', direccion: '', localidad: '', foco: 'cliente' }); repintarBuscador(); }
    }

    function elegir(tipo, valor) {
        if (tipo === 'cliente') {
            st.cliente = valor; st.obra = ''; st.direccion = ''; st.localidad = ''; st.foco = 'obra';
        } else {
            const o = todasObras().find((x) => x.nombre === valor && (!st.cliente || norm(x.cliente) === norm(st.cliente))) || todasObras().find((x) => x.nombre === valor);
            if (o) Object.assign(st, { obra: o.nombre, cliente: o.cliente, direccion: o.direccion, localidad: o.localidad, foco: null });
        }
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        repintarBuscador();
    }

    function alEscribir(e) {
        const el = e.target;
        if (!el.dataset || el.dataset.tuto !== 'campo') return;
        const c = el.dataset.campo;
        st[c] = el.value;
        st.foco = c;
        if (c === 'cliente') { st.obra = ''; }
        st.direccion = ''; st.localidad = '';
        repintarBuscador();
    }
    function alEnfocar(e) {
        const el = e.target;
        if (!el.dataset || el.dataset.tuto !== 'campo') return;   // un botón se recoge al soltar (click), no al pulsar
        recogerBurbuja(true);
        if (st.foco === el.dataset.campo) return;
        st.foco = el.dataset.campo;
        repintarBuscador();
    }
    function alTeclear(e) { if (e.key === 'Escape') cerrar('luego'); }

    // ---------- Estado guardado ----------
    function leerLocal() { try { return localStorage.getItem(CLAVE_LOCAL); } catch (e) { return null; } }
    function estadoGuardado() {
        const pref = yo() && yo().ui_preferencias;
        return (pref && pref.tutorial) || leerLocal() || null;
    }
    async function guardarEstado(valor) {
        try { localStorage.setItem(CLAVE_LOCAL, valor); } catch (e) { /* sin almacenamiento local */ }
        const p = yo();
        if (!p || !p.id || typeof supabaseClient === 'undefined') return;   // cuenta pendiente: queda en el móvil y se copia al entrar
        if (p.ui_preferencias && p.ui_preferencias.tutorial === valor) return;
        p.ui_preferencias = { ...(p.ui_preferencias || {}), tutorial: valor };
        try { await supabaseClient.from('perfiles').update({ ui_preferencias: p.ui_preferencias }).eq('id', p.id); } catch (e) { /* queda en el dispositivo */ }
    }

    function cerrar(motivo) {
        if (!raiz) return;
        raiz.removeEventListener('click', alPulsar);
        raiz.removeEventListener('input', alEscribir);
        raiz.removeEventListener('focusin', alEnfocar);
        document.removeEventListener('keydown', alTeclear);
        raiz.remove();
        raiz = null; st = null;
        document.documentElement.classList.remove('overflow-hidden');
        if (motivo === 'luego') { try { sessionStorage.setItem(CLAVE_LUEGO, '1'); } catch (e) { /* sin más */ } }
        else if (motivo === 'visto' || motivo === 'descartado') {
            // "visto" no pisa un "descartado" anterior: da igual, ninguno de los dos vuelve a mostrarlo solo.
            guardarEstado(motivo);
        }
        window.dispatchEvent(new CustomEvent('tutorialCerrado', { detail: { motivo } }));
    }

    function abrir(desde) {
        if (raiz) return;
        origen = desde || 'app';
        st = nuevoEstado();
        raiz = document.createElement('div');
        raiz.id = 'bomi-tutorial';
        raiz.className = 'fixed inset-0 z-[200] flex flex-col bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100';
        document.body.appendChild(raiz);
        document.documentElement.classList.add('overflow-hidden');
        raiz.addEventListener('click', alPulsar);
        raiz.addEventListener('input', alEscribir);
        raiz.addEventListener('focusin', alEnfocar);
        document.addEventListener('keydown', alTeclear);
        irA(0);
    }

    // Debe salir solo: Operario que no lo ha visto ni descartado y no pulsó "Más tarde" en esta apertura de la app.
    function debeMostrarse() {
        const est = estadoGuardado();
        if (est === 'visto' || est === 'descartado') return false;
        try { if (sessionStorage.getItem(CLAVE_LUEGO)) return false; } catch (e) { /* sin más */ }
        return true;
    }

    window.addEventListener('userLoggedIn', () => {
        const p = yo();
        if (!p) return;
        // Lo vio o descartó mientras esperaba la aprobación: se copia a su perfil.
        const local = leerLocal();
        if ((local === 'visto' || local === 'descartado') && !(p.ui_preferencias && p.ui_preferencias.tutorial)) guardarEstado(local);
        const operario = String(p.rol || '').trim().toLowerCase() === 'operario';
        if (operario && debeMostrarse()) setTimeout(() => { if (window.currentUserProfile) abrir('app'); }, 600);
    });

    window.BomiTutorial = { abrir, cerrar, debeMostrarse };
})();
