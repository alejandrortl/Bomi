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
    
    if(filtroFechaDiario && !filtroFechaDiario.value) {
        filtroFechaDiario.value = getTodayLocalString();
    }

    function hideAllViews() {
        [viewTaskList, viewFormTarea, viewDetalleTarea, viewPartes, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
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
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); loadEmpleados(); });

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

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';
        if (navEmpleados) {
            if (isAdmin) { navEmpleados.classList.remove('hidden'); navEmpleados.classList.add('flex'); }
            else { navEmpleados.classList.add('hidden'); navEmpleados.classList.remove('flex'); }
        }
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    if (window.currentUserProfile) initAppAfterLogin();

    async function loadClientes() {
        const { data: clientesData } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        allClientesCompletos = [];
        const dlClientes = document.getElementById('clientes-datalist');
        const dlObras = document.getElementById('obras-datalist');
        if(dlClientes) dlClientes.innerHTML = '';
        if(dlObras) dlObras.innerHTML = '';

        for (const cli of (clientesData || [])) {
            const { data: obrasCli } = await supabaseClient.from('obras').select('*').eq('cliente_id', cli.id);
            allClientesCompletos.push({ ...cli, obras: obrasCli || [] });
            if(dlClientes) dlClientes.insertAdjacentHTML('beforeend', `<option value="${cli.nombre_cliente}"></option>`);
            (obrasCli || []).forEach(o => {
                if(dlObras) dlObras.insertAdjacentHTML('beforeend', `<option value="${o.nombre}"></option>`);
            });
        }
    }

    async function loadOperariosList() {
        const { data } = await supabaseClient.from('perfiles').select('nombre, apellido, username');
        allOperarios = data || [];
        const dl = document.getElementById('operarios-datalist');
        if (dl) {
            dl.innerHTML = '';
            allOperarios.forEach(op => {
                dl.insertAdjacentHTML('beforeend', `<option value="${(op.nombre || '') + ' ' + (op.apellido || '')}"></option>`);
            });
        }
    }

    // TAREAS: AUTOCOMPLETAR OBRA
    const inputTareaObra = document.getElementById('tarea-obra');
    if (inputTareaObra) {
        inputTareaObra.addEventListener('change', () => {
            const obraVal = inputTareaObra.value.trim().toLowerCase();
            for (const cli of allClientesCompletos) {
                const obraEncontrada = cli.obras.find(o => o.nombre.toLowerCase() === obraVal);
                if (obraEncontrada) {
                    document.getElementById('tarea-direccion').value = obraEncontrada.direccion || '';
                    document.getElementById('tarea-localidad').value = obraEncontrada.localidad || '';
                    document.getElementById('tarea-cliente').value = cli.nombre_cliente;
                    break;
                }
            }
        });
    }

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

    // PIZARRA BUCKET
    const btnAbrirPizarra = document.getElementById('btn-abrir-pizarra');
    const modalPizarra = document.getElementById('modal-pizarra');
    const canvasPizarra = document.getElementById('canvas-pizarra');
    const ctxPiz = canvasPizarra ? canvasPizarra.getContext('2d') : null;
    let pizarraDrawing = false;

    if (btnAbrirPizarra && modalPizarra && canvasPizarra) {
        btnAbrirPizarra.addEventListener('click', () => {
            modalPizarra.classList.remove('hidden');
            const rect = canvasPizarra.parentElement.getBoundingClientRect();
            canvasPizarra.width = rect.width;
            canvasPizarra.height = rect.height;
            ctxPiz.fillStyle = '#ffffff';
            ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height);
            ctxPiz.lineWidth = 3; ctxPiz.lineCap = 'round'; ctxPiz.strokeStyle = '#000000';
        });

        document.querySelectorAll('.btn-color-pizarra').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-color-pizarra').forEach(b => b.classList.remove('ring-2', 'ring-blue-500', 'scale-110'));
                ctxPiz.strokeStyle = e.target.dataset.color;
                e.target.classList.add('ring-2', 'ring-blue-500', 'scale-110');
            });
        });

        document.getElementById('btn-limpiar-pizarra').addEventListener('click', () => ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height));
        document.getElementById('btn-cerrar-pizarra').addEventListener('click', () => modalPizarra.classList.add('hidden'));

        const getPizPos = (e) => {
            const rect = canvasPizarra.getBoundingClientRect();
            return { x: (e.clientX || e.touches[0].clientX) - rect.left, y: (e.clientY ||
