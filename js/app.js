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
    const selectTema = document.getElementById('select-tema');

    let allTareas = [];
    let allClientesCompletos = [];
    let allOperarios = [];
    let currentTareaItem = null;
    
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const searchTareasInput = document.getElementById('search-tareas');

    // TEMA
    function aplicarTema(tema) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (tema === 'oscuro' || (tema === 'auto' && prefersDark)) root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', tema);
    }

    if (selectTema) {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        selectTema.value = savedTheme;
        aplicarTema(savedTheme);
        selectTema.addEventListener('change', (e) => aplicarTema(e.target.value));
        // Cerrado: solo el icono (compacto). Abierto: icono + texto.
        const textoTema = (largo) => Array.from(selectTema.options).forEach((o) => { o.textContent = largo ? o.dataset.largo : o.dataset.corto; });
        ['mousedown', 'focus', 'touchstart'].forEach((ev) => selectTema.addEventListener(ev, () => textoTema(true)));
        ['change', 'blur'].forEach((ev) => selectTema.addEventListener(ev, () => setTimeout(() => textoTema(false), 0)));
    }

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }
    if(filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();

    function hideAllViews() {
        [viewTaskList, viewFormTarea, viewDetalleTarea, viewPartes, viewBitacora, viewMateriales, document.getElementById('view-mensajes'), viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
            if (v) { v.classList.add('hidden'); v.classList.remove('flex'); }
        });
        [navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
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

        if (navEmpleados) { navEmpleados.classList.remove('hidden'); navEmpleados.classList.add('flex'); }
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
        sel.innerHTML = '<option value="">Selecciona un empleado</option>' +
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

    // WEB SPEECH API
    const btnDictarVoz = document.getElementById('btn-dictar-voz');
    const tareaNotas = document.getElementById('tarea-notas');
    if (btnDictarVoz) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            btnDictarVoz.addEventListener('click', (e) => {
                e.preventDefault();
                btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-pulse">mic</span> Escuchando...';
                recognition.start();
            });
            recognition.onresult = (event) => {
                tareaNotas.value = (tareaNotas.value + ' ' + event.results[0][0].transcript).trim();
                resetMic();
            };
            recognition.onerror = resetMic;
            recognition.onend = resetMic;
            function resetMic() { btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px]">mic</span> Dictar'; }
        } else { btnDictarVoz.style.display = 'none'; }
    }

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
    if (btnAbrirPizarra) {
        btnAbrirPizarra.addEventListener('click', async () => {
            if (!window.BomiPizarra || !nubeT()) { alert('La pizarra no está disponible.'); return; }
            if (abriendoDibujo) return;
            const actualUrl = document.getElementById('tarea-dibujo-url').value;
            let previo = { claveFondo: null, fondoCambiado: false };
            let abrir = {};
            abriendoDibujo = true;
            try {
                if (dibujoPend) {
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
        });
        document.getElementById('btn-borrar-dibujo').addEventListener('click', () => setDibujo(''));
    }

    if (fabNewTask) {
        fabNewTask.addEventListener('click', () => {
            document.getElementById('form-tarea-title').textContent = "Nueva Tarea";
            document.getElementById('form-tarea').reset();
            document.getElementById('edit-tarea-id').value = "";
            document.getElementById('tarea-fecha').value = getTodayLocalString();
            // Por defecto, quien crea la tarea (si es un empleado activo de la lista); se puede cambiar.
            const yoNombre = window.currentUserProfile ? nombreOperario(window.currentUserProfile) : '';
            poblarSelectOperarios(allOperarios.some(op => nombreOperario(op) === yoNombre) ? yoNombre : '');
            setDibujo('');
            sincronizarTarea('inicio');
            hideAllViews();
            viewFormTarea.classList.remove('hidden');
            viewFormTarea.classList.add('flex');
        });
    }

    // Al abrir una tarea desde otra pantalla (p. ej. el historial de una obra en Clientes), al terminar se vuelve allí.
    let volverA = null;
    function salirTarea() {
        const f = volverA;
        volverA = null;
        if (f) f(); else navHome.click();
    }
    [navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => { if (nav) nav.addEventListener('click', () => { volverA = null; }, true); });
    document.getElementById('btn-cancel-tarea').addEventListener('click', salirTarea);
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
        window.BomiPartes.nuevoConDatos({ ...datosDeTarea(t), detalle: t.notas || '' });
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
        if (!confirm('¿Eliminar esta tarea?\n\n' + (t.cliente || '') + (t.obra ? ' - ' + t.obra : '') + '\nNo se puede deshacer.')) return false;
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
        if (!operarioNombre || (!operario && !mantieneOperario)) {
            alert('Selecciona un empleado de la lista como operario asignado.');
            return;
        }
        const notas = document.getElementById('tarea-notas').value.trim();
        const dibujoUrl = document.getElementById('tarea-dibujo-url').value;
        const tareaData = {
            cliente: cName, obra: oName, direccion: dName, localidad: lName,
            operario_asignado: operarioNombre,
            operario_username: operario ? operario.username : itemOriginal.operario_username,
            fecha: document.getElementById('tarea-fecha').value,
            notas,
            dibujo_url: dibujoUrl
        };
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
            if (confirm(msg)) {
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
        const { data, error } = await supabaseClient.from('tareas').select('*');
        if (error) {
            c.innerHTML = `<p class="text-red-500 text-center mt-4">Error al cargar tareas: ${error.message}</p>`;
            return;
        }
        allTareas = data || [];
        renderTareas();
        window.dispatchEvent(new CustomEvent('bomiRegistrosCambiados', { detail: { tipo: 'diario' } }));
    }

    if(searchTareasInput) searchTareasInput.addEventListener('input', renderTareas);
    if(filtroFechaDiario) filtroFechaDiario.addEventListener('change', renderTareas);

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
        return normT(t.operario_asignado) !== '' && normT(t.operario_asignado) === normT(nombreOperario(p));
    };
    document.querySelectorAll('#view-task-list [data-filtro-diario]').forEach((b) => b.addEventListener('click', () => {
        const mias = b.dataset.filtroDiario === 'mias';
        if (mias === leerSoloMias()) return;
        guardarSoloMias(mias);
        pintarInterruptorDiario();
        renderTareas();
    }));

    function renderTareas() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const fechaSelect = filtroFechaDiario.value;
        const searchTxt = searchTareasInput.value.toLowerCase().trim();

        const soloMias = leerSoloMias();
        pintarInterruptorDiario();
        let filtradas = allTareas.filter(t => {
            if (soloMias && !esMiaTarea(t)) return false;
            const tFecha = t.fecha ? t.fecha.split('T')[0] : '';
            if (searchTxt === '') {
                if (tFecha !== fechaSelect) return false;
            } else {
                const fullText = `${t.cliente || ''} ${t.obra || ''} ${t.direccion || ''} ${t.localidad || ''} ${t.operario_asignado || ''} ${t.fecha || ''} ${t.notas || ''} ${t.created_by || ''}`.toLowerCase();
                if (!fullText.includes(searchTxt)) return false;
            }
            return true;
        });

        // Las tareas realizadas van al final (completada puede venir null/false/true: se compara como booleano)
        filtradas.sort((a, b) => Number(!!a.completada) - Number(!!b.completada));
        c.innerHTML = '';

        if (filtradas.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">' + (soloMias ? 'No tienes tareas asignadas con estos criterios.' : 'No se encontraron tareas con estos criterios.') + '</p>';
            return;
        }

        filtradas.forEach(t => {
            const isComp = t.completada;
            const cardBg = isComp ? 'bg-slate-100 dark:bg-zinc-800 opacity-75' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';
            const div = document.createElement('div');
            div.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2`;
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">${escT(t.cliente || 'Sin cliente')} - ${escT(t.obra || 'Sin obra')}</span>
                    <div class="flex items-center gap-2 shrink-0 ml-2">
                    <button type="button" onclick="window.verDetalleTarea('${escT(t.id)}')" aria-label="Ver tarea" title="Ver tarea" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"><span class="material-symbols-outlined text-[20px]">visibility</span></button>
                    <button onclick="window.toggleTareaCompletada('${escT(t.id)}', ${!isComp})" aria-label="${isComp ? 'Marcar como pendiente' : 'Marcar como completada'}" class="w-8 h-8 rounded-full flex items-center justify-center border-2 ${isComp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent hover:border-blue-500'}"><span class="material-symbols-outlined text-[18px]">check</span></button>
                    </div>
                </div>
                <div class="text-sm cursor-pointer" onclick="window.verDetalleTarea('${escT(t.id)}')">
                    <p>📅 <strong>Fecha:</strong> ${escT(t.fecha || 'N/D')} | 👷 <strong>Operario:</strong> ${escT(t.operario_asignado || 'Sin asignar')}</p>
                    <p class="mt-1 text-sm">${direccionLinkHtml(t, true) || '<span class="text-slate-500">Sin dirección</span>'}</p>
                    ${contactosHtmlT(t)}
                    <p class="mt-2 text-slate-700 dark:text-slate-300 line-clamp-2">${escT(t.notas || 'Sin notas...')}</p>
                </div>
            `;
            c.appendChild(div);
        });
    }

    window.toggleTareaCompletada = async function(id, status) {
        const { error } = await supabaseClient.from('tareas').update({ completada: status }).eq('id', id);
        if (error) { alert('No se pudo actualizar la tarea: ' + error.message); return; }
        const t = allTareas.find(x => x.id === id);
        if(t) t.completada = status;
        renderTareas();
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
            <div><span class="text-xs text-slate-500">Asignada a:</span><p class="font-medium">${escT(item.operario_asignado || '')}</p></div>
            <div><span class="text-xs text-slate-500">Notas:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1 whitespace-pre-wrap break-words">${escT(item.notas || 'N/A')}</p></div>
            ${item.dibujo_url ? `<div><span class="text-xs text-slate-500">Dibujo:</span>${window.BomiPizarraNube ? window.BomiPizarraNube.img(item.dibujo_url, 'mt-2 rounded-xl max-h-48 border border-slate-200', 'Dibujo') : `<img src="${escT(item.dibujo_url)}" class="mt-2 rounded-xl max-h-48 border border-slate-200">`}</div>` : ''}
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
        it.push({ t: 'kv', label: 'Asignada a', value: t.operario_asignado });
        it.push({ t: 'h', text: 'Notas' });
        it.push({ t: 'p', text: t.notas || 'N/A' });
        if (t.dibujo_url) { it.push({ t: 'h', text: 'Dibujo' }); it.push({ t: 'img', src: t.dibujo_url, maxW: 420, maxH: 260 }); }
        it.push({ t: 'note', text: 'Creado por ' + (t.created_by || '?') + (t.updated_by ? '\nEditado por ' + t.updated_by : '') });
        return it;
    }

    document.getElementById('btn-export-pdf-tarea').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const t = currentTareaItem;
        if (!t || btn.disabled) return;
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Creando PDF...';
        try {
            const nombre = window.BomiPdf.nombreSeguro(['Tarea', t.cliente, t.obra || 'trabajo'], 80);
            await window.BomiPdf.generar(itemsPdfTarea(t), nombre);
        } catch (ex) {
            alert('No se pudo crear el PDF: ' + (ex && ex.message ? ex.message : ex));
        } finally {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    });

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
                    etiquetas: [t.completada ? { texto: 'Hecha', tono: 'verde', icono: 'check' } : { texto: 'Pendiente', tono: 'ambar' }],
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
        tareaObraAutorrellena = false;
        sincronizarTarea('inicio');
        hideAllViews();
        viewFormTarea.classList.remove('hidden');
        viewFormTarea.classList.add('flex');
    };
})();
