// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewFormTarea = document.getElementById('view-form-tarea');
    const viewDetalleTarea = document.getElementById('view-detalle-tarea');
    const viewPartes = document.getElementById('view-partes');
    const viewBitacora = document.getElementById('view-bitacora');
    const viewMateriales = document.getElementById('view-materiales');
    const viewClientes = document.getElementById('view-clientes');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    const viewMiDia = document.getElementById('view-midia');
    
    const navMiDia = document.getElementById('nav-midia');
    const navHome = document.getElementById('nav-home');
    const navPartes = document.getElementById('nav-partes');
    const navBitacora = document.getElementById('nav-bitacora');
    const navMateriales = document.getElementById('nav-materiales');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewParte = document.getElementById('fab-new-parte');
    
    const headerUsernameLabel = document.getElementById('header-username-label');
    const headerAppTitle = document.getElementById('header-app-title');

    let allTareas = [];
    let tareasCargadas = false;
    let allClientesCompletos = [];
    let allOperarios = [];
    let currentTareaItem = null;
    const tareasHechasHoy = new Set(); // tareas arrastradas que se marcan hechas hoy: siguen a la vista hasta recargar
    
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const searchTareasInput = document.getElementById('search-tareas');

    // TEMA
    function aplicarTema(tema) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (tema === 'oscuro' || (tema === 'auto' && prefersDark)) root.classList.add('dark');
        else root.classList.remove('dark');
        try { localStorage.setItem('theme', tema); } catch (e) { /* sin almacenamiento local */ }
    }

    // El tema se elige en Mi Perfil (antes estaba en la barra de arriba). Se guarda en este dispositivo.
    const temaGuardado = () => { try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; } };
    aplicarTema(temaGuardado());
    // En «Automático», si el móvil cambia entre claro y oscuro, la app lo sigue.
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (temaGuardado() === 'auto') aplicarTema('auto'); }); } catch (e) { /* navegador antiguo */ }
    window.BomiTema = { aplicar: aplicarTema, actual: temaGuardado };

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }
    if(filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();

    function hideAllViews() {
        [viewMiDia, viewTaskList, viewFormTarea, viewDetalleTarea, viewPartes, viewBitacora, viewMateriales, document.getElementById('view-mensajes'), viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
            if (v) { v.classList.add('hidden'); v.classList.remove('flex'); }
        });
        [navMiDia, navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-blue-600', 'dark:text-blue-400');
                nav.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        });
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewParte) fabNewParte.classList.add('hidden');
    }

    function setActiveNav(navBtn) {
        if (!navBtn) return;
        navBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        navBtn.classList.add('text-blue-600', 'dark:text-blue-400');
    }

    // NAVEGACIÓN
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); renderTareas(); });
    // «Mi día»: pantalla de inicio con lo de hoy (js/modules/midia.js)
    if (navMiDia) navMiDia.addEventListener('click', () => { hideAllViews(); viewMiDia.classList.remove('hidden'); viewMiDia.classList.add('flex'); setActiveNav(navMiDia); if (window.BomiMiDia) window.BomiMiDia.abrir(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); if (window.BomiEmpleados) window.BomiEmpleados.abrir(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); setActiveNav(navBitacora); if (window.BomiBitacora) window.BomiBitacora.abrir(); });
    if (navPartes) navPartes.addEventListener('click', () => { hideAllViews(); viewPartes.classList.remove('hidden'); viewPartes.classList.add('flex'); setActiveNav(navPartes); if (window.BomiPartes) window.BomiPartes.abrir(); });
    if (navMateriales) navMateriales.addEventListener('click', () => { hideAllViews(); viewMateriales.classList.remove('hidden'); viewMateriales.classList.add('flex'); setActiveNav(navMateriales); if (window.BomiMateriales) window.BomiMateriales.abrir(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); setActiveNav(navClientes); if (window.BomiClientes) window.BomiClientes.abrir(); });

    // MENÚ SUPERIOR (Mi Perfil / Logotipo y empresa / Cerrar sesión)
    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownPerfil = document.getElementById('dropdown-menu-perfil');
    function menuPerfilAbierto() { return !!dropdownPerfil && !dropdownPerfil.classList.contains('hidden'); }
    function cerrarMenuPerfil() {
        if (!dropdownPerfil) return;
        dropdownPerfil.classList.add('hidden');
        dropdownPerfil.classList.remove('flex');
        if (btnMenuPerfil) btnMenuPerfil.setAttribute('aria-expanded', 'false');
    }
    function abrirMenuPerfil() {
        if (!dropdownPerfil) return;
        dropdownPerfil.classList.remove('hidden');
        dropdownPerfil.classList.add('flex');
        if (btnMenuPerfil) btnMenuPerfil.setAttribute('aria-expanded', 'true');
    }
    if (btnMenuPerfil && dropdownPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => { e.stopPropagation(); if (menuPerfilAbierto()) cerrarMenuPerfil(); else abrirMenuPerfil(); });
        document.addEventListener('click', (e) => { if (menuPerfilAbierto() && !dropdownPerfil.contains(e.target)) cerrarMenuPerfil(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuPerfilAbierto()) { cerrarMenuPerfil(); btnMenuPerfil.focus(); } });
    }
    function abrirVistaCuenta(vista, abrir) {
        cerrarMenuPerfil();
        hideAllViews();
        vista.classList.remove('hidden');
        vista.classList.add('flex');
        if (abrir) abrir();
    }
    const itemPerfil = document.getElementById('menu-item-perfil');
    const itemEmpresa = document.getElementById('menu-item-empresa');
    const btnMensajes = document.getElementById('btn-mensajes');
    if (btnMensajes) btnMensajes.addEventListener('click', () => abrirVistaCuenta(document.getElementById('view-mensajes'), () => window.BomiMensajes && window.BomiMensajes.abrir()));
    if (itemPerfil) itemPerfil.addEventListener('click', () => abrirVistaCuenta(viewPerfil, () => window.BomiCuenta && window.BomiCuenta.abrirPerfil()));
    // Empleados: ahora en el menú de tu nombre (antes, botón de la barra de abajo)
    const itemEmpleados = document.getElementById('menu-item-empleados');
    if (itemEmpleados) itemEmpleados.addEventListener('click', () => { cerrarMenuPerfil(); if (navEmpleados) navEmpleados.click(); });
    if (itemEmpresa) itemEmpresa.addEventListener('click', () => abrirVistaCuenta(viewEmpresa, () => window.BomiCuenta && window.BomiCuenta.abrirEmpresa()));
    window.addEventListener('perfilActualizado', actualizarNombreHeader);
    window.addEventListener('empleadosActualizados', () => { actualizarNombreHeader(); loadOperariosList(); });
    window.addEventListener('empresaActualizada', (e) => { if (headerAppTitle && e.detail && e.detail.nombre) headerAppTitle.textContent = e.detail.nombre; });

    async function cargarNombreEmpresa() {
        if (!headerAppTitle) return;
        const { data } = await supabaseClient.from('configuracion_empresa').select('nombre_fiscal').limit(1).single();
        if (data && data.nombre_fiscal) headerAppTitle.textContent = data.nombre_fiscal;
    }

    function actualizarNombreHeader() {
        if (window.currentUserProfile && headerUsernameLabel) {
            headerUsernameLabel.textContent = ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() || window.currentUserProfile.email || 'Cuenta';
        }
    }

    function initAppAfterLogin() {
        actualizarNombreHeader();
        cargarNombreEmpresa();
        loadClientes();
        loadOperariosList();
        loadTasksFromDB();
        if (window.BomiNotificaciones) window.BomiNotificaciones.arrancar();

        // Empleados ya no está en la barra de abajo: se abre desde el menú de tu nombre (para todos los usuarios).
        // Al entrar, la app empieza en «Mi día».
        if (navMiDia && viewTaskList && !viewTaskList.classList.contains('hidden')) navMiDia.click();
        const empresaItem = document.getElementById('menu-item-empresa');
        if (empresaItem) {
            const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
            const admin = rol === 'admin' || rol === 'superadmin';
            empresaItem.classList.toggle('hidden', !admin);
            empresaItem.classList.toggle('flex', admin);
        }
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    // Clientes u obras cambiados desde la pestaña Clientes: refresca el autocompletado de tareas.
    window.addEventListener('clientesActualizados', () => loadClientes());
    window.addEventListener('bomiSincronizado', () => { if (typeof loadTasksFromDB === 'function') loadTasksFromDB(); });
    if (window.currentUserProfile) initAppAfterLogin();

    const escT = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const normT = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

    async function loadClientes() {
        const { data, error } = await supabaseClient.from('clientes').select(`
            id, nombre, nombre_cliente,
            contactos_clientes ( id, nombre, telefono ),
            obras ( id, nombre, direccion, localidad, contacto_nombre, contacto_telefono, contactos_obras ( id, nombre, telefono ) )
        `);
        if (error) return;
        allClientesCompletos = (data || [])
            .map(c => ({ id: c.id, nombre_cliente: String(c.nombre_cliente || c.nombre || '').trim(), contactos: c.contactos_clientes || [], obras: c.obras || [] }))
            .filter(c => c.nombre_cliente)
            .sort((x, y) => x.nombre_cliente.localeCompare(y.nombre_cliente, 'es', { sensitivity: 'base' }));
        const dlClientes = document.getElementById('clientes-datalist');
        if (dlClientes) dlClientes.innerHTML = allClientesCompletos.map(c => `<option value="${escT(c.nombre_cliente)}"></option>`).join('');
        actualizarObrasDatalist();
        // Los contactos se muestran en las tarjetas del Diario: se repinta al llegar los datos.
        if (allTareas.length) renderTareas();
    }

    const nombreOperario = (op) => [op.nombre, op.apellido].filter(x => x && String(x).trim()).join(' ').trim() || op.username || '';

    async function loadOperariosList() {
        const { data, error } = await supabaseClient.from('perfiles').select('id, nombre, apellido, username').eq('activo', true);
        if (error) return;
        allOperarios = (data || []).filter(op => nombreOperario(op))
            .sort((a, b) => nombreOperario(a).localeCompare(nombreOperario(b), 'es', { sensitivity: 'base' }));
        poblarSelectOperarios();
    }

    // El operario se elige de la lista de empleados activos. Si una tarea antigua tiene a alguien que ya no está,
    // se añade como opción para no perder el dato al editarla.
    function poblarSelectOperarios(extra) {
        const sel = document.getElementById('tarea-operario');
        if (!sel) return;
        const actual = extra !== undefined ? extra : sel.value;
        sel.innerHTML = '<option value="">Sin asignar (asignar más tarde)</option>' +
            allOperarios.map(op => `<option value="${escT(nombreOperario(op))}">${escT(nombreOperario(op))}</option>`).join('');
        if (actual && ![...sel.options].some(o => o.value === actual)) sel.insertAdjacentHTML('beforeend', `<option value="${escT(actual)}">${escT(actual)} (ya no activo)</option>`);
        sel.value = actual || '';
    }

    function fechaES(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
        return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
    }

    // Avisa al empleado de que tiene una tarea asignada (aparece en su campana).
    // Lanza el error si falla: la cola de envío lo usa para reintentar cuando vuelve la conexión.
    async function avisoTareaAsignada(d) {
        // Respeta la preferencia del empleado. Si no se puede leer (p. ej. columna aún inexistente), se avisa.
        const { data: pref, error: errPref } = await supabaseClient.from('perfiles').select('preferencias_notificaciones').eq('id', d.operarioId).single();
        if (errPref && window.BomiOffline.esRed(errPref)) throw errPref;
        if (!errPref && pref && pref.preferencias_notificaciones && pref.preferencias_notificaciones.tareas === false) return;
        const { error } = await supabaseClient.from('notificaciones').insert([{
            user_id: d.operarioId,
            titulo: 'Nueva tarea asignada',
            mensaje: `${d.quien} te ha asignado una tarea para el ${fechaES(d.fecha)}: ${d.cliente} · ${d.obra}.`
        }]);
        if (error) throw error;
    }
    window.BomiOffline.registrarGancho('tarea-aviso', avisoTareaAsignada);
    async function notificarAsignacion(operario, tarea, quien) {
        try { await avisoTareaAsignada({ operarioId: operario.id, fecha: tarea.fecha, cliente: tarea.cliente, obra: tarea.obra, quien }); return true; }
        catch (ex) { return false; }
    }

    // --- TAREAS (AUTOCOMPLETAR OBRA, PIZARRA, ETC) ---
    // CLIENTE / OBRA en el formulario de tarea:
    //  - el cliente se elige de los existentes o se escribe uno nuevo;
    //  - las obras sugeridas son SOLO las del cliente elegido (o se escribe una nueva);
    //  - al elegir una obra existente se rellenan (y bloquean) dirección y localidad.
    let tareaObraAutorrellena = false;
    const clienteDeTarea = () => {
        const k = normT(document.getElementById('tarea-cliente').value);
        return k ? allClientesCompletos.find(c => normT(c.nombre_cliente) === k) : undefined;
    };

    function actualizarObrasDatalist() {
        const dl = document.getElementById('tarea-obras-dl');
        if (!dl) return;
        const cli = clienteDeTarea();
        let obras = [];
        if (cli) obras = cli.obras;
        else if (!document.getElementById('tarea-cliente').value.trim()) obras = allClientesCompletos.flatMap(c => c.obras);   // sin cliente: todas las obras
        const vistos = new Set();
        dl.innerHTML = obras.filter(o => { const k = normT(o.nombre); if (vistos.has(k)) return false; vistos.add(k); return true; })
            .map(o => `<option value="${escT(o.nombre)}"></option>`).join('');
    }

    function sincronizarTarea(origen) {
        const inCli = document.getElementById('tarea-cliente');
        const inObra = document.getElementById('tarea-obra');
        const inDir = document.getElementById('tarea-direccion');
        const inLoc = document.getElementById('tarea-localidad');
        const hint = document.getElementById('tarea-hint');
        if (!inCli || !inObra) return;
        let cli = clienteDeTarea();
        let obraAmbigua = false;
        if (!cli && !inCli.value.trim() && inObra.value.trim() && origen === 'obra') {
            // Sin cliente: si el nombre de la obra identifica una sola, se completa también el cliente.
            const coinc = allClientesCompletos.filter(c => c.obras.some(o => normT(o.nombre) === normT(inObra.value)));
            if (coinc.length === 1) { cli = coinc[0]; inCli.value = cli.nombre_cliente; }
            else if (coinc.length > 1) obraAmbigua = true;
        }
        const obra = cli ? cli.obras.find(o => normT(o.nombre) === normT(inObra.value)) : null;
        if (obra) {
            if (origen === 'inicio') {
                // Al editar una tarea guardada no se pisan sus datos: solo se bloquean si coinciden con la obra.
                const coincide = normT(inDir.value) === normT(obra.direccion) && normT(inLoc.value) === normT(obra.localidad);
                inDir.readOnly = coincide; inLoc.readOnly = coincide; tareaObraAutorrellena = coincide;
            } else {
                inDir.value = obra.direccion || ''; inLoc.value = obra.localidad || '';
                inDir.readOnly = true; inLoc.readOnly = true; tareaObraAutorrellena = true;
            }
        } else {
            if (tareaObraAutorrellena) {
                // Cambió el cliente u obra: lo autorrellenado ya no corresponde.
                if (origen === 'cliente') inObra.value = '';
                inDir.value = ''; inLoc.value = '';
                tareaObraAutorrellena = false;
            }
            inDir.readOnly = false; inLoc.readOnly = false;
        }
        actualizarObrasDatalist();
        let msg = '';
        const nombreCli = inCli.value.trim();
        if (obraAmbigua) msg = 'Hay varias obras con ese nombre en distintos clientes: elige primero el cliente.';
        else if (nombreCli && !cli) msg = `«${nombreCli}» es un cliente nuevo: se creará junto con esta obra. Indica dirección y localidad.`;
        else if (cli && inObra.value.trim() && !obra) msg = `Obra nueva en «${cli.nombre_cliente}»: se creará con esta dirección y localidad.`;
        else if (cli && obra) msg = `Obra existente de «${cli.nombre_cliente}»: se usan su dirección y localidad.`;
        if (hint) { hint.textContent = msg; hint.classList.toggle('hidden', !msg); }
    }

    if (window.BomiAuto) window.BomiAuto.registrar({ cliente: 'tarea-cliente', obra: 'tarea-obra', fuente: () => allClientesCompletos.map(c => ({ nombre: c.nombre_cliente, obras: c.obras })) });

    ['tarea-cliente', 'tarea-obra'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const origen = id === 'tarea-cliente' ? 'cliente' : 'obra';
        el.addEventListener('input', () => sincronizarTarea(origen));
        el.addEventListener('change', () => sincronizarTarea(origen));
    });

    // ENLACE DE GOOGLE MAPS en la tarea -> dirección y localidad (mismo servicio que el formulario de obra: api/maps.js)
    let mapsTareaUltimo = '';
    let mapsTareaTimer = null;
    function estadoMapsTarea(texto, tipo) {
        const p = document.getElementById('tarea-maps-estado');
        if (!p) return;
        p.textContent = texto || '';
        p.classList.toggle('hidden', !texto);
        p.classList.remove('text-red-600', 'dark:text-red-400', 'text-amber-600', 'dark:text-amber-400', 'text-slate-500', 'dark:text-slate-400', 'text-green-600', 'dark:text-green-400');
        const color = { error: ['text-red-600', 'dark:text-red-400'], aviso: ['text-amber-600', 'dark:text-amber-400'], ok: ['text-green-600', 'dark:text-green-400'] }[tipo] || ['text-slate-500', 'dark:text-slate-400'];
        p.classList.add(...color);
    }
    function limpiarMapsTarea() {
        clearTimeout(mapsTareaTimer);
        mapsTareaUltimo = '';
        const i = document.getElementById('tarea-maps');
        if (i) i.value = '';
        estadoMapsTarea('');
    }
    async function leerMapsTarea(texto) {
        texto = String(texto || '').trim();
        if (!texto || texto === mapsTareaUltimo) return;
        if (!/https?:\/\//i.test(texto)) { estadoMapsTarea('Eso no parece un enlace. Copia el enlace de Google Maps y vuelve a pegarlo.', 'error'); return; }
        const inDir = document.getElementById('tarea-direccion');
        const inLoc = document.getElementById('tarea-localidad');
        if (inDir.readOnly) { estadoMapsTarea('La obra elegida ya tiene su dirección. Si es otro sitio, escribe una obra nueva y vuelve a pegar el enlace.', 'aviso'); return; }
        mapsTareaUltimo = texto;
        if (navigator.onLine === false) { estadoMapsTarea('Sin conexión: escribe la dirección a mano o inténtalo cuando haya señal.', 'error'); mapsTareaUltimo = ''; return; }
        estadoMapsTarea('Buscando la dirección...');
        try {
            const r = await fetch('/api/maps?texto=' + encodeURIComponent(texto));
            const d = await r.json().catch(() => ({}));
            if (viewFormTarea.classList.contains('hidden') || mapsTareaUltimo !== texto) return; // ventana cerrada o enlace cambiado
            if (!r.ok) throw new Error(d.error || 'No se pudo leer el enlace.');
            if (!d.direccion && !d.localidad) throw new Error('No he podido sacar la dirección de ese enlace. Escríbela a mano.');
            // Si el enlace es de un negocio y la obra está vacía, se propone su nombre como obra.
            const inObra = document.getElementById('tarea-obra');
            if (d.nombre && inObra && !inObra.value.trim()) { inObra.value = d.nombre; sincronizarTarea('obra'); }
            if (inDir.readOnly) { estadoMapsTarea('Esa obra ya existe: se usan su dirección y localidad.', 'ok'); return; }
            if (d.direccion) inDir.value = d.direccion;
            if (d.localidad) inLoc.value = d.localidad;
            if (d.aproximada) estadoMapsTarea('Dirección rellenada. Repásala: es la más cercana al punto del mapa.', 'aviso');
            else estadoMapsTarea('Dirección y localidad rellenadas.', 'ok');
        } catch (ex) {
            mapsTareaUltimo = '';
            estadoMapsTarea(ex && ex.message && !/fetch|network/i.test(ex.message) ? ex.message : 'No se pudo leer el enlace. Escribe la dirección a mano.', 'error');
        }
    }
    const inMapsTarea = document.getElementById('tarea-maps');
    if (inMapsTarea) {
        inMapsTarea.addEventListener('input', () => {
            clearTimeout(mapsTareaTimer);
            const v = inMapsTarea.value;
            if (!v.trim()) { mapsTareaUltimo = ''; estadoMapsTarea(''); return; }
            mapsTareaTimer = setTimeout(() => leerMapsTarea(v), 400);
        });
    }
    const btnPegarMapsTarea = document.getElementById('btn-pegar-maps-tarea');
    if (btnPegarMapsTarea) btnPegarMapsTarea.addEventListener('click', async () => {
        try {
            const t = await navigator.clipboard.readText();
            if (!t || !t.trim()) throw new Error('vacío');
            inMapsTarea.value = t.trim();
            leerMapsTarea(inMapsTarea.value);
        } catch (e) {
            inMapsTarea.focus();
            estadoMapsTarea('No he podido leer lo copiado. Mantén pulsado en la casilla y elige «Pegar».', 'aviso');
        }
    });

    // PIZARRA (la misma que usa la Bitácora: js/modules/pizarra.js)
    // El contenedor lleva "hidden" e "inline-block" a la vez; se alterna con style para que no compitan.
    // El dibujo se guarda en R2 (con copia en Drive) al guardar la tarea, también si se guarda sin conexión.
    // tarea-dibujo-url guarda lo que ya está guardado ("r2:..." o la URL de un dibujo antiguo); lo nuevo espera en dibujoPend.
    let dibujoPend = null;   // { blob, trazos, fondoBlob, fondoCambiado, claveFondo, vista }
    const nubeT = () => window.BomiPizarraNube;
    function setDibujo(url) {
        dibujoPend = null;
        document.getElementById('tarea-dibujo-url').value = url || '';
        pintarDibujo();
    }
    function pintarDibujo() {
        const url = document.getElementById('tarea-dibujo-url').value;
        const prev = document.getElementById('preview-dibujo');
        const img = document.getElementById('img-dibujo-preview');
        const hay = !!(dibujoPend || url);
        if (dibujoPend) img.src = dibujoPend.vista;
        else if (url && nubeT() && nubeT().esNube(url)) { img.removeAttribute('src'); nubeT().enlace(url).then((u) => { if (u && document.getElementById('tarea-dibujo-url').value === url && !dibujoPend) img.src = u; }).catch(() => {}); }
        else if (url) img.src = url;
        if (prev) prev.style.display = hay ? 'inline-block' : 'none';
    }
    const blobADataUrlT = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });

    const btnAbrirPizarra = document.getElementById('btn-abrir-pizarra');
    let abriendoDibujo = false;
    // foto: URL local de una foto de obra que se pone de fondo y se encuadra al abrir (dibujo nuevo).
    async function abrirPizarraTarea(foto) {
        if (!window.BomiPizarra || !nubeT()) { alert('La pizarra no está disponible.'); return; }
        if (abriendoDibujo) return;
        const actualUrl = document.getElementById('tarea-dibujo-url').value;
        let previo = { claveFondo: null, fondoCambiado: false };
        let abrir = {};
        abriendoDibujo = true;
        try {
            if (foto) abrir = { foto };
            else if (dibujoPend) {
                previo = dibujoPend;
                abrir = { fondo: previo.fondoBlob ? URL.createObjectURL(previo.fondoBlob) : '', trazos: previo.trazos };
            } else if (actualUrl) {
                const e = await nubeT().paraEditar(actualUrl);
                previo = { claveFondo: e.claveFondo, fondoCambiado: false };
                abrir = { fondo: e.fondo, trazos: e.trazos };
            }
        } catch (ex) {
            alert('No se pudo abrir el dibujo guardado: ' + window.BomiOffline.mensaje(ex) + '\nPara editarlo hace falta conexión.');
            return;
        } finally { abriendoDibujo = false; }
        const res = await window.BomiPizarra.abrir(abrir);
        if (/^blob:/.test(abrir.fondo || '')) URL.revokeObjectURL(abrir.fondo);
        if (!res) return;
        if (res.vacia) { setDibujo(''); return; }
        dibujoPend = { ...nubeT().pendiente(res, previo), vista: await blobADataUrlT(res.blob) };
        pintarDibujo();
    }
    if (btnAbrirPizarra) {
        btnAbrirPizarra.addEventListener('click', () => abrirPizarraTarea());
        document.getElementById('btn-borrar-dibujo').addEventListener('click', () => setDibujo(''));
    }

    // ---------- Lista de trabajos de una tarea (casillas) ----------
    // tareas.subtareas: [{ id, texto, hecha, hecha_el, hecha_por }]. Los hechos en días anteriores, si la tarea
    // pasó al día siguiente sin terminar, los mueve la base de datos a tareas.subtareas_hechas_antes.
    const listaSub = (t) => (t && Array.isArray(t.subtareas) ? t.subtareas.filter((x) => x && String(x.texto || '').trim()) : []);
    const subAntes = (t) => (t && Array.isArray(t.subtareas_hechas_antes) ? t.subtareas_hechas_antes.filter((x) => x && String(x.texto || '').trim()) : []);
    const idSub = () => (window.BomiOffline && window.BomiOffline.uuid ? window.BomiOffline.uuid() : String(Date.now()) + Math.random().toString(16).slice(2));
    // «Falta por completar»: tiene lista, no está terminada y ya se hizo parte (hoy o en días anteriores).
    function estadoTarea(t) {
        if (t.completada) return 'hecha';
        const l = listaSub(t);
        if (l.length && (l.some((x) => x.hecha) || subAntes(t).length)) return 'falta';
        return 'pendiente';
    }
    const ESTILO_FALTA = 'bg-violet-50 dark:bg-violet-950/30 border border-violet-300 dark:border-violet-800';
    function etiquetaFaltaHtml(t) {
        const quedan = listaSub(t).filter((x) => !x.hecha).length;
        return `<span class="inline-flex items-center self-start gap-1 text-xs font-semibold px-2 py-0.5 whitespace-nowrap rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" data-falta-completar="1"><span class="material-symbols-outlined text-[14px]">timelapse</span>Falta por completar · ${quedan === 1 ? 'queda 1' : 'quedan ' + quedan}</span>`;
    }
    // Casillas que se pueden tocar (Diario, Mi día y detalle).
    function subtareasHtml(t) {
        const l = listaSub(t);
        if (!l.length) return '';
        return '<ul class="flex flex-col" data-subtareas="' + escT(t.id) + '">' + l.map((x) => `
            <li><button type="button" onclick="event.stopPropagation(); window.toggleSubtarea('${escT(t.id)}', '${escT(x.id)}')" role="checkbox" aria-checked="${x.hecha ? 'true' : 'false'}" data-sub="${escT(x.id)}"
                class="w-full text-left flex items-start gap-2 py-1 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 ${x.hecha ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}">
                <span class="material-symbols-outlined text-[22px] shrink-0 ${x.hecha ? 'text-emerald-600' : 'text-slate-400'}">${x.hecha ? 'check_box' : 'check_box_outline_blank'}</span>
                <span class="break-words pt-0.5 ${x.hecha ? 'line-through' : ''}">${escT(x.texto)}</span>
            </button></li>`).join('') + '</ul>';
    }
    // Al crear el parte desde la tarea pasan solo los trabajos marcados como hechos (sin lista: las notas, como antes).
    function detalleParteDeTarea(t) {
        const l = listaSub(t);
        if (!l.length) return t.notas || '';
        // Solo lo hecho hoy: lo de días anteriores ya fue en otro parte (aunque la base de datos aún no lo haya apartado).
        const hoy = getTodayLocalString();
        return l.filter((x) => x.hecha && (!x.hecha_el || x.hecha_el >= hoy)).map((x) => '- ' + String(x.texto).trim()).join('\n');
    }

    // Editor de la lista en el formulario
    let subEdit = [];
    const ulSub = document.getElementById('tarea-subtareas');
    function pintarSubEditor(foco) {
        if (!ulSub) return;
        ulSub.innerHTML = '';
        subEdit.forEach((x, i) => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2';
            li.innerHTML = `<span class="material-symbols-outlined text-[20px] shrink-0 ${x.hecha ? 'text-emerald-600' : 'text-slate-400'}" title="${x.hecha ? 'Hecho' : 'Sin hacer'}">${x.hecha ? 'check_box' : 'check_box_outline_blank'}</span>
                <input type="text" maxlength="200" enterkeyhint="next" placeholder="Trabajo ${i + 1}" class="flex-1 min-w-0 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-2.5 text-sm">
                <button type="button" aria-label="Quitar trabajo" class="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 flex shrink-0"><span class="material-symbols-outlined text-[18px]">close</span></button>`;
            const inp = li.querySelector('input');
            inp.value = x.texto || '';
            inp.addEventListener('input', () => { x.texto = inp.value; });
            inp.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                subEdit.splice(i + 1, 0, { id: idSub(), texto: '', hecha: false });
                pintarSubEditor(i + 1);
            });
            li.querySelector('button').addEventListener('click', () => { subEdit.splice(i, 1); pintarSubEditor(); });
            ulSub.appendChild(li);
        });
        const vacio = document.getElementById('tarea-subtareas-vacio');
        if (vacio) vacio.classList.toggle('hidden', subEdit.length > 0);
        if (foco !== undefined) { const ins = ulSub.querySelectorAll('input'); if (ins[foco]) ins[foco].focus(); }
    }
    function setSubEditor(t) {
        pararDictadoT(); Object.values(dictadosT).forEach((c) => avisoDictadoT(c, ''));
        subEdit = listaSub(t).map((x) => ({ ...x })); pintarSubEditor();
    }
    const btnAddSub = document.getElementById('btn-add-subtarea');
    if (btnAddSub) btnAddSub.addEventListener('click', () => { subEdit.push({ id: idSub(), texto: '', hecha: false }); pintarSubEditor(subEdit.length - 1); });

    // ---------- Dictado por voz en el formulario de tarea ----------
    // Dos botones "Dictar": uno en "Trabajos a hacer" (cada frase, al hacer una pausa, es un trabajo nuevo de la lista)
    // y otro en las notas (el texto se añade al final, como en Partes y Bitácora). Pulsar otra vez para.
    // Si el navegador no sabe dictar (Brave, la app instalada en iPhone...) se explica cómo usar el micrófono del teclado.
    const SRTarea = window.SpeechRecognition || window.webkitSpeechRecognition;
    const tactilT = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const AVISO_TECLADO_T = tactilT()
        ? 'Este navegador no deja dictar desde la app. Usa el micrófono del teclado del móvil (Gboard): pulsa en la casilla y luego en el micrófono del teclado.'
        : 'Este navegador no permite dictar por voz. Prueba con Chrome, Edge o Safari.';
    let dictadoT = null;   // { rec, cfg, parado }
    const dictadosT = {
        trabajos: { btn: 'btn-dictar-trabajos', aviso: 'tarea-dictado-trabajos-aviso', continuo: false,
            ayuda: 'Escuchando. Di un trabajo y haz una pausa: cada frase va en una línea. Pulsa «Parar» al terminar.' },
        notas: { btn: 'btn-dictar-voz', aviso: 'tarea-dictado-notas-aviso', continuo: true, ayuda: '' },
    };
    function pintarDictadoT(cfg, escuchando) {
        const b = document.getElementById(cfg.btn);
        if (!b) return;
        b.classList.toggle('animate-pulse', escuchando);
        b.setAttribute('aria-pressed', escuchando ? 'true' : 'false');
        const ic = b.querySelector('.material-symbols-outlined');
        if (ic) ic.textContent = escuchando ? 'stop_circle' : 'mic';
        const t = b.querySelector('[data-txt]');
        if (t) t.textContent = escuchando ? 'Parar' : 'Dictar';
    }
    function avisoDictadoT(cfg, txt) {
        const p = document.getElementById(cfg.aviso);
        if (!p) return;
        p.textContent = txt || '';
        p.classList.toggle('hidden', !txt);
    }
    function pararDictadoT() {
        if (!dictadoT) return;
        const d = dictadoT; dictadoT = null; d.parado = true;
        try { d.rec.stop(); } catch (e) { /* ya parado */ }
        pintarDictadoT(d.cfg, false);
        if (d.cfg.ayuda) avisoDictadoT(d.cfg, '');
    }
    // Una frase dictada → uno o varios trabajos. También se separa si se dice "punto" o "siguiente trabajo".
    function trabajosDeFrase(frase) {
        return String(frase || '')
            .split(/[.;\n]+|\b(?:punto(?: y aparte| y seguido)?|siguiente trabajo|otro trabajo)\b/i)
            .map((x) => (x || '').replace(/^[\s,]+|[\s,]+$/g, ''))
            .filter(Boolean)
            .map((x) => x.charAt(0).toLocaleUpperCase('es') + x.slice(1));
    }
    function añadirTrabajosDictados(frase) {
        const nuevos = trabajosDeFrase(frase);
        if (!nuevos.length) return;
        // Si la última línea está vacía (se pulsó "Añadir trabajo"), se rellena esa en vez de dejarla en blanco.
        const ult = subEdit[subEdit.length - 1];
        if (ult && !String(ult.texto || '').trim()) ult.texto = nuevos.shift();
        nuevos.forEach((texto) => subEdit.push({ id: idSub(), texto, hecha: false }));
        pintarSubEditor();
    }
    function añadirNotasDictadas(frase) {
        const area = document.getElementById('tarea-notas');
        const t = String(frase || '').trim();
        if (!area || !t) return;
        const antes = area.value.trimEnd();
        // Tras un punto (o con la casilla vacía) se empieza en mayúscula.
        const txt = (!antes || /[.!?]$/.test(antes)) ? t.charAt(0).toLocaleUpperCase('es') + t.slice(1) : t;
        area.value = (antes ? antes + ' ' : '') + txt;
    }
    function arrancarDictadoT(cfg, alTexto) {
        const rec = new SRTarea();
        rec.lang = 'es-ES'; rec.continuous = cfg.continuo; rec.interimResults = false; rec.maxAlternatives = 1;
        const d = { rec, cfg, parado: false, oido: false, alguno: false };
        dictadoT = d;
        rec.onresult = (ev) => {
            let nuevo = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) nuevo += ev.results[i][0].transcript + ' ';
            if (dictadoT !== d || (viewFormTarea && viewFormTarea.classList.contains('hidden'))) { pararDictadoT(); return; }
            if (nuevo.trim()) { d.oido = true; d.alguno = true; alTexto(nuevo.trim()); }
        };
        rec.onerror = (ev) => {
            if (ev.error === 'aborted') return;
            if (ev.error === 'no-speech' && d.alguno) { pararDictadoT(); return; }   // pausa larga tras dictar: se para sin más
            pararDictadoT();
            if (ev.error === 'not-allowed') avisoDictadoT(cfg, 'No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.');
            else if (ev.error === 'no-speech') avisoDictadoT(cfg, 'No se oyó nada. Pulsa «Dictar» y vuelve a hablar.');
            else if (ev.error === 'network' || ev.error === 'service-not-allowed' || ev.error === 'language-not-supported') avisoDictadoT(cfg, navigator.onLine === false ? 'El dictado necesita conexión a internet.' : AVISO_TECLADO_T);
            else avisoDictadoT(cfg, 'No se pudo dictar (' + ev.error + ').');
        };
        rec.onend = () => {
            if (dictadoT !== d) return;
            // En la lista se escucha frase a frase: tras cada frase oída se vuelve a escuchar hasta que se pulse "Parar".
            if (!cfg.continuo && d.oido && !d.parado) {
                d.oido = false;
                try { rec.start(); return; } catch (e) { /* se para abajo */ }
            }
            pararDictadoT();
        };
        pintarDictadoT(cfg, true);
        if (cfg.ayuda) avisoDictadoT(cfg, cfg.ayuda); else avisoDictadoT(cfg, '');
        try { rec.start(); } catch (e) { pararDictadoT(); avisoDictadoT(cfg, 'No se pudo iniciar el micrófono.'); }
    }
    function alternarDictadoT(clave) {
        const cfg = dictadosT[clave];
        const eraEste = dictadoT && dictadoT.cfg === cfg;
        pararDictadoT();
        if (eraEste) return;
        Object.values(dictadosT).forEach((c) => avisoDictadoT(c, ''));
        if (!SRTarea) {
            // Sin dictado en el navegador: se abre el teclado en la casilla para usar su micrófono.
            if (clave === 'trabajos') {
                const ult = subEdit[subEdit.length - 1];
                if (!ult || String(ult.texto || '').trim()) subEdit.push({ id: idSub(), texto: '', hecha: false });
                pintarSubEditor(subEdit.length - 1);
            } else { const a = document.getElementById('tarea-notas'); if (a) a.focus(); }
            avisoDictadoT(cfg, AVISO_TECLADO_T);
            return;
        }
        arrancarDictadoT(cfg, clave === 'trabajos' ? añadirTrabajosDictados : añadirNotasDictadas);
    }
    ['trabajos', 'notas'].forEach((clave) => {
        const b = document.getElementById(dictadosT[clave].btn);
        if (b) b.addEventListener('click', (e) => { e.preventDefault(); alternarDictadoT(clave); });
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pararDictadoT(); });

    if (fabNewTask) {
        fabNewTask.addEventListener('click', () => {
            document.getElementById('form-tarea-title').textContent = "Nueva Tarea";
            document.getElementById('form-tarea').reset();
            document.getElementById('edit-tarea-id').value = "";
            document.getElementById('tarea-fecha').value = getTodayLocalString();
            // Por defecto "Sin asignar": quien la crea suele asignarla a otro más tarde (puede elegirse a sí mismo).
            poblarSelectOperarios('');
            setDibujo('');
            limpiarMapsTarea();
            setSubEditor(null);
            sincronizarTarea('inicio');
            // Se abre como ventana encima de la pantalla actual (igual que Partes, Bitácora y Materiales)
            viewFormTarea.classList.remove('hidden');
            viewFormTarea.classList.add('flex');
        });
    }

    // Al abrir una tarea desde otra pantalla (p. ej. el historial de una obra en Clientes), al terminar se vuelve allí.
    let volverA = null;
    function salirTarea() {
        pararDictadoT();
        const f = volverA;
        volverA = null;
        if (f) f(); else navHome.click();
    }
    [navMiDia, navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => { if (nav) nav.addEventListener('click', () => { volverA = null; }, true); });
    document.getElementById('btn-cancel-tarea').addEventListener('click', salirTarea);
    // Cerrar la ventana de tarea (X, tocar fuera o Escape): igual que Cancelar
    function cerrarFormTarea() {
        if (!viewFormTarea || viewFormTarea.classList.contains('hidden')) return;
        pararDictadoT();
        viewFormTarea.classList.add('hidden'); viewFormTarea.classList.remove('flex');
        // Si debajo no queda ninguna pantalla (se abrió desde otro sitio), se vuelve como con Cancelar
        const debajo = [viewTaskList, viewDetalleTarea, viewPartes, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa, document.getElementById('view-mensajes')].some((v) => v && !v.classList.contains('hidden'));
        if (!debajo) salirTarea(); else volverA = null;
    }
    document.getElementById('btn-cerrar-form-tarea').addEventListener('click', cerrarFormTarea);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarFormTarea(); });
    document.getElementById('btn-back-tarea-list').addEventListener('click', salirTarea);
    // Pueden editar y eliminar una tarea: Admin/SuperAdmin y quien la creó.
    const puedeGestionarTarea = (t) => {
        const yo = window.currentUserProfile || {};
        const admin = ['admin', 'superadmin'].includes(String(yo.rol ?? '').trim().toLowerCase());
        return !!t && (admin || (!!yo.id && t.user_id === yo.id));
    };
    document.getElementById('btn-editar-tarea').addEventListener('click', () => { if (currentTareaItem && puedeGestionarTarea(currentTareaItem)) window.editarTarea(currentTareaItem.id); });
    // Crear un parte, una bitácora o un pedido de material con los datos de la tarea que se está viendo.
    const datosDeTarea = (t) => ({ cliente: t.cliente || '', obra: t.obra || '', direccion: t.direccion || '', localidad: t.localidad || '' });
    document.getElementById('btn-tarea-crear-parte').addEventListener('click', () => {
        const t = currentTareaItem; if (!t || !window.BomiPartes) return;
        navPartes.click();
        window.BomiPartes.nuevoConDatos({ ...datosDeTarea(t), detalle: detalleParteDeTarea(t) });
    });
    document.getElementById('btn-tarea-crear-bitacora').addEventListener('click', () => {
        const t = currentTareaItem; if (!t || !window.BomiBitacora) return;
        navBitacora.click();
        window.BomiBitacora.nuevoConDatos({ ...datosDeTarea(t), notas: t.notas || '' });
    });
    document.getElementById('btn-tarea-pedir-material').addEventListener('click', () => {
        const t = currentTareaItem; if (!t || !window.BomiMateriales) return;
        navMateriales.click();
        window.BomiMateriales.nuevoConDatos(datosDeTarea(t));
    });
    // Devuelve true si se eliminó.
    async function eliminarTarea(t) {
        if (!t || !puedeGestionarTarea(t)) return false;
        if (!(await BomiDialogo.confirmar('¿Eliminar esta tarea?\n\n' + (t.cliente || '') + (t.obra ? ' - ' + t.obra : '') + '\nNo se puede deshacer.'))) return false;
        try {
            const { data, error } = await supabaseClient.from('tareas').delete().eq('id', t.id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('no tienes permiso o la tarea ya no existe');
            if (currentTareaItem && currentTareaItem.id === t.id) currentTareaItem = null;
            await loadTasksFromDB();
            return true;
        } catch (ex) {
            alert('No se pudo eliminar la tarea: ' + (ex.message || ex));
            return false;
        }
    }
    document.getElementById('btn-eliminar-tarea').addEventListener('click', async () => {
        const btn = document.getElementById('btn-eliminar-tarea');
        btn.disabled = true;
        try { if (await eliminarTarea(currentTareaItem)) salirTarea(); }
        finally { btn.disabled = false; }
    });

    let guardandoTarea = false;
    document.getElementById('form-tarea').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (guardandoTarea) return;
        const O = window.BomiOffline;
        const cName = document.getElementById('tarea-cliente').value.trim();
        const oName = document.getElementById('tarea-obra').value.trim();
        const dName = document.getElementById('tarea-direccion').value.trim();
        const lName = document.getElementById('tarea-localidad').value.trim();
        const editId = document.getElementById('edit-tarea-id').value;

        const username = window.currentUserProfile ? nombreOperario(window.currentUserProfile) || 'Usuario' : 'Usuario';
        const operarioNombre = document.getElementById('tarea-operario').value.trim();
        const itemOriginal = editId ? allTareas.find(t => t.id === editId) : null;
        const operario = allOperarios.find(op => nombreOperario(op) === operarioNombre);
        const mantieneOperario = !!itemOriginal && itemOriginal.operario_asignado === operarioNombre;
        // El operario es opcional: una tarea se puede crear "Sin asignar" y asignarla más tarde.
        if (operarioNombre && !operario && !mantieneOperario) {
            alert('Selecciona un empleado de la lista como operario asignado, o deja "Sin asignar".');
            return;
        }
        const notas = document.getElementById('tarea-notas').value.trim();
        const dibujoUrl = document.getElementById('tarea-dibujo-url').value;
        const tareaData = {
            cliente: cName, obra: oName, direccion: dName, localidad: lName,
            operario_asignado: operarioNombre || null,
            operario_username: !operarioNombre ? null : (operario ? operario.username : itemOriginal.operario_username),
            fecha: document.getElementById('tarea-fecha').value,
            notas,
            dibujo_url: dibujoUrl
        };
        // Lista de trabajos (solo se envía si hay o había lista: así las tareas sin lista no dependen de la columna nueva).
        const subtareas = subEdit.map((x) => ({ ...x, texto: String(x.texto || '').trim() })).filter((x) => x.texto);
        if (subtareas.length || listaSub(itemOriginal).length) {
            tareaData.subtareas = subtareas;
            // Al editar: si se añade un trabajo a una tarea hecha, vuelve a quedar sin terminar (y al revés).
            if (editId && subtareas.length) tareaData.completada = subtareas.every((x) => x.hecha);
        }
        const pendDibujo = dibujoPend;
        // PDF con lo que hay escrito (por si no se puede guardar).
        const pdfTarea = () => ({
            items: itemsPdfTarea({ ...tareaData, created_by: username, completada: false, dibujo_url: pendDibujo ? pendDibujo.vista : dibujoUrl }),
            nombre: window.BomiPdf.nombreSeguro(['tarea', tareaData.fecha, cName, oName], 80)
        });

        const btn = document.getElementById('btn-submit-tarea');
        const textoBtn = btn.textContent;
        guardandoTarea = true; btn.disabled = true; btn.textContent = 'Guardando...';
        try {
            // Cliente y obra nuevos (se crean junto con la tarea).
            const pasos = [];
            let creados = false;
            const cliEncontrado = clienteDeTarea();
            let clienteId;
            if (!cliEncontrado) {
                clienteId = O.uuid();
                pasos.push({ k: 'insert', tabla: 'clientes', filas: [{ id: clienteId, nombre_cliente: cName, nombre: cName }] });
                creados = true;
            } else { clienteId = cliEncontrado.id; }
            const obraEncontrada = cliEncontrado && cliEncontrado.obras.find(o => normT(o.nombre) === normT(oName));
            if (!obraEncontrada) {
                pasos.push({ k: 'insert', tabla: 'obras', filas: [{ id: O.uuid(), cliente_id: clienteId, nombre: oName, direccion: dName, localidad: lName }] });
                creados = true;
            }
            const tareaId = editId || O.uuid();
            if (pendDibujo) {
                // El dibujo va a R2 (con copia en Drive) antes que la tarea que lo usa.
                const sp = nubeT().plan(pendDibujo, { origen: 'tarea', registroId: tareaId, cliente: cName, obra: oName, clienteId });
                pasos.push(...sp.pasos);
                tareaData.dibujo_url = sp.valor;
            }
            const avisoDatos = operario && (!window.currentUserProfile || operario.id !== window.currentUserProfile.id)
                ? { operarioId: operario.id, fecha: tareaData.fecha, cliente: cName, obra: oName, quien: username } : null;

            if (!editId) {
                // Una tarea nueva se puede guardar sin conexión: queda en el móvil y se envía sola.
                // La tabla exige un título de la tarea y el usuario que la crea (la política de acceso lo comprueba).
                tareaData.tarea = (notas.split('\n')[0] || '').slice(0, 120) || `${oName}`;
                tareaData.user_id = window.currentUserProfile ? window.currentUserProfile.id : null;
                tareaData.created_by = username;
                tareaData.completada = false;
                pasos.push({ k: 'insert', tabla: 'tareas', deshacer: true, filas: [{ id: tareaId, ...tareaData }] });
                if (avisoDatos) pasos.push({ k: 'gancho', nombre: 'tarea-aviso', datos: avisoDatos });
                const r = await O.guardar({ tipo: 'diario', etiqueta: `Tarea del ${fechaES(tareaData.fecha)} · ${cName} · ${oName}`, pasos, clientes: creados, pdf: pdfTarea() });
                dibujoPend = null;
                if (r.estado === 'enviado') {
                    if (creados) window.dispatchEvent(new CustomEvent('clientesActualizados'));
                    await loadTasksFromDB();
                }
                salirTarea();
                return;
            }

            // Editar (requiere conexión).
            if (pasos.length) await O.correr(pasos);
            tareaData.updated_by = username;
            const { error } = await supabaseClient.from('tareas').update(tareaData).eq('id', editId);
            if (error) throw error;
            dibujoPend = null;
            if (creados) window.dispatchEvent(new CustomEvent('clientesActualizados'));
            // Aviso al empleado asignado al cambiar de empleado.
            const cambioOperario = !itemOriginal || itemOriginal.operario_asignado !== operarioNombre;
            if (cambioOperario && avisoDatos) {
                const enviado = await notificarAsignacion(operario, tareaData, username);
                if (!enviado) alert('La tarea se guardó, pero no se pudo avisar a ' + operarioNombre + '.');
            }
            await loadTasksFromDB();
            salirTarea();
        } catch (ex) {
            const sinRed = O.esRed(ex);
            const motivo = sinRed ? 'Sin conexión o con la señal muy débil.' : O.mensaje(ex);
            const msg = 'No se pudo guardar la tarea: ' + motivo + (sinRed && editId ? '\n\nLos cambios no se han guardado. Vuelve a pulsar Guardar cuando tengas conexión.' : '') + '\n\n¿Quieres guardar lo escrito en PDF?';
            if ((await BomiDialogo.confirmar(msg))) {
                try { const r = pdfTarea(); await window.BomiPdf.generar(r.items, r.nombre); }
                catch (x) { alert('No se pudo crear el PDF: ' + O.mensaje(x)); }
            }
        } finally {
            guardandoTarea = false; btn.disabled = false; btn.textContent = textoBtn;
        }
    });

    async function loadTasksFromDB() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        // Las tareas cuyo día acabó sin completarse quedan pendientes y sin operario (lo hace la base de datos).
        try { await supabaseClient.rpc('pasar_tareas_pendientes'); } catch (e) { /* sin conexión o sin la migración: se sigue */ }
        const { data, error } = await supabaseClient.from('tareas').select('*');
        if (error) {
            c.innerHTML = `<p class="text-red-500 text-center mt-4">Error al cargar tareas: ${error.message}</p>`;
            return;
        }
        allTareas = data || [];
        tareasCargadas = true;
        renderTareas();
        window.dispatchEvent(new CustomEvent('bomiTareasCambiadas'));
        window.dispatchEvent(new CustomEvent('bomiRegistrosCambiados', { detail: { tipo: 'diario' } }));
    }

    if(searchTareasInput) searchTareasInput.addEventListener('input', renderTareas);
    if(filtroFechaDiario) filtroFechaDiario.addEventListener('change', renderTareas);

    // ---- Día de la agenda: flechas ◀ ▶, botón «Hoy» y nombre del día (Hoy, Mañana, Ayer o el día de la semana) ----
    function sumarDias(iso, n) {
        const [a, m, d] = String(iso || getTodayLocalString()).split('-').map(Number);
        const f = new Date(a, m - 1, d + n);
        return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    }
    function pintarDiaAgenda() {
        const hoy = getTodayLocalString();
        const sel = (filtroFechaDiario && filtroFechaDiario.value) || hoy;
        const nombre = document.getElementById('diario-dia-nombre');
        const btnHoy = document.getElementById('diario-hoy');
        if (nombre) {
            let txt;
            if (sel === hoy) txt = 'Hoy';
            else if (sel === sumarDias(hoy, 1)) txt = 'Mañana';
            else if (sel === sumarDias(hoy, -1)) txt = 'Ayer';
            else { const [a, m, d] = sel.split('-').map(Number); txt = new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long' }); txt = txt.charAt(0).toUpperCase() + txt.slice(1); }
            nombre.textContent = txt;
        }
        if (btnHoy) { btnHoy.classList.toggle('hidden', sel === hoy); }
    }
    function cambiarDiaAgenda(iso) {
        if (!filtroFechaDiario) return;
        filtroFechaDiario.value = iso;
        renderTareas();
    }
    const btnDiaAnterior = document.getElementById('diario-dia-anterior');
    const btnDiaSiguiente = document.getElementById('diario-dia-siguiente');
    const btnDiaHoy = document.getElementById('diario-hoy');
    if (btnDiaAnterior) btnDiaAnterior.addEventListener('click', () => cambiarDiaAgenda(sumarDias(filtroFechaDiario.value, -1)));
    if (btnDiaSiguiente) btnDiaSiguiente.addEventListener('click', () => cambiarDiaAgenda(sumarDias(filtroFechaDiario.value, 1)));
    if (btnDiaHoy) btnDiaHoy.addEventListener('click', () => cambiarDiaAgenda(getTodayLocalString()));

    // ---- Dirección (Google Maps) y personas de contacto (llamada) en el Diario ----
    const telHrefT = (t) => 'tel:' + String(t ?? '').replace(/[^\d+]/g, '');
    const mapsHrefT = (dir, loc) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([dir, loc].filter(Boolean).join(', '));

    function direccionLinkHtml(t, conIcono) {
        const txt = [t.direccion, t.localidad].map(x => String(x || '').trim()).filter(Boolean).join(', ');
        if (!txt) return '';
        return `<a href="${escT(mapsHrefT(t.direccion, t.localidad))}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="inline-flex items-start gap-1 text-blue-600 dark:text-blue-400 hover:underline">${conIcono ? '<span class="material-symbols-outlined text-[16px] mt-0.5">location_on</span>' : ''}<span>${escT(txt)}</span></a>`;
    }

    // Contactos de la obra de la tarea (y del cliente), sin repetir teléfonos.
    function contactosDeTarea(t) {
        const cli = allClientesCompletos.find(c => normT(c.nombre_cliente) === normT(t.cliente));
        if (!cli) return [];
        const obra = cli.obras.find(o => normT(o.nombre) === normT(t.obra));
        const lista = [];
        if (obra) {
            (obra.contactos_obras || []).forEach(k => lista.push({ nombre: k.nombre, telefono: k.telefono }));
            if (!lista.length && (obra.contacto_nombre || obra.contacto_telefono)) lista.push({ nombre: obra.contacto_nombre, telefono: obra.contacto_telefono });
        }
        (cli.contactos || []).forEach(k => lista.push({ nombre: k.nombre, telefono: k.telefono }));
        const vistos = new Set();
        return lista
            .map(k => ({ nombre: String(k.nombre || '').trim(), telefono: String(k.telefono || '').trim() }))
            .filter(k => k.nombre || k.telefono)
            .filter(k => { const clave = k.telefono ? k.telefono.replace(/\D/g, '') : normT(k.nombre); if (vistos.has(clave)) return false; vistos.add(clave); return true; });
    }

    function contactosHtmlT(t) {
        const lista = contactosDeTarea(t);
        if (!lista.length) return '';
        return '<ul class="flex flex-col gap-1 mt-2">' + lista.map(k => `
            <li class="flex items-center gap-1.5 text-sm">
                <span class="material-symbols-outlined text-[16px] text-slate-400">call</span>
                ${k.nombre ? `<span class="text-slate-600 dark:text-slate-300">${escT(k.nombre)}</span>` : ''}
                ${k.telefono ? `<a href="${escT(telHrefT(k.telefono))}" onclick="event.stopPropagation()" class="text-blue-600 dark:text-blue-400 font-medium hover:underline">${escT(k.telefono)}</a>` : ''}
            </li>`).join('') + '</ul>';
    }

    // Todas las tareas / solo las asignadas al usuario actual (la elección se guarda en su perfil; por defecto, las suyas)
    const CLAVE_LOCAL_DIARIO = 'bomi_diario_solo_mias';
    function leerSoloMias() {
        const pref = window.currentUserProfile && window.currentUserProfile.ui_preferencias;
        if (pref && pref.diario_solo_mias !== undefined) return !!pref.diario_solo_mias;
        try { const v = localStorage.getItem(CLAVE_LOCAL_DIARIO); return v === null ? true : v === '1'; } catch (e) { return true; } // por defecto: mis tareas
    }
    function pintarInterruptorDiario() {
        const mias = leerSoloMias();
        document.querySelectorAll('#view-task-list [data-filtro-diario]').forEach((b) => {
            const act = (b.dataset.filtroDiario === 'mias') === mias;
            b.className = 'flex-1 py-2 rounded-full text-sm font-medium transition-colors ' + (act ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300');
            b.setAttribute('aria-pressed', act ? 'true' : 'false');
        });
    }
    async function guardarSoloMias(v) {
        const p = window.currentUserProfile;
        if (p) p.ui_preferencias = { ...(p.ui_preferencias || {}), diario_solo_mias: v };
        try { localStorage.setItem(CLAVE_LOCAL_DIARIO, v ? '1' : '0'); } catch (e) { /* sin almacenamiento local */ }
        if (p) { try { await supabaseClient.from('perfiles').update({ ui_preferencias: p.ui_preferencias }).eq('id', p.id); } catch (e) { /* queda en el dispositivo */ } }
    }
    const esMiaTarea = (t) => {
        const p = window.currentUserProfile;
        if (!p) return false;
        if (normT(t.operario_asignado) === '') return false; // sin operario (o pendiente de otro día que se quedó sin asignar): solo sale en «Todas las tareas»
        return normT(t.operario_asignado) === normT(nombreOperario(p));
    };
    document.querySelectorAll('#view-task-list [data-filtro-diario]').forEach((b) => b.addEventListener('click', () => {
        const mias = b.dataset.filtroDiario === 'mias';
        if (mias === leerSoloMias()) return;
        guardarSoloMias(mias);
        pintarInterruptorDiario();
        renderTareas();
    }));

    // Tareas que se ven en un día: las de esa fecha y, en el día de hoy, las pendientes de días anteriores.
    // Ordenadas: pendientes arrastradas primero, luego el resto y las hechas al final. (La usan el Diario y «Mi día».)
    function tareasDelDia(fechaSelect, searchTxt, soloMias) {
        // Las tareas sin completar de días anteriores pasan al día de hoy (conservan su fecha original)
        // con la etiqueta "Pendiente desde el DD/MM". Si se marcan hechas hoy, siguen visibles hasta recargar.
        const hoy = getTodayLocalString();
        const esArrastrada = (t) => {
            const tFecha = t.fecha ? t.fecha.split('T')[0] : '';
            return searchTxt === '' && fechaSelect === hoy && tFecha !== '' && tFecha < hoy && (!t.completada || tareasHechasHoy.has(t.id));
        };
        let filtradas = allTareas.filter(t => {
            if (soloMias && !esMiaTarea(t)) return false;
            const tFecha = t.fecha ? t.fecha.split('T')[0] : '';
            if (searchTxt === '') {
                if (tFecha !== fechaSelect && !esArrastrada(t)) return false;
            } else {
                const fullText = `${t.cliente || ''} ${t.obra || ''} ${t.direccion || ''} ${t.localidad || ''} ${t.operario_asignado || ''} ${t.fecha || ''} ${t.notas || ''} ${t.created_by || ''} ${listaSub(t).map((x) => x.texto).join(' ')}`.toLowerCase();
                if (!fullText.includes(searchTxt)) return false;
            }
            return true;
        });

        // Las tareas realizadas van al final (completada puede venir null/false/true: se compara como booleano)
        // Entre las pendientes, primero las arrastradas de días anteriores (la más antigua arriba).
        const fechaOrden = (t) => (t.fecha ? t.fecha.split('T')[0] : '');
        filtradas.sort((a, b) => {
            const d = Number(!!a.completada) - Number(!!b.completada);
            if (d) return d;
            const desdeDe = (t) => String(t.pendiente_desde || fechaOrden(t)).slice(0, 10);
            const pend = (t) => esArrastrada(t) || (!!t.pendiente_desde && desdeDe(t) < fechaOrden(t));
            const aa = pend(a), ab = pend(b);
            if (aa !== ab) return aa ? -1 : 1;
            if (aa && ab) return desdeDe(a) < desdeDe(b) ? -1 : desdeDe(a) > desdeDe(b) ? 1 : 0;
            return 0;
        });
        return { filtradas, esArrastrada, fechaOrden };
    }

    function renderTareas() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        pintarDiaAgenda();
        const fechaSelect = filtroFechaDiario.value;
        const searchTxt = searchTareasInput.value.toLowerCase().trim();

        const soloMias = leerSoloMias();
        pintarInterruptorDiario();
        const { filtradas, esArrastrada, fechaOrden } = tareasDelDia(fechaSelect, searchTxt, soloMias);

        c.innerHTML = '';

        if (filtradas.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">' + (soloMias ? 'No tienes tareas asignadas con estos criterios.' : 'No se encontraron tareas con estos criterios.') + '</p>';
            return;
        }

        filtradas.forEach(t => {
            const isComp = t.completada;
            const falta = estadoTarea(t) === 'falta';
            const cardBg = isComp ? 'bg-slate-100 dark:bg-zinc-800 opacity-75' : falta ? ESTILO_FALTA : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';
            const div = document.createElement('div');
            div.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2`;
            // Etiqueta "Pendiente desde": al pasar a hoy, o si un administrador la reasignó a otro día.
            const desde = String(t.pendiente_desde || fechaOrden(t)).slice(0, 10);
            const arrastrada = !isComp && (esArrastrada(t) || (!!t.pendiente_desde && desde < fechaOrden(t)));
            const [, mm, dd] = desde.split('-');
            const etiquetaPendiente = arrastrada ? `<span class="inline-flex items-center self-start gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" data-pendiente-desde="${escT(desde)}"><span class="material-symbols-outlined text-[14px]">schedule</span>Pendiente desde el ${escT(dd)}/${escT(mm)}</span>` : '';
            div.innerHTML = `
                ${etiquetaPendiente || falta ? `<div class="flex flex-wrap gap-1.5">${etiquetaPendiente}${falta ? etiquetaFaltaHtml(t) : ''}</div>` : ''}
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">${escT(t.cliente || 'Sin cliente')} - ${escT(t.obra || 'Sin obra')}</span>
                    <div class="flex items-center gap-2 shrink-0 ml-2">
                    <button type="button" onclick="window.verDetalleTarea('${escT(t.id)}')" aria-label="Ver tarea" title="Ver tarea" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"><span class="material-symbols-outlined text-[20px]">visibility</span></button>
                    <button onclick="window.toggleTareaCompletada('${escT(t.id)}', ${!isComp})" aria-label="${isComp ? 'Marcar como pendiente' : 'Marcar como completada'}" class="w-8 h-8 rounded-full flex items-center justify-center border-2 ${isComp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent hover:border-blue-500'}"><span class="material-symbols-outlined text-[18px]">check</span></button>
                    </div>
                </div>
                <div class="text-sm cursor-pointer" onclick="window.verDetalleTarea('${escT(t.id)}')">
                    <p>📅 <strong>Fecha:</strong> ${escT(t.fecha || 'N/D')} | 👷 <strong>Operario:</strong> ${escT(t.operario_asignado || 'Sin asignar')}</p>
                    ${!t.operario_asignado && t.operario_original ? `<p class="text-xs text-slate-500">Estaba asignada a ${escT(t.operario_original)}</p>` : ''}
                    <p class="mt-1 text-sm">${direccionLinkHtml(t, true) || '<span class="text-slate-500">Sin dirección</span>'}</p>
                    ${contactosHtmlT(t)}
                    ${listaSub(t).length ? (t.notas ? `<p class="mt-2 text-slate-700 dark:text-slate-300 line-clamp-2">${escT(t.notas)}</p>` : '') : `<p class="mt-2 text-slate-700 dark:text-slate-300 line-clamp-2">${escT(t.notas || 'Sin notas...')}</p>`}
                </div>
                ${subtareasHtml(t)}
            `;
            c.appendChild(div);
        });
    }

    window.toggleTareaCompletada = async function(id, status) {
        const t = allTareas.find(x => x.id === id);
        const cambios = { completada: status };
        // Con lista: «hecha» marca todos los trabajos; «pendiente» desmarca los que se marcaron hoy.
        const l = listaSub(t);
        if (l.length) {
            const hoy = getTodayLocalString();
            const yo = window.currentUserProfile ? nombreOperario(window.currentUserProfile) : '';
            cambios.subtareas = l.map((x) => status
                ? (x.hecha ? x : { ...x, hecha: true, hecha_el: hoy, hecha_por: yo })
                : (x.hecha && x.hecha_el === hoy ? { id: x.id, texto: x.texto, hecha: false } : x));
        }
        const { error } = await supabaseClient.from('tareas').update(cambios).eq('id', id);
        if (error) { alert('No se pudo actualizar la tarea: ' + error.message); return; }
        if (t) Object.assign(t, cambios);
        if (t && currentTareaItem === t && viewDetalleTarea && !viewDetalleTarea.classList.contains('hidden')) window.verDetalleTarea(id);
        if (status) tareasHechasHoy.add(id); else tareasHechasHoy.delete(id);
        renderTareas();
        window.dispatchEvent(new CustomEvent('bomiTareasCambiadas'));
    };

    // Marcar o desmarcar un trabajo de la lista (requiere conexión, como editar). Si quedan todos hechos, la tarea queda hecha.
    const subGuardando = new Set();
    window.toggleSubtarea = async function(id, subId) {
        const t = allTareas.find((x) => x.id === id);
        if (!t || subGuardando.has(id)) return;
        const hoy = getTodayLocalString();
        const yo = window.currentUserProfile ? nombreOperario(window.currentUserProfile) : '';
        const nueva = listaSub(t).map((x) => x.id !== subId ? x : (x.hecha ? { id: x.id, texto: x.texto, hecha: false } : { ...x, hecha: true, hecha_el: hoy, hecha_por: yo }));
        const cambios = { subtareas: nueva };
        const todas = nueva.length > 0 && nueva.every((x) => x.hecha);
        if (todas !== !!t.completada) cambios.completada = todas;
        subGuardando.add(id);
        try {
            const { error } = await supabaseClient.from('tareas').update(cambios).eq('id', id);
            if (error) throw error;
        } catch (ex) {
            const sinRed = window.BomiOffline && window.BomiOffline.esRed ? window.BomiOffline.esRed(ex) : !navigator.onLine;
            alert(sinRed ? 'Sin conexión: para marcar trabajos hace falta conexión. Vuelve a intentarlo cuando tengas señal.' : 'No se pudo marcar el trabajo: ' + (ex.message || ex));
            return;
        } finally { subGuardando.delete(id); }
        Object.assign(t, cambios);
        if (cambios.completada === true) tareasHechasHoy.add(id);
        renderTareas();
        if (currentTareaItem === t && viewDetalleTarea && !viewDetalleTarea.classList.contains('hidden')) window.verDetalleTarea(id);
        window.dispatchEvent(new CustomEvent('bomiTareasCambiadas'));
    };

    window.verDetalleTarea = function(id) {
        const item = allTareas.find(t => t.id === id);
        if (!item) return;
        currentTareaItem = item;
        hideAllViews();
        viewDetalleTarea.classList.remove('hidden');
        viewDetalleTarea.classList.add('flex');

        const puede = puedeGestionarTarea(item);
        const bEd = document.getElementById('btn-editar-tarea'), bEl = document.getElementById('btn-eliminar-tarea');
        bEd.classList.toggle('hidden', !puede); bEd.classList.toggle('flex', puede);
        bEl.classList.toggle('hidden', !puede); bEl.classList.toggle('inline-flex', puede);
        const sello = document.getElementById('sello-completada');
        if(item.completada) sello.classList.remove('hidden'); else sello.classList.add('hidden');
        const contactos = contactosHtmlT(item);

        document.getElementById('detalle-tarea-content').innerHTML = `
            <div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">${escT(item.cliente || '')} - ${escT(item.obra || '')}</p></div>
            <div><span class="text-xs text-slate-500">Ubicación y Fecha:</span><div class="flex items-center justify-between mt-1 gap-2"><p class="font-medium">${direccionLinkHtml(item, false) || '<span class="text-slate-500">Sin dirección</span>'} (${escT(item.fecha || '')})</p><a href="${escT(mapsHrefT(item.direccion, item.localidad))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Maps" class="text-blue-600 bg-blue-50 dark:bg-blue-950 p-1.5 rounded-full flex items-center shrink-0"><span class="material-symbols-outlined text-[18px]">map</span></a></div></div>
            ${contactos ? `<div><span class="text-xs text-slate-500">Contacto:</span>${contactos}</div>` : ''}
            <div><span class="text-xs text-slate-500">Asignada a:</span><p class="font-medium">${escT(item.operario_asignado || 'Sin asignar')}</p>${!item.operario_asignado && item.operario_original ? `<p class="text-xs text-slate-500">Estaba asignada a ${escT(item.operario_original)}</p>` : ''}</div>
            ${listaSub(item).length ? `<div><span class="text-xs text-slate-500 flex items-center justify-between gap-2">Trabajos: <span>${listaSub(item).filter((x) => x.hecha).length} de ${listaSub(item).length} hechos</span></span>${estadoTarea(item) === 'falta' ? `<div class="mt-1">${etiquetaFaltaHtml(item)}</div>` : ''}<div class="mt-1">${subtareasHtml(item)}</div></div>` : ''}
            ${subAntes(item).length ? `<div><span class="text-xs text-slate-500">Hecho en días anteriores:</span><ul class="mt-1 flex flex-col gap-0.5">${subAntes(item).map((x) => `<li class="flex items-start gap-2 text-sm text-slate-500"><span class="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check</span><span class="break-words">${escT(x.texto)}${x.hecha_el ? ` <span class="text-xs">(${escT(fechaES(x.hecha_el))}${x.hecha_por ? ', ' + escT(x.hecha_por) : ''})</span>` : ''}</span></li>`).join('')}</ul></div>` : ''}
            <div><span class="text-xs text-slate-500">Notas:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1 whitespace-pre-wrap break-words">${escT(item.notas || 'N/A')}</p></div>
            ${item.dibujo_url ? `<div><span class="text-xs text-slate-500 flex items-center justify-between gap-2">Dibujo: <span class="flex items-center gap-0.5"><span class="material-symbols-outlined text-[14px]">zoom_in</span>Toca para ampliar</span></span>${window.BomiPizarraNube ? window.BomiPizarraNube.img(item.dibujo_url, 'mt-2 rounded-xl max-h-48 bg-white border border-slate-200', 'Dibujo', true) : `<img src="${escT(item.dibujo_url)}" data-ampliar="1" class="mt-2 rounded-xl max-h-48 bg-white border border-slate-200 cursor-zoom-in">`}</div>` : ''}
            <div class="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-zinc-800 mt-4">
                <span>Creado por: ${escT(item.created_by || '?')} ${item.updated_by ? '<br>Editado por: ' + escT(item.updated_by) : ''}</span>
            </div>
        `;
        if (window.BomiPizarraNube) window.BomiPizarraNube.rellenar(document.getElementById('detalle-tarea-content'));
    };

    // PDF de la tarea: BomiPdf lo dibuja directamente (con logotipo y datos de la empresa arriba), sin capturar la pantalla.
    function itemsPdfTarea(t) {
        const contactos = contactosDeTarea(t).map(k => [k.nombre, k.telefono].filter(Boolean).join(' · ')).join('\n');
        const it = [
            { t: 'title', text: 'Orden de trabajo / Tarea', badge: t.completada ? 'COMPLETADA' : '', sub: 'Fecha: ' + (t.fecha || '') },
            { t: 'kv', label: 'Cliente', value: t.cliente },
            { t: 'kv', label: 'Obra', value: t.obra },
            { t: 'kv', label: 'Dirección', value: t.direccion },
            { t: 'kv', label: 'Localidad', value: t.localidad },
        ];
        if (contactos) it.push({ t: 'kv', label: 'Contacto', value: contactos });
        it.push({ t: 'kv', label: 'Asignada a', value: t.operario_asignado || 'Sin asignar' });
        const l = listaSub(t);
        if (l.length) {
            it.push({ t: 'h', text: 'Trabajos' });
            it.push({ t: 'p', text: l.map((x) => (x.hecha ? '[X] ' : '[  ] ') + x.texto).join('\n') });
        }
        if (subAntes(t).length) {
            it.push({ t: 'h', text: 'Hecho en días anteriores' });
            it.push({ t: 'p', text: subAntes(t).map((x) => '[X] ' + x.texto + (x.hecha_el ? ' (' + fechaES(x.hecha_el) + ')' : '')).join('\n') });
        }
        it.push({ t: 'h', text: 'Notas' });
        it.push({ t: 'p', text: t.notas || 'N/A' });
        if (t.dibujo_url) { it.push({ t: 'h', text: 'Dibujo' }); it.push({ t: 'img', src: t.dibujo_url, maxW: 420, maxH: 260 }); }
        it.push({ t: 'note', text: 'Creado por ' + (t.created_by || '?') + (t.updated_by ? '\nEditado por ' + t.updated_by : '') });
        return it;
    }

    document.getElementById('btn-compartir-tarea').addEventListener('click', () => {
        const t = currentTareaItem;
        if (!t || !window.BomiCompartir) return;
        window.BomiCompartir.abrir({
            titulo: 'Tarea del ' + fechaES(t.fecha) + ' · ' + (t.cliente || '') + (t.obra ? ' · ' + t.obra : ''),
            nombre: window.BomiPdf.nombreSeguro(['Tarea', t.cliente, t.obra || 'trabajo'], 80),
            items: itemsPdfTarea(t),
        });
    });

    // El botón «PDF» se quitó: el PDF se saca desde «Compartir» (compartir o descargar).
    // ---------- Historial de una obra (se abre desde Clientes) ----------
    async function asegurarTarea(id) {
        const { data, error } = await supabaseClient.from('tareas').select('*').eq('id', id).limit(1);
        if (error || !data || !data.length) { alert('No se encontró la tarea. Puede que se haya eliminado.'); return null; }
        const i = allTareas.findIndex(t => t.id === id);
        if (i >= 0) allTareas[i] = data[0]; else allTareas.push(data[0]);
        return data[0];
    }
    const patronObraT = (t) => '%' + String(t ?? '').trim().replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    window.BomiDiario = {
        // Datos para «Mi día»: mis tareas de hoy (con las pendientes de días anteriores) y cuántas tengo mañana.
        miDia() {
            const hoy = getTodayLocalString();
            const r = tareasDelDia(hoy, '', true);
            const tareas = r.filtradas.map((t) => {
                const desde = String(t.pendiente_desde || r.fechaOrden(t)).slice(0, 10);
                const arrastrada = !t.completada && (r.esArrastrada(t) || (!!t.pendiente_desde && desde < r.fechaOrden(t)));
                return { t, arrastrada, desde, falta: estadoTarea(t) === 'falta', subtareasHtml: subtareasHtml(t), etiquetaFalta: estadoTarea(t) === 'falta' ? etiquetaFaltaHtml(t) : '', contactos: contactosDeTarea(t), mapa: (t.direccion || t.localidad) ? mapsHrefT(t.direccion, t.localidad) : '', tel: telHrefT };
            });
            const manana = sumarDias(hoy, 1);
            return { hoy, cargadas: tareasCargadas, tareas, manana: allTareas.filter((t) => esMiaTarea(t) && (t.fecha || '').slice(0, 10) === manana).length };
        },
        ver(id, volver) { window.verDetalleTarea(id); volverA = volver || null; },
        crearParte(id) {
            const t = allTareas.find((x) => x.id === id);
            if (!t || !window.BomiPartes) return;
            navPartes.click();
            window.BomiPartes.nuevoConDatos({ ...datosDeTarea(t), detalle: detalleParteDeTarea(t) });
        },
        irAlDia(iso) { navHome.click(); if (filtroFechaDiario) { filtroFechaDiario.value = iso; renderTareas(); } },
        manana() { return sumarDias(getTodayLocalString(), 1); },
        // Tarea nueva con cliente, obra, dirección y localidad ya rellenos. Con datos.foto (URL local de una foto
        // de obra) se abre además la pizarra con esa foto de fondo para encuadrarla y dibujar encima.
        async nuevoConDatos(datos) {
            const d = datos || {};
            navHome.click();
            fabNewTask.click();
            document.getElementById('tarea-cliente').value = d.cliente || '';
            document.getElementById('tarea-obra').value = d.obra || '';
            document.getElementById('tarea-direccion').value = d.direccion || '';
            document.getElementById('tarea-localidad').value = d.localidad || '';
            document.getElementById('tarea-notas').value = d.notas || '';
            sincronizarTarea('inicio');
            if (d.foto) await abrirPizarraTarea(d.foto);
        },
        historial: {
            async buscar(o) {
                const { data, error } = await supabaseClient.from('tareas').select('*').ilike('obra', patronObraT(o.obra)).limit(500);
                if (error) throw error;
                return (data || []).filter(t => normT(t.obra) === normT(o.obra) && normT(t.cliente) === normT(o.cliente)).map(t => ({
                    id: t.id,
                    fecha: fechaES(t.fecha),
                    orden: (t.fecha || '') + '|' + (t.created_at || ''),
                    titulo: t.operario_asignado || 'Sin asignar',
                    detalle: t.notas || '',
                    etiquetas: [t.completada ? { texto: 'Hecha', tono: 'verde', icono: 'check' } : estadoTarea(t) === 'falta' ? { texto: 'Falta por completar', tono: 'violeta' } : { texto: 'Pendiente', tono: 'ambar' }],
                    puedeEditar: puedeGestionarTarea(t),
                    puedeEliminar: puedeGestionarTarea(t),
                }));
            },
            // volver: qué hacer al salir de la tarea (por defecto, ir al Diario).
            async ver(id, volver) { if (!(await asegurarTarea(id))) return; window.verDetalleTarea(id); volverA = volver || null; },
            async editar(id, volver) {
                const t = await asegurarTarea(id);
                if (!t || !puedeGestionarTarea(t)) return;
                window.editarTarea(id);
                volverA = volver || null;
            },
            async eliminar(id) { const t = await asegurarTarea(id); if (t) await eliminarTarea(t); },
        },
    };

    window.editarTarea = function(id) {
        const item = allTareas.find(t => t.id === id);
        if (!item) return;
        document.getElementById('form-tarea-title').textContent = "Modificar Tarea";
        document.getElementById('edit-tarea-id').value = item.id;
        document.getElementById('tarea-cliente').value = item.cliente || '';
        document.getElementById('tarea-obra').value = item.obra || '';
        document.getElementById('tarea-direccion').value = item.direccion || '';
        document.getElementById('tarea-localidad').value = item.localidad || '';
        poblarSelectOperarios(item.operario_asignado || '');
        document.getElementById('tarea-fecha').value = item.fecha ? item.fecha.split('T')[0] : getTodayLocalString();
        document.getElementById('tarea-notas').value = item.notas || '';
        setDibujo(item.dibujo_url || '');
        limpiarMapsTarea();
        setSubEditor(item);
        tareaObraAutorrellena = false;
        sincronizarTarea('inicio');
        viewFormTarea.classList.remove('hidden');
        viewFormTarea.classList.add('flex');
    };
})();
