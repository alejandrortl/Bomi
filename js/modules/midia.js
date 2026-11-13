// js/modules/midia.js — «Mi día»: la pantalla de inicio de la app.
// Reúne en una sola vista lo que cada uno necesita hoy:
//   · Botones rápidos: Crear parte, Pedir material y Foto de obra.
//   · Mis tareas de hoy (con las pendientes de días anteriores arriba), con Cómo llegar y Llamar.
//     Las tareas hechas que aún no tienen parte de trabajo lo avisan y traen el botón «Hacer el parte».
//   · Mi material pedido que aún no se ha recibido (Pendiente o Pedido).
//   · Mis horas de esta semana (según los partes).
//   · Mensajes sin leer.
// Además lleva la cuenta de altas pendientes de aprobar (solo Admin y SuperAdmin): punto rojo junto al nombre
// y número junto a «Empleados» en el menú.
(function () {
    const db = () => supabaseClient;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const yo = () => window.currentUserProfile || {};
    const nombreDe = (p) => [p.nombre, p.apellido].filter((x) => x && String(x).trim()).join(' ').trim();
    const esAdmin = () => ['admin', 'superadmin'].includes(norm(yo().rol));
    const isoLocal = (d) => d.toLocaleDateString('sv-SE');
    const TARJETA = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 flex flex-col gap-3 shadow-sm';
    const CHIP = 'text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-full inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium';

    let vista = null;
    let datos = { partes: null, material: null, mensajes: null, horas: null };
    let cargando = false;

    // ---------- Fechas ----------
    function semanaActual() {
        const lunes = new Date(); lunes.setHours(12, 0, 0, 0);
        lunes.setDate(lunes.getDate() - ((lunes.getDay() || 7) - 1));
        const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
        // Número de semana ISO
        const d = new Date(Date.UTC(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 3));
        const ene4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        const num = 1 + Math.round(((d - ene4) / 864e5 - 3 + ((ene4.getUTCDay() + 6) % 7)) / 7);
        return { desde: isoLocal(lunes), hasta: isoLocal(domingo), num };
    }
    const ddmm = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}` : ''; };
    function saludo() {
        const h = new Date().getHours();
        return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    }
    function fechaLarga() {
        const t = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    // ---------- Horas ("8", "8,5", "7:30", "7h30") ----------
    function numHoras(v) {
        const t = String(v ?? '').toLowerCase().replace(/\s+/g, '').replace(/horas?|hrs?/g, 'h');
        if (!t) return null;
        let m = /^(\d{1,2})[:h](\d{1,2})m?(in)?$/.exec(t);
        if (m && +m[2] < 60) return +m[1] + (+m[2]) / 60;
        m = /^(\d+(?:[.,]\d+)?)h?$/.exec(t);
        return m ? Number(m[1].replace(',', '.')) : null;
    }
    const soyYo = (o) => (o.operario_id && o.operario_id === yo().id) || (!!o.operario_nombre && norm(o.operario_nombre) === norm(nombreDe(yo())));

    // ---------- Carga de datos (cada bloque por separado: si uno falla, el resto se ve) ----------
    async function cargarPartes() {
        const s = semanaActual();
        // Desde 7 días antes del lunes: así se encuentran también partes de tareas pendientes de la semana pasada.
        const desde = new Date(s.desde + 'T12:00:00'); desde.setDate(desde.getDate() - 7);
        const { data, error } = await db().from('partes_trabajo').select('id, fecha, cliente, obra, partes_operarios ( operario_nombre, operario_id, horas )')
            .gte('fecha', isoLocal(desde)).lte('fecha', s.hasta).limit(3000);
        if (error) throw error;
        datos.partes = data || [];
        let horas = 0;
        datos.partes.filter((p) => (p.fecha || '').slice(0, 10) >= s.desde).forEach((p) => (p.partes_operarios || []).forEach((o) => {
            if (soyYo(o)) { const n = numHoras(o.horas); if (n) horas += n; }
        }));
        datos.horas = { total: horas, semana: s.num };
    }
    async function cargarMaterial() {
        const { data, error } = await db().from('materiales_solicitudes').select('id, cliente, obra, estado, created_by, created_at, materiales_solicitud_items ( cantidad, material )')
            .order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        const mio = norm(nombreDe(yo()));
        datos.material = (data || []).filter((r) => mio && norm(r.created_by) === mio && norm(r.estado) !== 'recibido').slice(0, 6);
    }
    async function cargarMensajes() {
        const p = yo();
        if (!p.id) return;
        const { data, error } = await db().from('notificaciones').select('id, titulo, mensaje, leida, created_at')
            .eq('user_id', p.id).order('created_at', { ascending: false }).limit(30);
        if (error) throw error;
        datos.mensajes = (data || []).filter((n) => !n.leida && norm(n.titulo).startsWith('mensaje de')).slice(0, 3);
    }

    // ---------- Altas pendientes de aprobar (Admin y SuperAdmin) ----------
    async function contarAltas() {
        const badge = document.getElementById('badge-empleados');
        const punto = document.getElementById('badge-perfil');
        let n = 0;
        if (esAdmin()) {
            try {
                let r = await db().from('perfiles').select('id, en_papelera').eq('activo', false);
                if (r.error) r = await db().from('perfiles').select('id').eq('activo', false);
                if (!r.error) n = (r.data || []).filter((e) => e.en_papelera !== true).length;
            } catch (e) { /* sin conexión */ }
        }
        if (badge) { badge.textContent = n ? String(n) : ''; badge.classList.toggle('hidden', !n); }
        if (punto) punto.classList.toggle('hidden', !n);
    }

    // ---------- Pintar ----------
    function tieneParte(t) {
        if (!datos.partes) return true;   // sin datos de partes no se avisa (mejor no molestar que avisar mal)
        const c = norm(t.cliente), o = norm(t.obra);
        return datos.partes.some((p) => norm(p.cliente) === c && norm(p.obra) === o
            && (p.fecha || '').slice(0, 10) >= (t.fecha || '').slice(0, 10)
            && (p.partes_operarios || []).some(soyYo));
    }

    function htmlTarea(x) {
        const t = x.t;
        const hecha = !!t.completada;
        const sinParte = hecha && !tieneParte(t);
        const tel = (x.contactos || []).find((k) => k.telefono);
        const borde = x.falta ? 'border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30' : x.arrastrada ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30' : hecha ? 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50' : 'border-slate-200 dark:border-zinc-800';
        return `
            <div class="border ${borde} rounded-2xl p-3 flex gap-3">
                <button type="button" data-md="hecha" data-id="${esc(t.id)}" data-valor="${!hecha}" aria-label="${hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}"
                    class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${hecha ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-zinc-600 text-transparent hover:text-slate-300'}"><span class="material-symbols-outlined text-[20px]">check</span></button>
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                    ${x.arrastrada ? `<span class="inline-flex self-start items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><span class="material-symbols-outlined text-[14px]">schedule</span>Pendiente desde el ${esc(ddmm(x.desde))}</span>` : ''}
                    ${x.etiquetaFalta || ''}
                    <button type="button" data-md="ver" data-id="${esc(t.id)}" class="text-left flex flex-col gap-1 min-w-0">
                        <span class="font-semibold text-sm break-words ${hecha ? 'line-through text-slate-500' : ''}">${esc(t.cliente || 'Sin cliente')} · ${esc(t.obra || 'Sin obra')}</span>
                        ${!hecha && (t.direccion || t.localidad) ? `<span class="text-xs text-slate-500 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">location_on</span><span class="truncate">${esc([t.direccion, t.localidad].filter(Boolean).join(', '))}</span></span>` : ''}
                        ${!hecha && t.notas ? `<span class="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 break-words">${esc(t.notas)}</span>` : ''}
                    </button>
                    ${!hecha ? (x.subtareasHtml || '') : ''}
                    ${sinParte ? `<span class="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">warning</span>Hecha, pero aún sin parte de trabajo</span>
                        <button type="button" data-md="parte" data-id="${esc(t.id)}" class="self-start text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1 font-medium"><span class="material-symbols-outlined text-[16px]">assignment</span>Hacer el parte</button>` : ''}
                    ${!hecha && (x.mapa || tel) ? `<div class="flex flex-wrap gap-2 pt-1">
                        ${x.mapa ? `<a href="${esc(x.mapa)}" target="_blank" rel="noopener noreferrer" class="${CHIP}"><span class="material-symbols-outlined text-[16px]">map</span>Cómo llegar</a>` : ''}
                        ${tel ? `<a href="${esc(x.tel(tel.telefono))}" class="${CHIP}"><span class="material-symbols-outlined text-[16px]">call</span>Llamar${tel.nombre ? ' a ' + esc(String(tel.nombre).split(' ')[0]) : ''}</a>` : ''}
                    </div>` : ''}
                </div>
            </div>`;
    }

    function htmlTareas() {
        const D = window.BomiDiario && window.BomiDiario.miDia ? window.BomiDiario.miDia() : null;
        if (!D || !D.cargadas) return `<section class="${TARJETA}"><h2 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">list_alt</span>Tus tareas de hoy</h2><p class="text-sm text-slate-500">Cargando…</p></section>`;
        const total = D.tareas.length;
        const hechas = D.tareas.filter((x) => x.t.completada).length;
        const pct = total ? Math.round((hechas / total) * 100) : 0;
        return `
            <section class="${TARJETA}">
                <div class="flex justify-between items-center gap-2">
                    <h2 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">list_alt</span>Tus tareas de hoy</h2>
                    ${total ? `<span class="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full font-semibold shrink-0">${hechas} de ${total} hechas</span>` : ''}
                </div>
                ${total ? `<div class="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="h-full bg-emerald-500 rounded-full transition-all" style="width:${pct}%"></div></div>` : ''}
                ${total ? D.tareas.map(htmlTarea).join('') : '<p class="text-sm text-slate-500 bg-slate-50 dark:bg-zinc-800 rounded-2xl p-3 text-center">Hoy no tienes tareas asignadas.</p>'}
                <p class="text-xs text-slate-500 text-center">${D.manana ? `Mañana tienes ${D.manana} ${D.manana === 1 ? 'tarea' : 'tareas'} · ` : ''}<button type="button" data-md="diario" class="text-blue-600 dark:text-blue-400 font-medium">Ver el Diario</button></p>
            </section>`;
    }

    function htmlMaterial() {
        if (datos.material === null) return '';
        if (!datos.material.length) return '';
        const tono = (e) => norm(e) === 'pedido' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
        return `
            <section class="${TARJETA}">
                <h2 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">inventory_2</span>Tu material sin recibir</h2>
                ${datos.material.map((r) => {
                    const lineas = (r.materiales_solicitud_items || []).map((l) => [l.cantidad, l.material].filter((x) => x !== null && x !== undefined && String(x).trim()).join(' ')).filter(Boolean).join(', ');
                    return `<button type="button" data-md="material" data-id="${esc(r.id)}" class="flex items-center justify-between gap-2 text-left">
                        <span class="min-w-0"><span class="block text-sm font-medium break-words">${esc(r.cliente || 'Sin cliente')} · ${esc(r.obra || 'Sin obra')}</span>${lineas ? `<span class="block text-xs text-slate-500 truncate">${esc(lineas)}</span>` : ''}</span>
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${tono(r.estado)}">${esc(r.estado || 'Pendiente')}</span>
                    </button>`;
                }).join('')}
            </section>`;
    }

    function htmlHoras() {
        if (!datos.horas) return '';
        const h = Number(datos.horas.total.toFixed(2)).toLocaleString('es-ES', { maximumFractionDigits: 2 });
        return `
            <button type="button" data-md="partes" class="${TARJETA} !flex-row items-center justify-between text-left">
                <span><span class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">schedule</span>Tus horas esta semana</span><span class="block text-xs text-slate-500 mt-0.5">Según tus partes (S${esc(datos.horas.semana)})</span></span>
                <span class="text-3xl font-semibold text-blue-600 dark:text-blue-400 shrink-0">${esc(h)} h</span>
            </button>`;
    }

    function htmlMensajes() {
        if (!datos.mensajes || !datos.mensajes.length) return '';
        return `
            <section class="${TARJETA}">
                <h2 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">chat</span>Mensajes sin leer <span class="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">${datos.mensajes.length}</span></h2>
                ${datos.mensajes.map((n) => `<button type="button" data-md="mensajes" class="text-left text-sm break-words"><strong>${esc(String(n.titulo || '').replace(/^mensaje de\s*/i, ''))}:</strong> <span class="line-clamp-2">${esc(n.mensaje || '')}</span></button>`).join('')}
            </section>`;
    }

    function pintar() {
        if (!vista || vista.classList.contains('hidden')) return;
        const nombre = String(yo().nombre || '').trim();
        vista.innerHTML = `
            <div class="pt-1">
                <p class="text-sm text-slate-500 dark:text-slate-400">${esc(fechaLarga())}</p>
                <h1 class="text-2xl font-semibold">${esc(saludo())}${nombre ? ', ' + esc(nombre) : ''}</h1>
            </div>
            <div class="grid grid-cols-3 gap-2">
                <button type="button" data-md="nuevo-parte" class="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 px-1 flex flex-col items-center gap-1 text-xs font-medium shadow-sm active:scale-95 transition-transform"><span class="material-symbols-outlined">assignment</span>Crear parte</button>
                <button type="button" data-md="nuevo-material" class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-3 px-1 flex flex-col items-center gap-1 text-xs font-medium active:scale-95 transition-transform"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">inventory_2</span>Pedir material</button>
                <button type="button" data-md="nueva-foto" class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-3 px-1 flex flex-col items-center gap-1 text-xs font-medium active:scale-95 transition-transform"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">photo_camera</span>Foto de obra</button>
            </div>
            ${htmlTareas()}
            ${htmlMaterial()}
            ${htmlHoras()}
            ${htmlMensajes()}`;
    }

    async function cargar() {
        if (cargando) return;
        cargando = true;
        pintar();
        await Promise.all([
            cargarPartes().catch(() => { datos.partes = null; datos.horas = null; }),
            cargarMaterial().catch(() => { datos.material = null; }),
            cargarMensajes().catch(() => { datos.mensajes = null; }),
            contarAltas(),
        ]);
        cargando = false;
        pintar();
    }

    // ---------- Acciones ----------
    const volverAqui = () => { const b = document.getElementById('nav-midia'); if (b) b.click(); };
    function enlazar() {
        vista.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-md]');
            if (!b) return;
            const a = b.dataset.md, id = b.dataset.id;
            const ir = (navId) => { const n = document.getElementById(navId); if (n) n.click(); };
            if (a === 'hecha') { b.disabled = true; await window.toggleTareaCompletada(id, b.dataset.valor === 'true'); }
            else if (a === 'ver') window.BomiDiario.ver(id, volverAqui);
            else if (a === 'parte') window.BomiDiario.crearParte(id);
            else if (a === 'diario') ir('nav-home');
            else if (a === 'partes') ir('nav-partes');
            else if (a === 'mensajes') ir('btn-mensajes');
            else if (a === 'material') { ir('nav-materiales'); if (window.BomiMateriales && window.BomiMateriales.historial) window.BomiMateriales.historial.ver(id); }
            else if (a === 'nuevo-parte') { ir('nav-partes'); if (window.BomiPartes) window.BomiPartes.nuevoConDatos({}); }
            else if (a === 'nuevo-material') { ir('nav-materiales'); if (window.BomiMateriales) window.BomiMateriales.nuevoConDatos({}); }
            else if (a === 'nueva-foto') {
                // Bitácora → pestaña «Fotográfica» → subir fotos
                ir('nav-bitacora');
                const pest = document.querySelector('#view-bitacora [data-pestana="fotos"]');
                if (pest) pest.click();
                if (window.BomiFotos && document.getElementById('form-fotos')) window.BomiFotos.nuevoConDatos(null);
            }
        });
    }

    function abrir() {
        vista = document.getElementById('view-midia');
        if (!vista) return;
        if (!vista.dataset.enlazada) { vista.dataset.enlazada = '1'; enlazar(); }
        return cargar();
    }

    // Se repinta solo cuando cambian las tareas (al cargar, al marcar hecha…) o vuelve la conexión.
    window.addEventListener('bomiTareasCambiadas', () => pintar());
    window.addEventListener('bomiSincronizado', () => { if (vista && !vista.classList.contains('hidden')) cargar(); });
    window.addEventListener('empleadosActualizados', () => contarAltas());
    window.addEventListener('userLoggedIn', () => setTimeout(contarAltas, 1500));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && vista && !vista.classList.contains('hidden')) cargar(); });

    window.BomiMiDia = { abrir, recargar: cargar, contarAltas };
})();
