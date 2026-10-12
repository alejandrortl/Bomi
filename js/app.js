// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewBitacora = document.getElementById('view-bitacora');
    const viewFormBitacora = document.getElementById('view-form-bitacora');
    const viewDetalleBitacora = document.getElementById('view-detalle-bitacora');
    const viewNewTask = document.getElementById('view-new-task');
    const viewClientes = document.getElementById('view-clientes');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    
    const navHome = document.getElementById('nav-home');
    const navBitacora = document.getElementById('nav-bitacora');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewBitacora = document.getElementById('fab-new-bitacora');
    const fabNewCliente = document.getElementById('fab-new-cliente');

    // Menús Header y Tema
    const selectTema = document.getElementById('select-tema');
    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownMenuPerfil = document.getElementById('dropdown-menu-perfil');
    const menuItemPerfil = document.getElementById('menu-item-perfil');
    const menuItemEmpresa = document.getElementById('menu-item-empresa');
    const headerUsernameLabel = document.getElementById('header-username-label');

    // Tareas
    const tasksContainer = document.getElementById('tasks-container');
    const searchInput = document.getElementById('search-tareas');
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const inputFecha = document.getElementById('input-fecha');
    const inputCliente = document.getElementById('input-cliente');
    const inputObra = document.getElementById('input-obra');
    const inputDireccion = document.getElementById('input-direccion');
    const inputLocalidad = document.getElementById('input-localidad');
    const selectOperario = document.getElementById('select-operario');
    const inputTarea = document.getElementById('input-tarea');
    const btnCancelTask = document.getElementById('btn-cancel-task');
    const formNewTask = document.getElementById('form-new-task');

    // Bitácora
    const bitacoraContainer = document.getElementById('bitacora-container');
    const bitacoraCount = document.getElementById('bitacora-count');
    const searchBitacoraInput = document.getElementById('search-bitacora');
    const formBitacora = document.getElementById('form-bitacora');
    const formBitacoraTitle = document.getElementById('form-bitacora-title');
    const editBitacoraId = document.getElementById('edit-bitacora-id');
    const bitCliente = document.getElementById('bit-cliente');
    const bitObra = document.getElementById('bit-obra');
    const bitDireccion = document.getElementById('bit-direccion');
    const bitLocalidad = document.getElementById('bit-localidad');
    const bitNotas = document.getElementById('bit-notas');
    const btnCancelBitacora = document.getElementById('btn-cancel-bitacora');
    const btnBackBitacoraList = document.getElementById('btn-back-bitacora-list');
    const detalleBitacoraContent = document.getElementById('detalle-bitacora-content');
    const btnMicNotas = document.getElementById('btn-mic-notas');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    // Pizarra Colapsable
    const btnTogglePizarra = document.getElementById('btn-toggle-pizarra');
    const pizarraContainer = document.getElementById('pizarra-container');
    const canvas = document.getElementById('pizarra-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    // Clientes y Modales Relacionales
    const clientesContainer = document.getElementById('clientes-container');
    const clientesCount = document.getElementById('clientes-count');
    const searchClientesInput = document.getElementById('search-clientes');
    const modalCliente = document.getElementById('modal-cliente');
    const formCliente = document.getElementById('form-cliente');
    const modalClienteTitle = document.getElementById('modal-cliente-title');
    const editClienteId = document.getElementById('edit-cliente-id');
    const cliNombre = document.getElementById('cli-nombre');
    const contactosClienteContainer = document.getElementById('contactos-cliente-container');
    const btnAddContactoCliente = document.getElementById('btn-add-contacto-cliente');
    const obrasContainer = document.getElementById('obras-container');
    const btnAddObra = document.getElementById('btn-add-obra');
    const btnCloseModalCliente = document.getElementById('btn-close-modal-cliente');
    const btnCancelModalCliente = document.getElementById('btn-cancel-modal-cliente');
    const datalistClientes = document.getElementById('clientes-datalist');
    const datalistObras = document.getElementById('obras-datalist');

    // Perfil y Empresa
    const formPerfil = document.getElementById('form-perfil');
    const perfilNewPass = document.getElementById('perfil-new-pass');
    const perfilConfirmPass = document.getElementById('perfil-confirm-pass');
    const perfilMensaje = document.getElementById('perfil-mensaje');
    const formEmpresa = document.getElementById('form-empresa');

    // Empleados y Modales
    const empleadosContainer = document.getElementById('empleados-container');
    const empleadosCount = document.getElementById('empleados-count');
    const searchEmpleadosInput = document.getElementById('search-empleados');
    const modalDetalle = document.getElementById('modal-detalle-tarea');
    const detalleContenido = document.getElementById('detalle-contenido');
    const btnCloseDetalle = document.getElementById('btn-close-detalle');

    let allTasks = [];
    let allBitacora = [];
    let allClientesCompletos = [];
    let allEmpleados = [];
    let currentBitacoraItem = null;

    // --- GESTIÓN DE TEMA Y MODO OSCURO ---
    function aplicarTema(tema) {
        const isDark = tema === 'oscuro' || (tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', tema);
        redibujarPizarraFondo();
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

    function hideAllViews() {
        if (viewTaskList) viewTaskList.classList.add('hidden');
        if (viewBitacora) { viewBitacora.classList.add('hidden'); viewBitacora.classList.remove('flex'); }
        if (viewFormBitacora) { viewFormBitacora.classList.add('hidden'); viewFormBitacora.classList.remove('flex'); }
        if (viewDetalleBitacora) { viewDetalleBitacora.classList.add('hidden'); viewDetalleBitacora.classList.remove('flex'); }
        if (viewNewTask) { viewNewTask.classList.add('hidden'); viewNewTask.classList.remove('flex'); }
        if (viewClientes) { viewClientes.classList.add('hidden'); viewClientes.classList.remove('flex'); }
        if (viewEmpleados) { viewEmpleados.classList.add('hidden'); viewEmpleados.classList.remove('flex'); }
        if (viewPerfil) { viewPerfil.classList.add('hidden'); viewPerfil.classList.remove('flex'); }
        if (viewEmpresa) { viewEmpresa.classList.add('hidden'); viewEmpresa.classList.remove('flex'); }
        
        if (navHome) navHome.classList.remove('text-primary');
        if (navBitacora) navBitacora.classList.remove('text-primary');
        if (navClientes) navClientes.classList.remove('text-primary');
        if (navEmpleados) navEmpleados.classList.remove('text-primary');
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewBitacora) fabNewBitacora.classList.add('hidden');
        if (fabNewCliente) fabNewCliente.classList.add('hidden');
    }

    // --- NAVEGACIÓN INFERIOR ---
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); navHome.classList.add('text-primary'); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); loadTasks(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); navBitacora.classList.add('text-primary'); fabNewBitacora.classList.remove('hidden'); fabNewBitacora.classList.add('flex'); loadBitacora(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); navClientes.classList.add('text-primary'); fabNewCliente.classList.remove('hidden'); fabNewCliente.classList.add('flex'); loadClientes(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); navEmpleados.classList.add('text-primary'); loadEmpleados(); });

    // --- FABs ---
    if (fabNewTask) fabNewTask.addEventListener('click', () => { hideAllViews(); document.getElementById('form-task-title').textContent = "Asignar Nueva Tarea"; formNewTask.reset(); inputFecha.value = getTodayLocalString(); loadOperariosSelect(); viewNewTask.classList.remove('hidden'); viewNewTask.classList.add('flex'); });
    if (btnCancelTask) btnCancelTask.addEventListener('click', () => navHome.click());

    if (fabNewBitacora) {
        fabNewBitacora.addEventListener('click', () => {
            hideAllViews();
            formBitacoraTitle.textContent = "Nuevo Registro de Bitácora";
            formBitacora.reset();
            editBitacoraId.value = "";
            if (pizarraContainer) pizarraContainer.classList.add('hidden');
            if (btnTogglePizarra) btnTogglePizarra.innerHTML = '<span class="material-symbols-outlined text-[18px]">draw</span> Abrir Pizarra / Croquis';
            limpiarPizarra();
            viewFormBitacora.classList.remove('hidden');
            viewFormBitacora.classList.add('flex');
        });
    }
    if (btnCancelBitacora) btnCancelBitacora.addEventListener('click', () => navBitacora.click());
    if (btnBackBitacoraList) btnBackBitacoraList.addEventListener('click', () => navBitacora.click());

    // --- GESTIÓN MODAL CLIENTE / OBRAS / CONTACTOS ---
    if (fabNewCliente) {
        fabNewCliente.addEventListener('click', () => {
            modalClienteTitle.textContent = "Nuevo Cliente, Obras y Contactos";
            formCliente.reset();
            editClienteId.value = "";
            if (contactosClienteContainer) contactosClienteContainer.innerHTML = '';
            if (obrasContainer) obrasContainer.innerHTML = '';
            agregarFilaContactoCliente();
            agregarFilaObra();
            modalCliente.classList.remove('hidden');
        });
    }
    if (btnCloseModalCliente) btnCloseModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));
    if (btnCancelModalCliente) btnCancelModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));

    if (btnAddContactoCliente) btnAddContactoCliente.addEventListener('click', () => agregarFilaContactoCliente());
    if (btnAddObra) btnAddObra.addEventListener('click', () => agregarFilaObra());

    function agregarFilaContactoCliente(nombre = '', telefono = '') {
        const div = document.createElement('div');
        div.className = "flex gap-2 items-center bg-surface p-2 rounded-xl border border-outline-variant";
        div.innerHTML = `
            <input type="text" placeholder="Nombre contacto" value="${nombre}" class="contacto-cli-nombre flex-1 bg-transparent border-none outline-none text-sm p-1">
            <input type="tel" placeholder="Teléfono" value="${telefono}" class="contacto-cli-tel w-32 bg-transparent border-none outline-none text-sm p-1">
            <button type="button" class="text-error material-symbols-outlined text-sm p-1 hover:bg-error/10 rounded" onclick="this.parentElement.remove()">delete</button>
        `;
        contactosClienteContainer.appendChild(div);
    }

    function agregarFilaObra(obraObj = null) {
        const obraIdUnica = 'obra_' + Math.random().toString(36.substring(2, 9));
        const div = document.createElement('div');
        div.className = "obra-row flex flex-col gap-3 bg-surface p-3 rounded-2xl border border-outline-variant";
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-primary">Datos de la Obra</span>
                <button type="button" class="text-error material-symbols-outlined text-sm p-1 hover:bg-error/10 rounded" onclick="this.closest('.obra-row').remove()">delete</button>
            </div>
            <div class="flex gap-2">
                <input type="text" placeholder="Nombre de la Obra" value="${obraObj ? obraObj.nombre_obra : ''}" class="obra-nombre flex-1 bg-surface-container border border-outline-variant rounded-lg p-2 text-sm" required>
            </div>
            <div class="flex gap-2">
                <input type="text" placeholder="Dirección" value="${obraObj ? obraObj.direccion : ''}" class="obra-dir flex-1 bg-surface-container border border-outline-variant rounded-lg p-2 text-sm" required>
                <input type="text" placeholder="Localidad" value="${obraObj ? obraObj.localidad : ''}" class="obra-loc flex-1 bg-surface-container border border-outline-variant rounded-lg p-2 text-sm" required>
            </div>
            <div class="flex flex-col gap-2 border-t border-outline-variant/50 pt-2">
                <div class="flex justify-between items-center">
                    <span class="text-[11px] font-medium text-on-surface-variant">Personas de contacto en esta obra</span>
                    <button type="button" class="text-xs bg-surface-variant text-on-surface px-2 py-1 rounded hover:bg-primary hover:text-on-primary" onclick="window.agregarFilaContactoObra('${obraIdUnica}')">+ Contacto Obra</button>
                </div>
                <div id="${obraIdUnica}" class="contactos-obra-subcontainer flex flex-col gap-2"></div>
            </div>
        `;
        obrasContainer.appendChild(div);

        const subContainer = document.getElementById(obraIdUnica);
        if (obraObj && obraObj.contactos_obras && obraObj.contactos_obras.length > 0) {
            obraObj.contactos_obras.forEach(co => {
                const cDiv = document.createElement('div');
                cDiv.className = "flex gap-2 items-center bg-surface-container p-1.5 rounded-lg border border-outline-variant";
                cDiv.innerHTML = `
                    <input type="text" placeholder="Nombre contacto obra" value="${co.nombre}" class="co-nombre flex-1 bg-transparent border-none outline-none text-xs p-1">
                    <input type="tel" placeholder="Teléfono" value="${co.telefono}" class="co-tel w-28 bg-transparent border-none outline-none text-xs p-1">
                    <button type="button" class="text-error material-symbols-outlined text-xs p-1" onclick="this.parentElement.remove()">delete</button>
                `;
                subContainer.appendChild(cDiv);
            });
        }
    }

    window.agregarFilaContactoObra = function(containerId, nombre = '', telefono = '') {
        const container = document.getElementById(containerId);
        if (!container) return;
        const div = document.createElement('div');
        div.className = "flex gap-2 items-center bg-surface-container p-1.5 rounded-lg border border-outline-variant";
        div.innerHTML = `
            <input type="text" placeholder="Nombre contacto obra" value="${nombre}" class="co-nombre flex-1 bg-transparent border-none outline-none text-xs p-1">
            <input type="tel" placeholder="Teléfono" value="${telefono}" class="co-tel w-28 bg-transparent border-none outline-none text-xs p-1">
            <button type="button" class="text-error material-symbols-outlined text-xs p-1" onclick="this.parentElement.remove()">delete</button>
        `;
        container.appendChild(div);
    };

    // --- INICIALIZACIÓN LOGIN ---
    function initAppAfterLogin() {
        if (filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();
        loadTasks();
        loadBitacora();
        loadClientes();

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';

        if (navEmpleados) {
            if (isAdmin) { navEmpleados.classList.remove('hidden'); navEmpleados.classList.add('flex'); }
            else { navEmpleados.classList.add('hidden'); navEmpleados.classList.remove('flex'); }
        }
        if (isAdmin && menuItemEmpresa) { menuItemEmpresa.classList.remove('hidden'); menuItemEmpresa.classList.add('flex'); }
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    if (window.currentUserProfile) initAppAfterLogin();

    // --- MENÚ HEADER ---
    if (btnMenuPerfil && dropdownMenuPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenuPerfil.classList.toggle('hidden'); });
    }
    document.addEventListener('click', () => { if (dropdownMenuPerfil) dropdownMenuPerfil.classList.add('hidden'); });

    if (menuItemPerfil) {
        menuItemPerfil.addEventListener('click', () => {
            hideAllViews();
            viewPerfil.classList.remove('hidden');
            viewPerfil.classList.add('flex');
            if (window.currentUserProfile) {
                document.getElementById('perfil-nombre').value = window.currentUserProfile.nombre || '';
                document.getElementById('perfil-apellido').value = window.currentUserProfile.apellido || '';
                document.getElementById('perfil-telefono').value = window.currentUserProfile.telefono || '';
                document.getElementById('perfil-nombre-header').textContent = `${window.currentUserProfile.nombre} ${window.currentUserProfile.apellido}`;
                document.getElementById('perfil-email-header').textContent = window.currentUserProfile.email;
                if (headerUsernameLabel) headerUsernameLabel.textContent = window.currentUserProfile.nombre || 'Cuenta';
                if (perfilNewPass) perfilNewPass.value = '';
                if (perfilConfirmPass) perfilConfirmPass.value = '';
                if (perfilMensaje) perfilMensaje.classList.add('hidden');
            }
        });
    }

    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (perfilMensaje) perfilMensaje.classList.add('hidden');
            const nuevoNombre = document.getElementById('perfil-nombre').value.trim();
            const nuevoApellido = document.getElementById('perfil-apellido').value.trim();
            const nuevoTelefono = document.getElementById('perfil-telefono').value.trim();
            const pass1 = perfilNewPass.value;
            const pass2 = perfilConfirmPass.value;

            if (pass1 || pass2) {
                if (pass1 !== pass2) {
                    perfilMensaje.textContent = "Las contraseñas no coinciden.";
                    perfilMensaje.className = "text-error text-sm text-center font-medium";
                    perfilMensaje.classList.remove('hidden');
                    return;
                }
                const { error: passError } = await supabaseClient.auth.updateUser({ password: pass1 });
                if (passError) {
                    perfilMensaje.textContent = "Error al actualizar contraseña.";
                    perfilMensaje.className = "text-error text-sm text-center font-medium";
                    perfilMensaje.classList.remove('hidden');
                    return;
                }
            }

            const { error } = await supabaseClient.from('perfiles').update({
                nombre: nuevoNombre, apellido: nuevoApellido, telefono: nuevoTelefono
            }).eq('id', window.currentUserProfile.id);

            if (error) {
                perfilMensaje.textContent = "Error al actualizar perfil.";
                perfilMensaje.className = "text-error text-sm text-center font-medium";
                perfilMensaje.classList.remove('hidden');
            } else {
                window.currentUserProfile.nombre = nuevoNombre;
                window.currentUserProfile.apellido = nuevoApellido;
                window.currentUserProfile.telefono = nuevoTelefono;
                perfilMensaje.textContent = "¡Perfil actualizado con éxito!";
                perfilMensaje.className = "text-green-600 text-sm text-center font-medium";
                perfilMensaje.classList.remove('hidden');
                perfilNewPass.value = ''; perfilConfirmPass.value = '';
            }
        });
    }

    if (menuItemEmpresa) {
        menuItemEmpresa.addEventListener('click', async () => {
            hideAllViews();
            viewEmpresa.classList.remove('hidden');
            viewEmpresa.classList.add('flex');
            const { data } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
            if (data) {
                document.getElementById('emp-nombre').value = data.nombre_fiscal || '';
                document.getElementById('emp-cif').value = data.cif || '';
                document.getElementById('emp-direccion').value = data.direccion || '';
                document.getElementById('emp-logo').value = data.logo_url || '';
            }
        });
    }

    if (formEmpresa) {
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empresaData = {
                nombre_fiscal: document.getElementById('emp-nombre').value.trim(),
                cif: document.getElementById('emp-cif').value.trim(),
                direccion: document.getElementById('emp-direccion').value.trim(),
                logo_url: document.getElementById('emp-logo').value.trim()
            };
            const { data: existing } = await supabaseClient.from('configuracion_empresa').select('id').limit(1).single();
            if (existing) {
                await supabaseClient.from('configuracion_empresa').update(empresaData).eq('id', existing.id);
            } else {
                await supabaseClient.from('configuracion_empresa').insert([empresaData]);
            }
            alert("¡Datos de empresa guardados con éxito!");
        });
    }

    // --- DICTADO POR VOZ ---
    if (btnMicNotas && bitNotas) {
        btnMicNotas.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) { alert("Tu navegador no soporta dictado por voz."); return; }
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            btnMicNotas.classList.add('bg-primary', 'text-on-primary');
            btnMicNotas.textContent = "Escuchando...";
            recognition.start();

            recognition.onresult = (event) => {
                const speechToText = event.results[0][0].transcript;
                bitNotas.value = bitNotas.value ? bitNotas.value + " " + speechToText : speechToText;
            };
            recognition.onerror = () => alert("Error al capturar voz.");
            recognition.onend = () => {
                btnMicNotas.classList.remove('bg-primary', 'text-on-primary');
                btnMicNotas.innerHTML = '<span class="material-symbols-outlined text-[16px]">mic</span> Dictar por Voz';
            };
        });
    }

    // --- PIZARRA COLAPSIBLE Y DINÁMICA ---
    if (btnTogglePizarra && pizarraContainer) {
        btnTogglePizarra.addEventListener('click', () => {
            pizarraContainer.classList.toggle('hidden');
            pizarraContainer.classList.toggle('flex');
            if (pizarraContainer.classList.contains('flex')) {
                btnTogglePizarra.innerHTML = '<span class="material-symbols-outlined text-[18px]">close</span> Cerrar Pizarra / Croquis';
                redibujarPizarraFondo();
            } else {
                btnTogglePizarra.innerHTML = '<span class="material-symbols-outlined text-[18px]">draw</span> Abrir Pizarra / Croquis';
            }
        });
    }

    function configurarPizarra() {
        if (!canvas || !ctx) return;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        let drawing = false;

        function getPos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        canvas.onmousedown = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        canvas.onmousemove = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        canvas.onmouseup = () => { drawing = false; };
        canvas.onmouseleave = () => { drawing = false; };
        canvas.ontouchstart = (e) => { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
        canvas.ontouchmove = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
        canvas.ontouchend = () => { drawing = false; };
    }
    configurarPizarra();

    function redibujarPizarraFondo() {
        if (!canvas || !ctx) return;
        const isDark = document.documentElement.classList.contains('dark');
        canvas.style.backgroundColor = isDark ? '#000000' : '#ffffff';
        ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
    }

    function limpiarPizarra() {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const isDark = document.documentElement.classList.contains('dark');
        canvas.style.backgroundColor = isDark ? '#000000' : '#ffffff';
    }

    const btnLimpiarPizarra = document.getElementById('btn-limpiar-pizarra');
    if (btnLimpiarPizarra) btnLimpiarPizarra.addEventListener('click', limpiarPizarra);

    document.querySelectorAll('.pizarra-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            if (ctx) {
                if (color === 'current') {
                    ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
                } else {
                    ctx.strokeStyle = color;
                }
            }
        });
    });

    // --- CARGAR Y GUARDAR CLIENTES, OBRAS Y CONTACTOS ---
    async function loadClientes() {
        // Cargar clientes con sus contactos y obras con sus contactos en paralelo
        const { data: clientesData, error: cliError } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        if (cliError) {
            if (clientesContainer) clientesContainer.innerHTML = `<p class="text-error text-center mt-4">Error al cargar clientes: ${cliError.message}</p>`;
            return;
        }

        allClientesCompletos = [];
        for (const cli of (clientesData || [])) {
            // Cargar contactos del cliente
            const { data: cCli } = await supabaseClient.from('contactos_clientes').select('*').eq('cliente_id', cli.id);
            // Cargar obras del cliente
            const { data: obrasCli } = await supabaseClient.from('obras').select('*').eq('cliente_id', cli.id);
            
            const obrasCompletas = [];
            for (const ob of (obrasCli || [])) {
                const { data: cOb } = await supabaseClient.from('contactos_obras').select('*').eq('obra_id', ob.id);
                obrasCompletas.push({ ...ob, contactos_obras: cOb || [] });
            }

            allClientesCompletos.push({
                ...cli,
                contactos_clientes: cCli || [],
                obras: obrasCompletas
            });
        }

        actualizarDatalists();
        if (clientesContainer) renderClientes(allClientesCompletos);
    }

    function actualizarDatalists() {
        if (datalistClientes) {
            datalistClientes.innerHTML = '';
            allClientesCompletos.forEach(cli => {
                const opt = document.createElement('option');
                opt.value = cli.nombre_cliente;
                datalistClientes.appendChild(opt);
            });
        }
        if (datalistObras && bitCliente) {
            datalistObras.innerHTML = '';
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const clienteEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (clienteEncontrado && clienteEncontrado.obras) {
                clienteEncontrado.obras.forEach(ob => {
                    const opt = document.createElement('option');
                    opt.value = ob.nombre_obra;
                    opt.textContent = `${ob.direccion}, ${ob.localidad}`;
                    datalistObras.appendChild(opt);
                });
            }
        }
    }

    if (bitCliente) {
        bitCliente.addEventListener('input', () => {
            actualizarDatalists();
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const encontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (encontrado && encontrado.obras && encontrado.obras.length > 0) {
                if (bitObra) bitObra.value = encontrado.obras[0].nombre_obra || '';
                if (bitDireccion) bitDireccion.value = encontrado.obras[0].direccion || '';
                if (bitLocalidad) bitLocalidad.value = encontrado.obras[0].localidad || '';
            }
        });
    }

    if (bitObra) {
        bitObra.addEventListener('input', () => {
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const obraSel = bitObra.value.trim().toLowerCase();
            const clienteEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (clienteEncontrado && clienteEncontrado.obras) {
                const obraEncontrada = clienteEncontrado.obras.find(o => o.nombre_obra.toLowerCase() === obraSel);
                if (obraEncontrada) {
                    if (bitDireccion) bitDireccion.value = obraEncontrada.direccion || '';
                    if (bitLocalidad) bitLocalidad.value = obraEncontrada.localidad || '';
                }
            }
        });
    }

    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cName = cliNombre.value.trim();
            const editId = editClienteId.value;

            let clienteId = editId;
            if (editId) {
                await supabaseClient.from('clientes').update({ nombre_cliente: cName }).eq('id', editId);
                // Borrar relaciones antiguas para reinsertar limpias
                await supabaseClient.from('contactos_clientes').delete().eq('cliente_id', editId);
                await supabaseClient.from('obras').delete().eq('cliente_id', editId);
            } else {
                const { data: newCli, error } = await supabaseClient.from('clientes').insert([{ nombre_cliente: cName }]).select().single();
                if (error) { alert("Error al guardar cliente: " + error.message); return; }
                clienteId = newCli.id;
            }

            // Guardar Contactos del Cliente
            const filasCC = contactosClienteContainer.querySelectorAll('.flex.gap-2.items-center');
            for (const fila of filasCC) {
                const nombre = fila.querySelector('.contacto-cli-nombre').value.trim();
                const telefono = fila.querySelector('.contacto-cli-tel').value.trim();
                if (nombre) {
                    await supabaseClient.from('contactos_clientes').insert([{ cliente_id: clienteId, nombre, telefono }]);
                }
            }

            // Guardar Obras y sus contactos
            const filasObras = obrasContainer.querySelectorAll('.obra-row');
            for (const fObra of filasObras) {
                const nombre_obra = fObra.querySelector('.obra-nombre').value.trim();
                const direccion = fObra.querySelector('.obra-dir').value.trim();
                const localidad = fObra.querySelector('.obra-loc').value.trim();
                if (nombre_obra) {
                    const { data: newOb, error: obError } = await supabaseClient.from('obras').insert([{
                        cliente_id: clienteId, nombre_obra, direccion, localidad
                    }]).select().single();

                    if (!obError && newOb) {
                        const subContainer = fObra.querySelector('.contactos-obra-subcontainer');
                        const filasCO = subContainer.querySelectorAll('.flex.gap-2.items-center');
                        for (const fCo of filasCO) {
                            const coNombre = fCo.querySelector('.co-nombre').value.trim();
                            const coTel = fCo.querySelector('.co-tel').value.trim();
                            if (coNombre) {
                                await supabaseClient.from('contactos_obras').insert([{ obra_id: newOb.id, nombre: coNombre, telefono: coTel }]);
                            }
                        }
                    }
                }
            }

            modalCliente.classList.add('hidden');
            loadClientes();
        });
    }

    function renderClientes(clientesToRender) {
        clientesContainer.innerHTML = '';
        if (clientesCount) clientesCount.textContent = `${clientesToRender.length} clientes`;
        if (clientesToRender.length === 0) {
            clientesContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay clientes registrados.</p>';
            return;
        }

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';

        clientesToRender.forEach(cli => {
            const card = document.createElement('div');
            card.className = "p-5 rounded-3xl shadow-sm bg-surface-container-low flex flex-col gap-4";
            
            // HTML de contactos del cliente
            let contactosCliHtml = '';
            if (cli.contactos_clientes && cli.contactos_clientes.length > 0) {
                contactosCliHtml = `<div class="flex flex-wrap gap-2 text-xs pt-1"><span class="font-medium text-on-surface-variant">Contactos Cliente:</span>` +
                    cli.contactos_clientes.map(cc => `<a href="tel:${cc.telefono}" class="bg-surface px-2.5 py-1 rounded-lg border border-outline-variant text-primary font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">call</span> ${cc.nombre}: ${cc.telefono}</a>`).join('') +
                    `</div>`;
            }

            // HTML de Obras
            let obrasHtml = '';
            if (cli.obras && cli.obras.length > 0) {
                obrasHtml = `<div class="flex flex-col gap-3 mt-2 border-t border-outline-variant pt-3"><span class="text-xs font-bold text-primary uppercase tracking-wider">Obras (${cli.obras.length})</span>` +
                    cli.obras.map(ob => {
                        const mapsQuery = encodeURIComponent(`${ob.direccion}, ${ob.localidad}`);
                        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
                        
                        let contactosObraHtml = '';
                        if (ob.contactos_obras && ob.contactos_obras.length > 0) {
                            contactosObraHtml = `<div class="flex flex-wrap gap-2 text-xs mt-1"><span class="text-on-surface-variant">Contacto Obra:</span>` +
                                ob.contactos_obras.map(co => `<a href="tel:${co.telefono}" class="bg-surface-container px-2 py-0.5 rounded border border-outline-variant text-primary font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">call</span> ${co.nombre} (${co.telefono})</a>`).join('') +
                                `</div>`;
                        }

                        return `
                            <div class="bg-surface p-3.5 rounded-2xl border border-outline-variant flex flex-col gap-2">
                                <div class="flex justify-between items-start">
                                    <h4 class="font-medium text-sm text-on-surface">🏗️ ${ob.nombre_obra}</h4>
                                    <a href="${mapsUrl}" target="_blank" class="text-xs bg-primary text-on-primary px-3 py-1.5 rounded-full font-medium flex items-center gap-1 shadow-xs hover:opacity-90">
                                        <span class="material-symbols-outlined text-[14px]">map</span> Google Maps
                                    </a>
                                </div>
                                <p class="text-xs text-on-surface-variant">📍 ${ob.direccion}, ${ob.localidad}</p>
                                ${contactosObraHtml}
                            </div>
                        `;
                    }).join('') + `</div>`;
            } else {
                obrasHtml = `<p class="text-xs text-on-surface-variant italic mt-1">Este cliente aún no tiene obras registradas.</p>`;
            }

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg text-on-surface">${cli.nombre_cliente}</h3>
                    </div>
                    ${isAdmin ? `<button onclick="window.editarCliente('${cli.id}')" class="text-xs bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium">Modificar / Añadir Obra</button>` : ''}
                </div>
                ${contactosCliHtml}
                ${obrasHtml}
            `;
            clientesContainer.appendChild(card);
        });
    }

    if (searchClientesInput) {
        searchClientesInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtrados = allClientesCompletos.filter(cli => {
                const matchCli = (cli.nombre_cliente && cli.nombre_cliente.toLowerCase().includes(q));
                const matchContactosCli = cli.contactos_clientes.some(cc => cc.nombre.toLowerCase().includes(q) || cc.telefono.includes(q));
                const matchObras = cli.obras.some(ob => 
                    ob.nombre_obra.toLowerCase().includes(q) || 
                    ob.direccion.toLowerCase().includes(q) || 
                    ob.localidad.toLowerCase().includes(q) ||
                    ob.contactos_obras.some(co => co.nombre.toLowerCase().includes(q) || co.telefono.includes(q))
                );
                return matchCli || matchContactosCli || matchObras;
            });
            renderClientes(filtrados);
        });
    }

    window.editarCliente = function(id) {
        const cli = allClientesCompletos.find(c => c.id === id);
        if (!cli) return;
        modalClienteTitle.textContent = "Editar Cliente, Obras y Contactos";
        editClienteId.value = cli.id;
        cliNombre.value = cli.nombre_cliente || '';
        
        if (contactosClienteContainer) contactosClienteContainer.innerHTML = '';
        if (cli.contactos_clientes && cli.contactos_clientes.length > 0) {
            cli.contactos_clientes.forEach(cc => agregarFilaContactoCliente(cc.nombre, cc.telefono));
        } else {
            agregarFilaContactoCliente();
        }

        if (obrasContainer) obrasContainer.innerHTML = '';
        if (cli.obras && cli.obras.length > 0) {
            cli.obras.forEach(ob => agregarFilaObra(ob));
        } else {
            agregarFilaObra();
        }

        modalCliente.classList.remove('hidden');
    };

    // --- BITÁCORA Y TAREAS ---
    async function loadBitacora() {
        if (!bitacoraContainer) return;
        bitacoraContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        const { data, error } = await supabaseClient.from('bitacora').select('*').order('created_at', { ascending: false });
        if (error) {
            bitacoraContainer.innerHTML = '<p class="text-error text-center">Error al cargar bitácora.</p>';
            return;
        }
        allBitacora = data || [];
        renderBitacora(allBitacora);
    }

    function renderBitacora(items) {
        bitacoraContainer.innerHTML = '';
        if (bitacoraCount) bitacoraCount.textContent = `${items.length} registros`;
        if (items.length === 0) {
            bitacoraContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay registros en la bitácora.</p>';
            return;
        }

        items.forEach(item => {
            const fecha = new Date(item.created_at).toLocaleString();
            const card = document.createElement('div');
            card.className = "p-4 rounded-2xl shadow-sm bg-surface-container-low flex flex-col gap-3";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-primary bg-primary-container px-2.5 py-1 rounded-md">${item.cliente} - ${item.obra}</span>
                    <span class="text-[11px] text-on-surface-variant">${fecha}</span>
                </div>
                <p class="text-sm text-on-surface line-clamp-2">${item.notas || 'Sin notas'}</p>
                <div class="flex justify-between items-center text-xs text-on-surface-variant pt-2 border-t border-outline-variant">
                    <span>✏️ Creado por: <strong>${item.created_by || 'Desconocido'}</strong></span>
                    <div class="flex gap-2">
                        <button onclick="window.verDetalleBitacora('${item.id}')" class="bg-surface text-primary px-3 py-1.5 rounded-lg border border-primary font-medium">Ver</button>
                        <button onclick="window.editarBitacora('${item.id}')" class="bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium">Modificar</button>
                    </div>
                </div>
            `;
            bitacoraContainer.appendChild(card);
        });
    }

    if (searchBitacoraInput) {
        searchBitacoraInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtrados = allBitacora.filter(b => 
                (b.cliente && b.cliente.toLowerCase().includes(q)) || 
                (b.obra && b.obra.toLowerCase().includes(q)) || 
                (b.notas && b.notas.toLowerCase().includes(q)) || 
                (b.created_by && b.created_by.toLowerCase().includes(q))
            );
            renderBitacora(filtrados);
        });
    }

    if (formBitacora) {
        formBitacora.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-bitacora');
            btnSubmit.disabled = true;

            const cName = bitCliente.value.trim();
            const oName = bitObra.value.trim();
            const dName = bitDireccion.value.trim();
            const lName = bitLocalidad.value.trim();

            // Sincronizar automáticamente en la tabla relacional si no existe
            let cliEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === cName.toLowerCase());
            let clienteId;
            if (!cliEncontrado) {
                const { data: newC } = await supabaseClient.from('clientes').insert([{ nombre_cliente: cName }]).select().single();
                clienteId = newC.id;
            } else {
                clienteId = cliEncontrado.id;
            }

            const obraEncontrada = allClientesCompletos.find(c => c.id === clienteId)?.obras?.find(o => o.nombre_obra.toLowerCase() === oName.toLowerCase());
            if (!obraEncontrada) {
                await supabaseClient.from('obras').insert([{
                    cliente_id: clienteId, nombre_obra: oName, direccion: dName, localidad: lName
                }]);
                loadClientes();
            }

            const username = window.currentUserProfile ? (window.currentUserProfile.nombre + ' ' + window.currentUserProfile.apellido) : 'Usuario';
            const pizarraDataURL = (canvas && pizarraContainer.classList.contains('flex')) ? canvas.toDataURL() : '';

            const bitacoraData = {
                cliente: cName,
                obra: oName,
                direccion: dName,
                localidad: lName,
                notas: bitNotas.value.trim(),
                pizarra_data: pizarraDataURL,
                updated_by: username
            };

            const id = editBitacoraId.value;
            let error;
            if (id) {
                const res = await supabaseClient.from('bitacora').update(bitacoraData).eq('id', id);
                error = res.error;
            } else {
                bitacoraData.created_by = username;
                const res = await supabaseClient.from('bitacora').insert([bitacoraData]);
                error = res.error;
            }

            if (error) {
                alert("Error al guardar: " + error.message);
            } else {
                formBitacora.reset();
                limpiarPizarra();
                navBitacora.click();
            }
            btnSubmit.disabled = false;
        });
    }

    window.verDetalleBitacora = async function(id) {
        const item = allBitacora.find(b => b.id === id);
        if (!item) return;
        currentBitacoraItem = item;
        hideAllViews();
        viewDetalleBitacora.classList.remove('hidden');
        viewDetalleBitacora.classList.add('flex');

        const { data: emp } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
        const logoImg = document.getElementById('pdf-emp-logo');
        if (emp) {
            document.getElementById('pdf-emp-nombre').textContent = emp.nombre_fiscal || 'Diario de Obra';
            document.getElementById('pdf-emp-cif').textContent = emp.cif ? `CIF: ${emp.cif}` : '';
            document.getElementById('pdf-emp-dir').textContent = emp.direccion || '';
            if (emp.logo_url && logoImg) {
                logoImg.src = emp.logo_url;
                logoImg.classList.remove('hidden');
            } else if (logoImg) {
                logoImg.classList.add('hidden');
            }
        }

        const mapsQuery = encodeURIComponent(`${item.direccion}, ${item.localidad}`);
        detalleBitacoraContent.innerHTML = `
            <div><span class="text-xs text-on-surface-variant">Cliente / Obra:</span><p class="font-medium text-lg">${item.cliente} - ${item.obra}</p></div>
            <div><span class="text-xs text-on-surface-variant">Dirección:</span><p class="font-medium"><a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" class="text-primary underline">${item.direccion}, ${item.localidad}</a></p></div>
            <div><span class="text-xs text-on-surface-variant">Notas y Observaciones:</span><p class="bg-surface-container p-3 rounded-xl mt-1 whitespace-pre-line">${item.notas || 'Sin notas'}</p></div>
            ${item.pizarra_data ? `<div><span class="text-xs text-on-surface-variant">Croquis / Pizarra:</span><div class="mt-1 border border-outline-variant rounded-xl p-2 bg-surface inline-block"><img src="${item.pizarra_data}" class="max-h-48 rounded-lg"/></div></div>` : ''}
            <div class="text-xs text-on-surface-variant pt-3 border-t border-outline-variant flex justify-between">
                <span>Creado por: <strong>${item.created_by || 'Desconocido'}</strong> (${new Date(item.created_at).toLocaleString()})</span>
                <span>Última modif: <strong>${item.updated_by || 'N/D'}</strong></span>
            </div>
        `;
    };

    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', () => {
            const element = document.getElementById('pdf-export-container');
            const opt = {
                margin: 10,
                filename: `Bitacora_${currentBitacoraItem ? currentBitacoraItem.cliente : 'registro'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    }

    window.editarBitacora = function(id) {
        const item = allBitacora.find(b => b.id === id);
        if (!item) return;
        hideAllViews();
        formBitacoraTitle.textContent = "Modificar Registro de Bitácora";
        editBitacoraId.value = item.id;
        bitCliente.value = item.cliente || '';
        bitObra.value = item.obra || '';
        bitDireccion.value = item.direccion || '';
        bitLocalidad.value = item.localidad || '';
        bitNotas.value = item.notas || '';
        
        limpiarPizarra();
        if (item.pizarra_data && ctx && canvas) {
            if (pizarraContainer) {
                pizarraContainer.classList.remove('hidden');
                pizarraContainer.classList.add('flex');
                btnTogglePizarra.innerHTML = '<span class="material-symbols-outlined text-[18px]">close</span> Cerrar Pizarra / Croquis';
            }
            const img = new Image();
            img.onload = () => { ctx.drawImage(img, 0, 0); };
            img.src = item.pizarra_data;
        } else {
            if (pizarraContainer) {
                pizarraContainer.classList.add('hidden');
                pizarraContainer.classList.remove('flex');
                btnTogglePizarra.innerHTML = '<span class="material-symbols-outlined text-[18px]">draw</span> Abrir Pizarra / Croquis';
            }
        }

        viewFormBitacora.classList.remove('hidden');
        viewFormBitacora.classList.add('flex');
    };

    // --- TAREAS ---
    if (filtroFechaDiario) filtroFechaDiario.addEventListener('change', loadTasks);

    async function loadTasks() {
        if (!tasksContainer || !filtroFechaDiario) return;
        tasksContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        const selectedDate = filtroFechaDiario.value || getTodayLocalString();
        const { data, error } = await supabaseClient.from('tareas').select('*').eq('fecha', selectedDate).order('completada', { ascending: true });
        
        if (error) {
            tasksContainer.innerHTML = '<p class="text-error text-center mt-4">Error al cargar tareas.</p>';
            return;
        }
        allTasks = data || [];
        renderTasks(allTasks);
    }

    function renderTasks(tasksToRender) {
        tasksContainer.innerHTML = '';
        if (tasksToRender.length === 0) {
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas para esta fecha.</p>';
            return;
        }

        tasksToRender.forEach(tarea => {
            const isCompleted = tarea.completada;
            const cardBg = isCompleted ? 'bg-surface-variant opacity-70' : 'bg-surface-container-low';
            const isMyTask = window.currentUserProfile && (tarea.operario_username === window.currentUserProfile.username);
            const mapsQuery = encodeURIComponent(`${tarea.direccion}, ${tarea.localidad}`);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-primary bg-primary-container px-2 py-1 rounded-md">${tarea.cliente} - ${tarea.obra}</span>
                    ${isCompleted ? '<span class="material-symbols-outlined text-green-600">check_circle</span>' : ''}
                </div>
                <h3 class="font-medium text-base ${isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}">${tarea.tarea}</h3>
                <div class="text-xs text-on-surface-variant flex justify-between items-center mt-1">
                    <span>👷 @${tarea.operario_username}</span>
                    <a href="${mapsUrl}" target="_blank" class="flex items-center gap-1 text-primary font-medium hover:underline bg-surface px-2 py-1 rounded-md border border-outline-variant">
                        <span class="material-symbols-outlined text-[14px]">map</span> ${tarea.localidad}
                    </a>
                </div>
                <div class="flex gap-2 mt-3 pt-2 border-t border-outline-variant items-center justify-between">
                    <button onclick="window.verDetalles('${tarea.id}')" class="text-xs bg-surface text-primary px-3 py-1.5 rounded-lg border border-primary font-medium">Ver</button>
                    ${(!isCompleted && isMyTask) ? `<button onclick="window.marcarCompletada('${tarea.id}')" class="text-xs bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-lg font-medium">Realizada</button>` : ''}
                </div>
            `;
            tasksContainer.appendChild(card);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtradas = allTasks.filter(t => 
                (t.operario_username && t.operario_username.toLowerCase().includes(q)) || 
                (t.cliente && t.cliente.toLowerCase().includes(q)) ||
                (t.obra && t.obra.toLowerCase().includes(q)) ||
                (t.localidad && t.localidad.toLowerCase().includes(q)) ||
                (t.tarea && t.tarea.toLowerCase().includes(q))
            );
            renderTasks(filtradas);
        });
    }

    window.verDetalles = function(id) {
        const tarea = allTasks.find(t => t.id === id);
        if (!tarea) return;
        const mapsQuery = encodeURIComponent(`${tarea.direccion}, ${tarea.localidad}`);
        detalleContenido.innerHTML = `
            <div><span class="text-xs text-on-surface-variant">Cliente / Obra:</span><p class="font-medium text-lg">${tarea.cliente} - ${tarea.obra}</p></div>
            <div><span class="text-xs text-on-surface-variant">Dirección:</span><p class="font-medium"><a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" class="text-primary underline">${tarea.direccion}, ${tarea.localidad}</a></p></div>
            <div><span class="text-xs text-on-surface-variant">Operario:</span><p class="font-medium">@${tarea.operario_username}</p></div>
            <div><span class="text-xs text-on-surface-variant">Descripción:</span><p class="bg-surface-container p-3 rounded-xl mt-1">${tarea.tarea}</p></div>
        `;
        modalDetalle.classList.remove('hidden');
    };

    if (btnCloseDetalle) btnCloseDetalle.addEventListener('click', () => modalDetalle.classList.add('hidden'));

    window.marcarCompletada = async function(id) {
        await supabaseClient.from('tareas').update({ completada: true }).eq('id', id);
        loadTasks();
    };

    if (formNewTask) {
        formNewTask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-task');
            btnSubmit.disabled = true;

            const tareaData = {
                fecha: inputFecha.value,
                cliente: inputCliente.value,
                obra: inputObra.value,
                direccion: inputDireccion.value,
                localidad: inputLocalidad.value,
                operario_username: selectOperario.value,
                tarea: inputTarea.value,
                user_id: window.currentUserProfile.id
            };

            const { error } = await supabaseClient.from('tareas').insert([tareaData]);
            if (error) {
                alert("Error al guardar tarea: " + error.message);
            } else {
                formNewTask.reset();
                if (filtroFechaDiario) filtroFechaDiario.value = inputFecha.value;
                navHome.click();
            }
            btnSubmit.disabled = false;
        });
    }

    async function loadEmpleados() {
        if (!empleadosContainer) return;
        empleadosContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        const { data, error } = await supabaseClient.from('perfiles').select('*').order('nombre', { ascending: true });
        if (error) {
            empleadosContainer.innerHTML = '<p class="text-error text-center">Error al cargar empleados.</p>';
            return;
        }
        allEmpleados = data || [];
        renderEmpleados(allEmpleados);
    }

    function renderEmpleados(empleadosToRender) {
        empleadosContainer.innerHTML = '';
        if (empleadosCount) empleadosCount.textContent = `${empleadosToRender.length} empleados`;
        empleadosToRender.forEach(emp => {
            const card = document.createElement('div');
            card.className = `p-4 rounded-2xl shadow-sm flex flex-col gap-3 ${emp.activo ? 'bg-surface-container-low' : 'card-pendiente'}`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-base text-on-surface">${emp.nombre || ''} ${emp.apellido || ''} ${!emp.activo ? '<span class="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold ml-2">Pendiente</span>' : ''}</h3>
                        <p class="text-xs opacity-80">@${emp.username || 'sin_usuario'}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 items-center text-sm pt-1">
                    <a href="tel:${emp.telefono || ''}" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium">
                        <span class="material-symbols-outlined text-[16px]">call</span> ${emp.telefono || 'Sin teléfono'}
                    </a>
                </div>
            `;
            empleadosContainer.appendChild(card);
        });
    }

    if (searchEmpleadosInput) {
        searchEmpleadosInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtradas = allEmpleados.filter(emp => 
                (emp.nombre && emp.nombre.toLowerCase().includes(q)) || 
                (emp.apellido && emp.apellido.toLowerCase().includes(q)) || 
                (emp.email && emp.email.toLowerCase().includes(q)) || 
                (emp.telefono && emp.telefono.toLowerCase().includes(q))
            );
            renderEmpleados(filtradas);
        });
    }

    async function loadOperariosSelect() {
        if (!selectOperario) return;
        const { data } = await supabaseClient.from('perfiles').select('username').eq('activo', true);
        if (data) {
            selectOperario.innerHTML = '<option value="" disabled selected>Selecciona un operario...</option>';
            data.forEach(op => selectOperario.innerHTML += `<option value="${op.username}">@${op.username}</option>`);
        }
    }
})();
