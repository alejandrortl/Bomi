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
    async function notificarAsignacion(operario, tarea, quien) {
        // Respeta la preferencia del empleado. Si no se puede leer (p. ej. columna aún inexistente), se avisa.
        const { data: pref, error: errPref } = await supabaseClient.from('perfiles').select('preferencias_notificaciones').eq('id', operario.id).single();
        if (!errPref && pref && pref.preferencias_notificaciones && pref.preferencias_notificaciones.tareas === false) return true;
        const { error } = await supabaseClient.from('notificaciones').insert([{
            user_id: operario.id,
            titulo: 'Nueva tarea asignada',
            mensaje: `${quien} te ha asignado una tarea para el ${fechaES(tarea.fecha)}: ${tarea.cliente} · ${tarea.obra}.`
        }]);
        return !error;
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
    function setDibujo(url) {
        document.getElementById('tarea-dibujo-url').value = url || '';
        const prev = document.getElementById('preview-dibujo');
        if (url) document.getElementById('img-dibujo-preview').src = url;
        if (prev) prev.style.display = url ? 'inline-block' : 'none';
    }

    const btnAbrirPizarra = document.getElementById('btn-abrir-pizarra');
    if (btnAbrirPizarra) {
        btnAbrirPizarra.addEventListener('click', async () => {
            if (!window.BomiPizarra) { alert('La pizarra no está disponible.'); return; }
            const actualUrl = document.getElementById('tarea-dibujo-url').value;
            const res = await window.BomiPizarra.abrir({ imagen: actualUrl });
            if (!res) return;
            if (res.vacia) { setDibujo(''); return; }
            const fileName = `diario_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            const { error } = await supabaseClient.storage.from('pizarras').upload(fileName, res.blob, { contentType: 'image/png' });
            if (error) { alert('No se pudo guardar el dibujo: ' + error.message); return; }
            setDibujo(supabaseClient.storage.from('pizarras').getPublicUrl(fileName).data.publicUrl);
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

    document.getElementById('btn-cancel-tarea').addEventListener('click', () => navHome.click());
    document.getElementById('btn-back-tarea-list').addEventListener('click', () => navHome.click());

    document.getElementById('form-tarea').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cName = document.getElementById('tarea-cliente').value.trim();
        const oName = document.getElementById('tarea-obra').value.trim();
        const dName = document.getElementById('tarea-direccion').value.trim();
        const lName = document.getElementById('tarea-localidad').value.trim();
        const editId = document.getElementById('edit-tarea-id').value;

        let creados = false;
        try {
            const cliEncontrado = clienteDeTarea();
            let clienteId;
            if (!cliEncontrado) {
                const { data, error } = await supabaseClient.from('clientes').insert([{ nombre_cliente: cName, nombre: cName }]).select('id');
                if (error || !data || !data.length) throw error || new Error('No se pudo crear el cliente.');
                clienteId = data[0].id;
                creados = true;
            } else { clienteId = cliEncontrado.id; }

            const obraEncontrada = cliEncontrado && cliEncontrado.obras.find(o => normT(o.nombre) === normT(oName));
            if (!obraEncontrada) {
                const { error } = await supabaseClient.from('obras').insert([{ cliente_id: clienteId, nombre: oName, direccion: dName, localidad: lName }]);
                if (error) throw error;
                creados = true;
            }
        } catch (ex) {
            alert('No se pudo crear el cliente u obra: ' + ((ex && ex.message) || 'error desconocido'));
            return;
        }
        // Clientes/obras nuevos: refresca autocompletados y las demás pantallas.
        if (creados) window.dispatchEvent(new CustomEvent('clientesActualizados'));

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
        const tareaData = {
            cliente: cName, obra: oName, direccion: dName, localidad: lName,
            operario_asignado: operarioNombre,
            operario_username: operario ? operario.username : itemOriginal.operario_username,
            fecha: document.getElementById('tarea-fecha').value,
            notas,
            dibujo_url: document.getElementById('tarea-dibujo-url').value
        };

        if (editId) {
            tareaData.updated_by = username;
            const { error } = await supabaseClient.from('tareas').update(tareaData).eq('id', editId);
            if (error) { alert('No se pudo guardar la tarea: ' + error.message); return; }
        } else {
            // La tabla exige un título de la tarea y el usuario que la crea (la política de acceso lo comprueba).
            tareaData.tarea = (notas.split('\n')[0] || '').slice(0, 120) || `${oName}`;
            tareaData.user_id = window.currentUserProfile ? window.currentUserProfile.id : null;
            tareaData.created_by = username;
            tareaData.completada = false;
            const { error } = await supabaseClient.from('tareas').insert([tareaData]);
            if (error) { alert('No se pudo guardar la tarea: ' + error.message); return; }
        }

        // Aviso al empleado asignado: al crear la tarea, o al cambiar de empleado al editarla.
        const cambioOperario = !itemOriginal || itemOriginal.operario_asignado !== operarioNombre;
        if (cambioOperario && operario && (!window.currentUserProfile || operario.id !== window.currentUserProfile.id)) {
            const enviado = await notificarAsignacion(operario, tareaData, username);
            if (!enviado) alert('La tarea se guardó, pero no se pudo avisar a ' + operarioNombre + '.');
        }

        await loadTasksFromDB();
        navHome.click();
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

    function renderTareas() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const fechaSelect = filtroFechaDiario.value;
        const searchTxt = searchTareasInput.value.toLowerCase().trim();

        let filtradas = allTareas.filter(t => {
            const tFecha = t.fecha ? t.fecha.split('T')[0] : '';
            if (searchTxt === '') {
                if (tFecha !== fechaSelect) return false;
            } else {
                const fullText = `${t.cliente || ''} ${t.obra || ''} ${t.direccion || ''} ${t.localidad || ''} ${t.operario_asignado || ''} ${t.fecha || ''} ${t.notas || ''} ${t.created_by || ''}`.toLowerCase();
                if (!fullText.includes(searchTxt)) return false;
            }
            return true;
        });

        filtradas.sort((a, b) => (a.completada === b.completada ? 0 : a.completada ? 1 : -1));
        c.innerHTML = '';

        if (filtradas.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">No se encontraron tareas con estos criterios.</p>';
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
                    <button onclick="window.toggleTareaCompletada('${escT(t.id)}', ${!isComp})" aria-label="${isComp ? 'Marcar como pendiente' : 'Marcar como completada'}" class="w-8 h-8 rounded-full flex items-center justify-center border-2 ${isComp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent hover:border-blue-500'}"><span class="material-symbols-outlined text-[18px]">check</span></button>
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
        await supabaseClient.from('tareas').update({ completada: status }).eq('id', id);
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

        const sello = document.getElementById('sello-completada');
        if(item.completada) sello.classList.remove('hidden'); else sello.classList.add('hidden');
        const contactos = contactosHtmlT(item);

        document.getElementById('detalle-tarea-content').innerHTML = `
            <div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">${escT(item.cliente || '')} - ${escT(item.obra || '')}</p></div>
            <div><span class="text-xs text-slate-500">Ubicación y Fecha:</span><div class="flex items-center justify-between mt-1 gap-2"><p class="font-medium">${direccionLinkHtml(item, false) || '<span class="text-slate-500">Sin dirección</span>'} (${escT(item.fecha || '')})</p><a href="${escT(mapsHrefT(item.direccion, item.localidad))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Maps" class="text-blue-600 bg-blue-50 dark:bg-blue-950 p-1.5 rounded-full flex items-center shrink-0"><span class="material-symbols-outlined text-[18px]">map</span></a></div></div>
            ${contactos ? `<div><span class="text-xs text-slate-500">Contacto:</span>${contactos}</div>` : ''}
            <div><span class="text-xs text-slate-500">Asignada a:</span><p class="font-medium">${escT(item.operario_asignado || '')}</p></div>
            <div><span class="text-xs text-slate-500">Notas:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1 whitespace-pre-wrap break-words">${escT(item.notas || 'N/A')}</p></div>
            ${item.dibujo_url ? `<div><span class="text-xs text-slate-500">Dibujo:</span><img src="${escT(item.dibujo_url)}" class="mt-2 rounded-xl max-h-48 border border-slate-200"></div>` : ''}
            <div class="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between mt-4">
                <span>Creado por: ${escT(item.created_by || '?')} ${item.updated_by ? '<br>Editado por: ' + escT(item.updated_by) : ''}</span>
                <button onclick="window.editarTarea('${escT(item.id)}')" class="bg-slate-100 dark:bg-zinc-800 px-4 py-2 rounded-xl font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">edit</span> Modificar</button>
            </div>
        `;
    };

    document.getElementById('btn-export-pdf-tarea').addEventListener('click', () => {
        const element = document.getElementById('pdf-export-container-tarea');
        const opt = { margin: 10, filename: `Tarea_${currentTareaItem.obra || 'trabajo'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } };
        html2pdf().from(element).set(opt).save();
    });

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
