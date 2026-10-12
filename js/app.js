// js/app.js
import { initClientesModule } from './modules/clientes.js';

document.addEventListener('DOMContentLoaded', () => {
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewClientes = document.getElementById('view-clientes');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    
    const navHome = document.getElementById('nav-home');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewCliente = document.getElementById('fab-new-cliente');
    
    const appHeader = document.getElementById('app-header');
    const bottomNav = document.getElementById('bottom-nav');

    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownMenuPerfil = document.getElementById('dropdown-menu-perfil');
    const menuItemPerfil = document.getElementById('menu-item-perfil');
    const menuItemEmpresa = document.getElementById('menu-item-empresa');
    const headerUsernameLabel = document.getElementById('header-username-label');

    const btnMenuNotificaciones = document.getElementById('btn-menu-notificaciones');
    const dropdownMenuNotificaciones = document.getElementById('dropdown-menu-notificaciones');
    const notificacionesContainer = document.getElementById('notificaciones-container');
    const notifBadge = document.getElementById('notif-badge');
    const btnRequestPush = document.getElementById('btn-request-push');

    const tasksContainer = document.getElementById('tasks-container');
    const empleadosContainer = document.getElementById('empleados-container');
    const empleadosCount = document.getElementById('empleados-count');
    const searchEmpleadosInput = document.getElementById('search-empleados');
    const selectOperario = document.getElementById('select-operario');
    const searchInput = document.getElementById('search-tareas');
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const selectTema = document.getElementById('select-tema');

    const inputFecha = document.getElementById('input-fecha');
    const inputCliente = document.getElementById('input-cliente');
    const inputObra = document.getElementById('input-obra');
    const inputDireccion = document.getElementById('input-direccion');
    const inputLocalidad = document.getElementById('input-localidad');
    const inputTarea = document.getElementById('input-tarea');
    const editTaskId = document.getElementById('edit-task-id');
    const btnCancelTask = document.getElementById('btn-cancel-task');

    // Perfil y Empresa
    const formPerfil = document.getElementById('form-perfil');
    const perfilNombre = document.getElementById('perfil-nombre');
    const perfilApellido = document.getElementById('perfil-apellido');
    const perfilTelefono = document.getElementById('perfil-telefono');
    const perfilPassword = document.getElementById('perfil-password');
    const perfilNombreHeader = document.getElementById('perfil-nombre-header');
    const perfilEmailHeader = document.getElementById('perfil-email-header');
    const perfilMensaje = document.getElementById('perfil-mensaje');

    const formEmpresa = document.getElementById('form-empresa');
    const empNombre = document.getElementById('emp-nombre');
    const empCif = document.getElementById('emp-cif');
    const empDireccion = document.getElementById('emp-direccion');
    const empTelefono = document.getElementById('emp-telefono');
    const empEmail = document.getElementById('emp-email');
    const previewLogo = document.getElementById('preview-logo');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const empresaMensaje = document.getElementById('empresa-mensaje');

    // Modales Empleado
    const modalEditarEmpleado = document.getElementById('modal-editar-empleado');
    const formEditarEmpleado = document.getElementById('form-editar-empleado');
    const editEmpId = document.getElementById('edit-emp-id');
    const editEmpNombre = document.getElementById('edit-emp-nombre');
    const editEmpApellido = document.getElementById('edit-emp-apellido');
    const editEmpTelefono = document.getElementById('edit-emp-telefono');
    const editEmpRol = document.getElementById('edit-emp-rol');
    const editEmpActivo = document.getElementById('edit-emp-activo');
    const btnCloseModalEmp = document.getElementById('btn-close-modal-emp');
    const btnCancelModalEmp = document.getElementById('btn-cancel-modal-emp');

    const modalDetalle = document.getElementById('modal-detalle-tarea');
    const detalleContenido = document.getElementById('detalle-contenido');
    const btnCloseDetalle = document.getElementById('btn-close-detalle');

    let allTasks = [];
    let allEmpleados = [];
    let cacheClientesList = [];

    // Inicializar módulo de clientes y autocompletado
    initClientesModule(supabaseClient, (clientesList) => {
        cacheClientesList = clientesList;
        actualizarDatalistClientes();
    });

    let datalistClientes = document.getElementById('clientes-datalist');
    if (!datalistClientes) {
        datalistClientes = document.createElement('datalist');
        datalistClientes.id = 'clientes-datalist';
        document.body.appendChild(datalistClientes);
        if (inputCliente) inputCliente.setAttribute('list', 'clientes-datalist');
    }

    function actualizarDatalistClientes() {
        if (!datalistClientes) return;
        datalistClientes.innerHTML = '';
        cacheClientesList.forEach(cli => {
            const opt = document.createElement('option');
            opt.value = cli.nombre_cliente;
            opt.textContent = `Obra: ${cli.obra} (${cli.localidad})`;
            datalistClientes.appendChild(opt);
        });
    }

    if (inputCliente) {
        inputCliente.addEventListener('input', (e) => {
            const val = e.target.value.trim().toLowerCase();
            const encontrado = cacheClientesList.find(c => c.nombre_cliente.toLowerCase() === val);
            if (encontrado) {
                if (inputObra) inputObra.value = encontrado.obra || '';
                if (inputDireccion) inputDireccion.value = encontrado.direccion || '';
                if (inputLocalidad) inputLocalidad.value = encontrado.localidad || '';
            }
        });
    }

    // CONTROL GLOBAL DE VISTAS (Navegación robusta)
    window.hideAllViews = function() {
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
    };

    // Eventos de Navegación Inferior (Garantizados para Admin y Operarios)
    if (navHome) {
        navHome.addEventListener('click', () => {
            window.hideAllViews();
            viewTaskList.classList.remove('hidden');
            navHome.classList.add('text-primary');
            if (fabNewTask) {
                fabNewTask.classList.remove('hidden');
                fabNewTask.classList.add('flex');
            }
            loadTasks();
        });
    }

    if (navEmpleados) {
        navEmpleados.addEventListener('click', () => {
            window.hideAllViews();
            if (viewEmpleados) {
                viewEmpleados.classList.remove('hidden');
                viewEmpleados.classList.add('flex');
            }
            navEmpleados.classList.add('text-primary');
            loadEmpleados();
        });
    }

    if (fabNewTask) {
        fabNewTask.addEventListener('click', () => {
            window.hideAllViews();
            document.getElementById('form-task-title').textContent = "Asignar Nueva Tarea";
            const formNewTask = document.getElementById('form-new-task');
            if (formNewTask) formNewTask.reset();
            if (editTaskId) editTaskId.value = "";
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

    window.addEventListener('userLoggedIn', () => {
        if (filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();
        aplicarTema(window.currentUserProfile.tema || 'auto');
        if (selectTema) selectTema.value = window.currentUserProfile.tema || 'auto';
        
        cargarDatosPerfil();
        cargarDatosEmpresa();
        loadTasks();
        loadNotificaciones();
        sincronizarEstadoPushUI();

        const isAdmin = window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin';
        
        // Mostrar siempre el botón de empleados en el menú inferior para Admin
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

    // Menús Header
    if (btnMenuPerfil && dropdownMenuPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownMenuNotificaciones) dropdownMenuNotificaciones.classList.add('hidden');
            dropdownMenuPerfil.classList.toggle('hidden');
        });
    }

    if (btnMenuNotificaciones && dropdownMenuNotificaciones) {
        btnMenuNotificaciones.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdownMenuPerfil) dropdownMenuPerfil.classList.add('hidden');
            dropdownMenuNotificaciones.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', () => {
        if (dropdownMenuPerfil) dropdownMenuPerfil.classList.add('hidden');
        if (dropdownMenuNotificaciones) dropdownMenuNotificaciones.classList.add('hidden');
    });

    if (menuItemPerfil) {
        menuItemPerfil.addEventListener('click', () => {
            window.hideAllViews();
            if (viewPerfil) { viewPerfil.classList.remove('hidden'); viewPerfil.classList.add('flex'); }
            cargarDatosPerfil();
        });
    }

    if (menuItemEmpresa) {
        menuItemEmpresa.addEventListener('click', () => {
            window.hideAllViews();
            if (viewEmpresa) { viewEmpresa.classList.remove('hidden'); viewEmpresa.classList.add('flex'); }
            cargarDatosEmpresa();
        });
    }

    function sincronizarEstadoPushUI() {
        if (!btnRequestPush || !window.currentUserProfile) return;
        if (window.currentUserProfile.notificaciones_activas && Notification.permission === 'granted') {
            btnRequestPush.textContent = "Activadas";
            btnRequestPush.disabled = true;
            btnRequestPush.classList.add('opacity-70');
        } else {
            btnRequestPush.textContent = "Activar Push";
            btnRequestPush.disabled = false;
            btnRequestPush.classList.remove('opacity-70');
        }
    }

    if (btnRequestPush) {
        btnRequestPush.addEventListener('click', async () => {
            if (!('Notification' in window)) {
                alert("Este navegador no soporta notificaciones.");
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                window.currentUserProfile.notificaciones_activas = true;
                await supabaseClient.from('perfiles').update({ notificaciones_activas: true }).eq('id', window.currentUserProfile.id);
                new Notification("Diario de Obra", { body: "¡Notificaciones activadas!" });
                sincronizarEstadoPushUI();
            } else {
                alert("Permiso denegado.");
            }
        });
    }

    async function loadNotificaciones() {
        if (!notificacionesContainer || !window.currentUserProfile) return;
        const userId = window.currentUserProfile.id;
        const { data, error } = await supabaseClient.from('notificaciones').select('*').or(`user_id.eq.${userId},user_id.is.null`).order('created_at', { ascending: false }).limit(10);
        if (error || !data) return;

        notificacionesContainer.innerHTML = '';
        const unreadCount = data.filter(n => !n.leida).length;
        if (unreadCount > 0 && notifBadge) notifBadge.classList.remove('hidden');
        else if (notifBadge) notifBadge.classList.add('hidden');

        if (data.length === 0) {
            notificacionesContainer.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-4">No hay notificaciones</p>';
            return;
        }

        data.forEach(notif => {
            const item = document.createElement('div');
            item.className = `p-3 text-xs flex flex-col gap-1 cursor-pointer hover:bg-surface-variant transition-colors ${notif.leida ? 'opacity-70' : 'bg-primary-container/20 font-medium'}`;
            item.innerHTML = `<span class="font-medium text-primary">${notif.titulo}</span><p class="text-on-surface">${notif.mensaje}</p>`;
            item.addEventListener('click', async () => {
                if (!notif.leida) {
                    await supabaseClient.from('notificaciones').update({ leida: true }).eq('id', notif.id);
                    loadNotificaciones();
                }
            });
            notificacionesContainer.appendChild(item);
        });
    }

    function aplicarTema(modo) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        if (modo === 'oscuro') root.classList.add('dark');
        else if (modo === 'claro') root.classList.remove('dark');
        else {
            if (prefersDark.matches) root.classList.add('dark');
            else root.classList.remove('dark');
        }
    }

    if (selectTema) {
        selectTema.addEventListener('change', async () => {
            const nuevoTema = selectTema.value;
            aplicarTema(nuevoTema);
            window.currentUserProfile.tema = nuevoTema;
            await supabaseClient.from('perfiles').update({ tema: nuevoTema }).eq('id', window.currentUserProfile.id);
        });
    }

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }

    function cargarDatosPerfil() {
        if (!window.currentUserProfile) return;
        const p = window.currentUserProfile;
        perfilNombre.value = p.nombre || '';
        perfilApellido.value = p.apellido || '';
        perfilTelefono.value = p.telefono || '';
        perfilNombreHeader.textContent = `${p.nombre} ${p.apellido}`;
        perfilEmailHeader.textContent = p.email;
        if (headerUsernameLabel) headerUsernameLabel.textContent = p.nombre || 'Cuenta';
    }

    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            perfilMensaje.classList.add('hidden');
            const btn = formPerfil.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = "Guardando...";

            const nuevoNombre = perfilNombre.value.trim();
            const nuevoApellido = perfilApellido.value.trim();
            const nuevoTelefono = perfilTelefono.value.trim();
            const nuevaPassword = perfilPassword.value;

            await supabaseClient.from('perfiles').update({ nombre: nuevoNombre, apellido: nuevoApellido, telefono: nuevoTelefono }).eq('id', window.currentUserProfile.id);
            window.currentUserProfile.nombre = nuevoNombre;
            window.currentUserProfile.apellido = nuevoApellido;
            window.currentUserProfile.telefono = nuevoTelefono;
            cargarDatosPerfil();

            if (nuevaPassword) {
                await supabaseClient.auth.updateUser({ password: nuevaPassword });
                perfilPassword.value = '';
            }

            perfilMensaje.textContent = "¡Cambios guardados con éxito!";
            perfilMensaje.className = "text-green-600 text-sm text-center font-medium";
            perfilMensaje.classList.remove('hidden');
            btn.disabled = false; btn.textContent = "Guardar Cambios";
        });
    }

    async function cargarDatosEmpresa() {
        const { data } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
        if (data) {
            empNombre.value = data.nombre_fiscal || '';
            empCif.value = data.cif || '';
            empDireccion.value = data.direccion || '';
            empTelefono.value = data.telefono || '';
            empEmail.value = data.email || '';
            if (data.logo_url) {
                previewLogo.src = data.logo_url;
                previewLogo.classList.remove('hidden');
                logoPlaceholder.classList.add('hidden');
            }
        }
    }

    if (formEmpresa) {
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            empresaMensaje.classList.add('hidden');
            const btn = formEmpresa.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = "Guardando...";

            const empresaData = {
                nombre_fiscal: empNombre.value.trim(),
                cif: empCif.value.trim(),
                direccion: empDireccion.value.trim(),
                telefono: empTelefono.value.trim(),
                email: empEmail.value.trim()
            };

            const { data: existing } = await supabaseClient.from('configuracion_empresa').select('id').limit(1).single();
            if (existing) {
                await supabaseClient.from('configuracion_empresa').update(empresaData).eq('id', existing.id);
            } else {
                await supabaseClient.from('configuracion_empresa').insert([empresaData]);
            }

            empresaMensaje.textContent = "¡Datos de empresa actualizados!";
            empresaMensaje.className = "text-green-600 text-sm text-center font-medium";
            empresaMensaje.classList.remove('hidden');
            btn.disabled = false; btn.textContent = "Guardar Datos de Empresa";
        });
    }

    // Empleados
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
        const isAdmin = window.currentUserProfile && (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin');

        if (empleadosToRender.length === 0) {
            empleadosContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No se encontraron empleados.</p>';
            return;
        }

        empleadosToRender.forEach(emp => {
            const card = document.createElement('div');
            card.className = `p-4 rounded-2xl shadow-sm flex flex-col gap-3 ${emp.activo ? 'bg-surface-container-low' : 'card-pendiente'}`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-base text-on-surface">${emp.nombre || ''} ${emp.apellido || ''} ${!emp.activo ? '<span class="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold ml-2">Pendiente</span>' : ''}</h3>
                        <p class="text-xs opacity-80">@${emp.username || 'sin_usuario'}</p>
                    </div>
                    ${isAdmin ? `<span class="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">${emp.rol}</span>` : ''}
                </div>
                <div class="flex flex-wrap gap-2 items-center text-sm pt-1">
                    <a href="tel:${emp.telefono || ''}" class="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-xl border border-outline-variant text-primary font-medium">
                        <span class="material-symbols-outlined text-[16px]">call</span> ${emp.telefono || 'Sin teléfono'}
                    </a>
                </div>
                ${isAdmin ? `
                    <div class="flex gap-2 mt-2 pt-2 border-t border-outline-variant justify-end items-center">
                        <button onclick="window.abrirModalEditarEmpleado('${emp.id}')" class="text-xs bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">edit</span> Editar / Rol
                        </button>
                    </div>
                ` : ''}
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
                (emp.telefono && emp.telefono.toLowerCase().includes(q)) || 
                (emp.username && emp.username.toLowerCase().includes(q))
            );
            renderEmpleados(filtradas);
        });
    }

    window.abrirModalEditarEmpleado = function(id) {
        const emp = allEmpleados.find(e => e.id === id);
        if (!emp || !modalEditarEmpleado) return;
        editEmpId.value = emp.id;
        editEmpNombre.value = emp.nombre || '';
        editEmpApellido.value = emp.apellido || '';
        editEmpTelefono.value = emp.telefono || '';
        if (editEmpRol) editEmpRol.value = emp.rol || 'Operario';
        if (editEmpActivo) editEmpActivo.checked = !!emp.activo;
        modalEditarEmpleado.classList.remove('hidden');
    };

    if (btnCloseModalEmp) btnCloseModalEmp.addEventListener('click', () => modalEditarEmpleado.classList.add('hidden'));
    if (btnCancelModalEmp) btnCancelModalEmp.addEventListener('click', () => modalEditarEmpleado.classList.add('hidden'));

    if (formEditarEmpleado) {
        formEditarEmpleado.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = editEmpId.value;
            await supabaseClient.from('perfiles').update({
                nombre: editEmpNombre.value.trim(),
                apellido: editEmpApellido.value.trim(),
                telefono: editEmpTelefono.value.trim(),
                rol: editEmpRol.value,
                activo: editEmpActivo.checked
            }).eq('id', id);
            modalEditarEmpleado.classList.add('hidden');
            loadEmpleados();
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

    // Tareas (Diario)
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
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas programadas para esta fecha.</p>';
            return;
        }

        const isAdmin = window.currentUserProfile && (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin');

        tasksToRender.forEach(tarea => {
            const isCompleted = tarea.completada;
            const cardBg = isCompleted ? 'bg-surface-variant opacity-70' : 'bg-surface-container-low';
            const isMyTask = window.currentUserProfile && (tarea.operario_username === window.currentUserProfile.username);
            const mapsQuery = encodeURIComponent(`${tarea.direccion}, ${tarea.localidad}`);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2 transition-all`;
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

    const formNewTask = document.getElementById('form-new-task');
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
});
