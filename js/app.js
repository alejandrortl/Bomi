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

    // Clientes y Datalists
    const clientesContainer = document.getElementById('clientes-container');
    const clientesCount = document.getElementById('clientes-count');
    const searchClientesInput = document.getElementById('search-clientes');
    const modalCliente = document.getElementById('modal-cliente');
    const formCliente = document.getElementById('form-cliente');
    const modalClienteTitle = document.getElementById('modal-cliente-title');
    const editClienteId = document.getElementById('edit-cliente-id');
    const cliNombre = document.getElementById('cli-nombre');
    const cliObra = document.getElementById('cli-obra');
    const cliDireccion = document.getElementById('cli-direccion');
    const cliLocalidad = document.getElementById('cli-localidad');
    const cliTelefono = document.getElementById('cli-telefono');
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
    let allClientes = [];
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

    if (fabNewCliente) {
        fabNewCliente.addEventListener('click', () => {
            modalClienteTitle.textContent = "Nuevo Cliente / Obra";
            formCliente.reset();
            editClienteId.value = "";
            modalCliente.classList.remove('hidden');
        });
    }
    if (btnCloseModalCliente) btnCloseModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));
    if (btnCancelModalCliente) btnCancelModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));

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

    // --- CLIENTES Y OBRAS INTELIGENTES ---
    async function loadClientes() {
        const { data, error } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        if (!error && data) {
            allClientes = data;
            actualizarDatalists();
            if (clientesContainer) renderClientes(allClientes);
        } else if (error) {
            if (clientesContainer) clientesContainer.innerHTML = `<p class="text-error text-center mt-4">Error al cargar clientes: ${error.message}</p>`;
        }
    }

    function actualizarDatalists() {
        if (datalistClientes) {
            datalistClientes.innerHTML = '';
            const unicosClientes = [...new Set(allClientes.map(c => c.nombre_cliente))];
            unicosClientes.forEach(nombre => {
                const opt = document.createElement('option');
                opt.value = nombre;
                datalistClientes.appendChild(opt);
            });
        }
        if (datalistObras && bitCliente) {
            datalistObras.innerHTML = '';
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const obrasDelCliente = allClientes.filter(c => c.nombre_cliente.toLowerCase() === clienteSel);
            obrasDelCliente.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.obra;
                opt.textContent = `${c.direccion}, ${c.localidad}`;
                datalistObras.appendChild(opt);
            });
        }
    }

    if (bitCliente) {
        bitCliente.addEventListener('input', () => {
            actualizarDatalists();
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const encontrado = allClientes.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (encontrado) {
                if (bitObra) bitObra.value = encontrado.obra || '';
                if (bitDireccion) bitDireccion.value = encontrado.direccion || '';
                if (bitLocalidad) bitLocalidad.value = encontrado.localidad || '';
            }
        });
    }

    if (bitObra) {
        bitObra.addEventListener('input', () => {
            const clienteSel = bitCliente.value.trim().toLowerCase();
            const obraSel = bitObra.value.trim().toLowerCase();
            const encontrado = allClientes.find(c => c.nombre_cliente.toLowerCase() === clienteSel && c.obra.toLowerCase() === obraSel);
            if (encontrado) {
                if (bitDireccion) bitDireccion.value = encontrado.direccion || '';
                if (bitLocalidad) bitLocalidad.value = encontrado.localidad || '';
            }
        });
    }

    if (inputCliente) {
        inputCliente.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            const encontrado = allClientes.find(c => c.nombre_cliente.toLowerCase() === val);
            if (encontrado && inputObra) {
                inputObra.value = encontrado.obra || '';
                if (inputDireccion) inputDireccion.value = encontrado.direccion || '';
                if (inputLocalidad) inputLocalidad.value = encontrado.localidad || '';
            }
        });
    }

    // --- BITÁCORA ---
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

            const existeClienteObra = allClientes.find(c => c.nombre_cliente.toLowerCase() === cName.toLowerCase() && c.obra.toLowerCase() === oName.toLowerCase());
            if (!existeClienteObra) {
                await supabaseClient.from('clientes').insert([{
                    nombre_cliente: cName,
                    obra: oName,
                    direccion: dName,
                    localidad: lName
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

    // --- TAREAS Y CLIENTES ---
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

    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clienteData = {
                nombre_cliente: cliNombre.value.trim(),
                obra: cliObra.value.trim(),
                direccion: cliDireccion.value.trim(),
                localidad: cliLocalidad.value.trim(),
                telefono: cliTelefono.value.trim()
            };
            const id = editClienteId.value;
            let error;
            if (id) {
                const res = await supabaseClient.from('clientes').update(clienteData).eq('id', id);
                error = res.error;
            } else {
                const res = await supabaseClient.from('clientes').insert([clienteData]);
                error = res.error;
            }
            if (error) {
                alert("Error al guardar cliente: " + error.message);
            } else {
                modalCliente.classList.add('hidden');
                loadClientes();
            }
        });
    }

    function renderClientes(clientesToRender) {
        clientesContainer.innerHTML = '';
        if (clientesCount) clientesCount.textContent = `${clientesToRender.length} registros`;
        if (clientesToRender.length === 0) {
            clientesContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay clientes registrados.</p>';
            return;
        }

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';

        clientesToRender.forEach(cli => {
            const telefonoLink = cli.telefono ? `tel:${cli.telefono}` : '#';
            const mapsQuery = encodeURIComponent(`${cli.direccion}, ${cli.localidad}`);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

            const card = document.createElement('div');
            card.className = "p-4 rounded-2xl shadow-sm bg-surface-container-low flex flex-col gap-3";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-base text-on-surface">${cli.nombre_cliente}</h3>
                        <p class="text-xs text-primary font-medium bg-primary-container/40 px-2 py-0.5 rounded-md inline-block mt-1">Obra: ${cli.obra}</p>
                    </div>
                    ${isAdmin ? `<button onclick="window.abrirModalEditarCliente('${cli.id}')" class="text-xs bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium">Editar</button>` : ''}
                </div>
                <div class="flex flex-wrap gap-2 items-center text-sm pt-1">
                    <a href="${telefonoLink}" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium">
                        <span class="material-symbols-outlined text-[16px]">call</span> ${cli.telefono || 'Sin teléfono'}
                    </a>
                    <a href="${mapsUrl}" target="_blank" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium">
                        <span class="material-symbols-outlined text-[16px]">map</span> ${cli.direccion}, ${cli.localidad}
                    </a>
                </div>
            `;
            clientesContainer.appendChild(card);
        });
    }

    if (searchClientesInput) {
        searchClientesInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtrados = allClientes.filter(cli => 
                (cli.nombre_cliente && cli.nombre_cliente.toLowerCase().includes(q)) || 
                (cli.obra && cli.obra.toLowerCase().includes(q)) || 
                (cli.direccion && cli.direccion.toLowerCase().includes(q)) || 
                (cli.localidad && cli.localidad.toLowerCase().includes(q))
            );
            renderClientes(filtrados);
        });
    }

    window.abrirModalEditarCliente = function(id) {
        const cli = allClientes.find(c => c.id === id);
        if (!cli) return;
        modalClienteTitle.textContent = "Editar Cliente / Obra";
        editClienteId.value = cli.id;
        cliNombre.value = cli.nombre_cliente || '';
        cliObra.value = cli.obra || '';
        cliDireccion.value = cli.direccion || '';
        cliLocalidad.value = cli.localidad || '';
        cliTelefono.value = cli.telefono || '';
        modalCliente.classList.remove('hidden');
    };

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
