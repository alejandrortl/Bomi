// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const viewClientes = document.getElementById('view-clientes');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    
    const navHome = document.getElementById('nav-home');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewCliente = document.getElementById('fab-new-cliente');

    // Menús Header
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

    // Clientes
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

    // Empleados
    const empleadosContainer = document.getElementById('empleados-container');
    const empleadosCount = document.getElementById('empleados-count');
    const searchEmpleadosInput = document.getElementById('search-empleados');

    // Detalles Modal
    const modalDetalle = document.getElementById('modal-detalle-tarea');
    const detalleContenido = document.getElementById('detalle-contenido');
    const btnCloseDetalle = document.getElementById('btn-close-detalle');

    let allTasks = [];
    let allClientes = [];
    let allEmpleados = [];

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }

    function hideAllViews() {
        if (viewTaskList) viewTaskList.classList.add('hidden');
        if (viewNewTask) { viewNewTask.classList.add('hidden'); viewNewTask.classList.remove('flex'); }
        if (viewClientes) { viewClientes.classList.add('hidden'); viewClientes.classList.remove('flex'); }
        if (viewEmpleados) { viewEmpleados.classList.add('hidden'); viewEmpleados.classList.remove('flex'); }
        if (viewPerfil) { viewPerfil.classList.add('hidden'); viewPerfil.classList.remove('flex'); }
        if (viewEmpresa) { viewEmpresa.classList.add('hidden'); viewEmpresa.classList.remove('flex'); }
        
        if (navHome) navHome.classList.remove('text-primary');
        if (navClientes) navClientes.classList.remove('text-primary');
        if (navEmpleados) navEmpleados.classList.remove('text-primary');
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewCliente) fabNewCliente.classList.add('hidden');
    }

    // --- NAVEGACIÓN INFERIOR ---
    if (navHome) {
        navHome.addEventListener('click', () => {
            hideAllViews();
            if (viewTaskList) viewTaskList.classList.remove('hidden');
            navHome.classList.add('text-primary');
            if (fabNewTask) {
                fabNewTask.classList.remove('hidden');
                fabNewTask.classList.add('flex');
            }
            loadTasks();
        });
    }

    if (navClientes) {
        navClientes.addEventListener('click', () => {
            hideAllViews();
            if (viewClientes) {
                viewClientes.classList.remove('hidden');
                viewClientes.classList.add('flex');
            }
            navClientes.classList.add('text-primary');
            if (fabNewCliente) {
                fabNewCliente.classList.remove('hidden');
                fabNewCliente.classList.add('flex');
            }
            loadClientes();
        });
    }

    if (navEmpleados) {
        navEmpleados.addEventListener('click', () => {
            hideAllViews();
            if (viewEmpleados) {
                viewEmpleados.classList.remove('hidden');
                viewEmpleados.classList.add('flex');
            }
            navEmpleados.classList.add('text-primary');
            loadEmpleados();
        });
    }

    // --- FAB DIARIO ---
    if (fabNewTask) {
        fabNewTask.addEventListener('click', () => {
            hideAllViews();
            document.getElementById('form-task-title').textContent = "Asignar Nueva Tarea";
            if (formNewTask) formNewTask.reset();
            if (inputFecha) inputFecha.value = getTodayLocalString();
            loadOperariosSelect();
            if (viewNewTask) {
                viewNewTask.classList.remove('hidden');
                viewNewTask.classList.add('flex');
            }
        });
    }

    if (btnCancelTask) {
        btnCancelTask.addEventListener('click', () => {
            if (navHome) navHome.click();
        });
    }

    // --- FAB CLIENTES ---
    if (fabNewCliente) {
        fabNewCliente.addEventListener('click', () => {
            if (modalClienteTitle) modalClienteTitle.textContent = "Nuevo Cliente / Obra";
            if (formCliente) formCliente.reset();
            if (editClienteId) editClienteId.value = "";
            if (modalCliente) modalCliente.classList.remove('hidden');
        });
    }

    if (btnCloseModalCliente) btnCloseModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));
    if (btnCancelModalCliente) btnCancelModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));

    // --- EVENTO LOGIN EXITOSO ---
    window.addEventListener('userLoggedIn', () => {
        if (filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();
        loadTasks();
        loadClientes();

        const isAdmin = window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin';
        if (navEmpleados) {
            if (isAdmin) {
                navEmpleados.classList.remove('hidden');
                navEmpleados.classList.add('flex');
            } else {
                navEmpleados.classList.add('hidden');
            }
        }
        if (isAdmin && menuItemEmpresa) {
            menuItemEmpresa.classList.remove('hidden');
            menuItemEmpresa.classList.add('flex');
        }
    });

    // --- MENÚ HEADER ---
    if (btnMenuPerfil && dropdownMenuPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenuPerfil.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', () => {
        if (dropdownMenuPerfil) dropdownMenuPerfil.classList.add('hidden');
    });

    if (menuItemPerfil) {
        menuItemPerfil.addEventListener('click', () => {
            hideAllViews();
            if (viewPerfil) { viewPerfil.classList.remove('hidden'); viewPerfil.classList.add('flex'); }
            if (window.currentUserProfile) {
                document.getElementById('perfil-nombre').value = window.currentUserProfile.nombre || '';
                document.getElementById('perfil-apellido').value = window.currentUserProfile.apellido || '';
                document.getElementById('perfil-telefono').value = window.currentUserProfile.telefono || '';
                document.getElementById('perfil-nombre-header').textContent = `${window.currentUserProfile.nombre} ${window.currentUserProfile.apellido}`;
                document.getElementById('perfil-email-header').textContent = window.currentUserProfile.email;
                if (headerUsernameLabel) headerUsernameLabel.textContent = window.currentUserProfile.nombre || 'Cuenta';
            }
        });
    }

    if (menuItemEmpresa) {
        menuItemEmpresa.addEventListener('click', async () => {
            hideAllViews();
            if (viewEmpresa) { viewEmpresa.classList.remove('hidden'); viewEmpresa.classList.add('flex'); }
            const { data } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
            if (data) {
                document.getElementById('emp-nombre').value = data.nombre_fiscal || '';
                document.getElementById('emp-cif').value = data.cif || '';
                document.getElementById('emp-direccion').value = data.direccion || '';
            }
        });
    }

    // --- GESTIÓN DE TAREAS ---
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

    // --- GESTIÓN DE CLIENTES ---
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

    async function loadClientes() {
        if (!clientesContainer) return;
        clientesContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        const { data, error } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        if (error) {
            clientesContainer.innerHTML = '<p class="text-error text-center">Error al cargar clientes.</p>';
            return;
        }
        allClientes = data || [];
        renderClientes(allClientes);
    }

    function renderClientes(clientesToRender) {
        clientesContainer.innerHTML = '';
        if (clientesCount) clientesCount.textContent = `${clientesToRender.length} registros`;
        if (clientesToRender.length === 0) {
            clientesContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay clientes registrados.</p>';
            return;
        }

        const isAdmin = window.currentUserProfile && (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin');

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

    // Autocompletar al escribir cliente en nueva tarea
    if (inputCliente) {
        inputCliente.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            const encontrado = allClientes.find(c => c.nombre_cliente.toLowerCase() === val);
            if (encontrado) {
                if (inputObra) inputObra.value = encontrado.obra || '';
                if (inputDireccion) inputDireccion.value = encontrado.direccion || '';
                if (inputLocalidad) inputLocalidad.value = encontrado.localidad || '';
            }
        });
    }

    // --- GESTIÓN DE EMPLEADOS ---
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
});
