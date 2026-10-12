// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa'); // Nueva vista
    
    const navHome = document.getElementById('nav-home');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    
    // Desplegable de Perfil en Header
    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownMenuPerfil = document.getElementById('dropdown-menu-perfil');
    const menuItemPerfil = document.getElementById('menu-item-perfil');
    const menuItemEmpresa = document.getElementById('menu-item-empresa'); // Nuevo botón menú
    const headerUsernameLabel = document.getElementById('header-username-label');

    const tasksContainer = document.getElementById('tasks-container');
    const empleadosContainer = document.getElementById('empleados-container');
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
    const btnDictar = document.getElementById('btn-dictar');

    // Referencias Perfil
    const formPerfil = document.getElementById('form-perfil');
    const perfilNombre = document.getElementById('perfil-nombre');
    const perfilApellido = document.getElementById('perfil-apellido');
    const perfilTelefono = document.getElementById('perfil-telefono');
    const perfilPassword = document.getElementById('perfil-password');
    const perfilNombreHeader = document.getElementById('perfil-nombre-header');
    const perfilEmailHeader = document.getElementById('perfil-email-header');
    const perfilMensaje = document.getElementById('perfil-mensaje');

    // Referencias Empresa
    const formEmpresa = document.getElementById('form-empresa');
    const empNombre = document.getElementById('emp-nombre');
    const empCif = document.getElementById('emp-cif');
    const empDireccion = document.getElementById('emp-direccion');
    const empTelefono = document.getElementById('emp-telefono');
    const empEmail = document.getElementById('emp-email');
    const inputLogoFile = document.getElementById('input-logo-file');
    const previewLogo = document.getElementById('preview-logo');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const empresaMensaje = document.getElementById('empresa-mensaje');
    let logoBlobToUpload = null;

    const modalDetalle = document.getElementById('modal-detalle-tarea');
    const detalleContenido = document.getElementById('detalle-contenido');
    const btnCloseDetalle = document.getElementById('btn-close-detalle');

    const modalCanvas = document.getElementById('modal-canvas');
    const btnOpenCanvas = document.getElementById('btn-open-canvas');
    const btnCloseCanvas = document.getElementById('btn-close-canvas');
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const btnClearCanvas = document.getElementById('btn-clear-canvas');
    const btnSaveCanvas = document.getElementById('btn-save-canvas');
    const colorPickers = document.querySelectorAll('.color-picker');
    const attachedDrawingContainer = document.getElementById('attached-drawing-container');
    const previewDrawing = document.getElementById('preview-drawing');
    const btnRemoveDrawing = document.getElementById('btn-remove-drawing');

    let allTasks = [];
    let drawingBlob = null;

    window.addEventListener('userLoggedIn', () => {
        if (filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();
        aplicarTema(window.currentUserProfile.tema || 'auto');
        if (selectTema) selectTema.value = window.currentUserProfile.tema || 'auto';
        
        cargarDatosPerfil();
        cargarDatosEmpresa();
        loadTasks();

        const isAdmin = window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin';
        if (isAdmin) {
            loadEmpleados();
            loadOperariosSelect();
            if (menuItemEmpresa) menuItemEmpresa.classList.remove('hidden');
            menuItemEmpresa.classList.add('flex');
        }
    });

    // === MENÚ DESPLEGABLE DE PERFIL ===
    if (btnMenuPerfil && dropdownMenuPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenuPerfil.classList.toggle('hidden');
        });
        document.addEventListener('click', () => dropdownMenuPerfil.classList.add('hidden'));
    }

    if (menuItemPerfil) {
        menuItemPerfil.addEventListener('click', () => {
            hideAllViews();
            if (viewPerfil) { viewPerfil.classList.remove('hidden'); viewPerfil.classList.add('flex'); }
            dropdownMenuPerfil.classList.add('hidden');
            cargarDatosPerfil();
        });
    }

    if (menuItemEmpresa) {
        menuItemEmpresa.addEventListener('click', () => {
            hideAllViews();
            if (viewEmpresa) { viewEmpresa.classList.remove('hidden'); viewEmpresa.classList.add('flex'); }
            dropdownMenuPerfil.classList.add('hidden');
            cargarDatosEmpresa();
        });
    }

    // === GESTIÓN DEL TEMA ===
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

    // === NAVEGACIÓN ===
    function hideAllViews() {
        viewTaskList.classList.add('hidden');
        viewNewTask.classList.add('hidden');
        viewNewTask.classList.remove('flex');
        if (viewEmpleados) { viewEmpleados.classList.add('hidden'); viewEmpleados.classList.remove('flex'); }
        if (viewPerfil) { viewPerfil.classList.add('hidden'); viewPerfil.classList.remove('flex'); }
        if (viewEmpresa) { viewEmpresa.classList.add('hidden'); viewEmpresa.classList.remove('flex'); }
        
        navHome.classList.remove('text-primary');
        if (navEmpleados) navEmpleados.classList.remove('text-primary');
    }

    navHome.addEventListener('click', () => {
        hideAllViews();
        viewTaskList.classList.remove('hidden');
        navHome.classList.add('text-primary');
        loadTasks();
    });

    if (navEmpleados) {
        navEmpleados.addEventListener('click', () => {
            hideAllViews();
            viewEmpleados.classList.remove('hidden');
            viewEmpleados.classList.add('flex');
            navEmpleados.classList.add('text-primary');
            loadEmpleados();
        });
    }

    fabNewTask.addEventListener('click', () => {
        hideAllViews();
        document.getElementById('form-task-title').textContent = "Asignar Nueva Tarea";
        document.getElementById('form-new-task').reset();
        editTaskId.value = "";
        if (inputFecha) inputFecha.value = getTodayLocalString();
        viewNewTask.classList.remove('hidden');
        viewNewTask.classList.add('flex');
    });

    if (btnCancelTask) btnCancelTask.addEventListener('click', () => navHome.click());

    // === GESTIÓN DE PERFIL PERSONAL ===
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

            const { error: perfilError } = await supabaseClient
                .from('perfiles')
                .update({ nombre: nuevoNombre, apellido: nuevoApellido, telefono: nuevoTelefono })
                .eq('id', window.currentUserProfile.id);

            if (perfilError) {
                perfilMensaje.textContent = "Error al actualizar perfil: " + perfilError.message;
                perfilMensaje.className = "text-error text-sm text-center font-medium";
                perfilMensaje.classList.remove('hidden');
                btn.disabled = false; btn.textContent = "Guardar Cambios";
                return;
            }

            window.currentUserProfile.nombre = nuevoNombre;
            window.currentUserProfile.apellido = nuevoApellido;
            window.currentUserProfile.telefono = nuevoTelefono;
            cargarDatosPerfil();

            if (nuevaPassword) {
                const { error: passError } = await supabaseClient.auth.updateUser({ password: nuevaPassword });
                if (passError) {
                    perfilMensaje.textContent = "Error al cambiar contraseña: " + passError.message;
                    perfilMensaje.className = "text-error text-sm text-center font-medium";
                    perfilMensaje.classList.remove('hidden');
                    btn.disabled = false; btn.textContent = "Guardar Cambios";
                    return;
                }
                perfilPassword.value = '';
            }

            perfilMensaje.textContent = "¡Cambios guardados con éxito!";
            perfilMensaje.className = "text-green-600 text-sm text-center font-medium";
            perfilMensaje.classList.remove('hidden');
            btn.disabled = false; btn.textContent = "Guardar Cambios";
        });
    }

    // === GESTIÓN DE EMPRESA Y LOGOTIPO ===
    async function cargarDatosEmpresa() {
        const { data, error } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
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

    if (inputLogoFile) {
        inputLogoFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                logoBlobToUpload = file;
                previewLogo.src = URL.createObjectURL(file);
                previewLogo.classList.remove('hidden');
                logoPlaceholder.classList.add('hidden');
            }
        });
    }

    if (formEmpresa) {
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            empresaMensaje.classList.add('hidden');
            const btn = formEmpresa.querySelector('button[type="submit"]');
            btn.disabled = true; btn.textContent = "Guardando...";

            let logoUrl = previewLogo.src;

            // Si seleccionó un nuevo logo, subirlo a Supabase Storage (bucket 'empresa')
            if (logoBlobToUpload) {
                const fileName = `logo_${Date.now()}.jpg`;
                const { error: uploadError } = await supabaseClient.storage.from('empresa').upload(fileName, logoBlobToUpload);
                if (uploadError) {
                    alert("Error al subir el logotipo: " + uploadError.message);
                    btn.disabled = false; btn.textContent = "Guardar Datos de Empresa";
                    return;
                }
                const { data: { publicUrl } } = supabaseClient.storage.from('empresa').getPublicUrl(fileName);
                logoUrl = publicUrl;
            }

            const empresaData = {
                nombre_fiscal: empNombre.value.trim(),
                cif: empCif.value.trim(),
                direccion: empDireccion.value.trim(),
                telefono: empTelefono.value.trim(),
                email: empEmail.value.trim(),
                logo_url: logoUrl
            };

            // Comprobar si ya existe registro en configuracion_empresa
            const { data: existing } = await supabaseClient.from('configuracion_empresa').select('id').limit(1).single();

            let error;
            if (existing) {
                const res = await supabaseClient.from('configuracion_empresa').update(empresaData).eq('id', existing.id);
                error = res.error;
            } else {
                const res = await supabaseClient.from('configuracion_empresa').insert([empresaData]);
                error = res.error;
            }

            if (error) {
                empresaMensaje.textContent = "Error al guardar empresa: " + error.message;
                empresaMensaje.className = "text-error text-sm text-center font-medium";
            } else {
                empresaMensaje.textContent = "¡Datos de empresa actualizados con éxito!";
                empresaMensaje.className = "text-green-600 text-sm text-center font-medium";
                logoBlobToUpload = null;
            }
            empresaMensaje.classList.remove('hidden');
            btn.disabled = false; btn.textContent = "Guardar Datos de Empresa";
        });
    }

    // === AUTOCOMPLETADO DE OBRA ===
    if (inputObra) {
        inputObra.addEventListener('input', () => {
            const obraBuscada = inputObra.value.trim().toLowerCase();
            if (!obraBuscada) return;
            const tareaExistente = allTasks.find(t => t.obra && t.obra.trim().toLowerCase() === obraBuscada);
            if (tareaExistente) {
                if (inputCliente && !inputCliente.value) inputCliente.value = tareaExistente.cliente || '';
                if (inputDireccion && !inputDireccion.value) inputDireccion.value = tareaExistente.direccion || '';
                if (inputLocalidad && !inputLocalidad.value) inputLocalidad.value = tareaExistente.localidad || '';
            }
        });
    }

    // === DICTADO POR VOZ ===
    if (btnDictar && inputTarea) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = false;

            btnDictar.addEventListener('click', () => {
                try { recognition.start(); btnDictar.classList.add('bg-red-100', 'text-red-600', 'animate-pulse'); } 
                catch (e) { console.log("Activo"); }
            });

            recognition.onresult = (event) => {
                inputTarea.value += (inputTarea.value ? ' ' : '') + event.results[0][0].transcript;
            };

            recognition.onend = () => { btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse'); };
            recognition.onerror = (event) => {
                btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse');
                if (event.error === 'network') alert("Error de red en dictado por voz.");
            };
        } else {
            btnDictar.addEventListener('click', () => alert("Navegador no soporta dictado por voz."));
        }
    }

    // === 1. TAREAS Y BUSCADOR ===
    if (filtroFechaDiario) filtroFechaDiario.addEventListener('change', loadTasks);

    async function loadTasks() {
        if (!tasksContainer || !filtroFechaDiario) return;
        tasksContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        
        const selectedDate = filtroFechaDiario.value;
        const { data, error } = await supabaseClient
            .from('tareas')
            .select('*')
            .eq('fecha', selectedDate)
            .order('completada', { ascending: true });

        if (error) {
            tasksContainer.innerHTML = '<p class="text-error text-center mt-4">Error al cargar tareas.</p>';
            return;
        }
        allTasks = data;
        renderTasks(allTasks);
    }

    function renderTasks(tasksToRender) {
        tasksContainer.innerHTML = '';
        if (tasksToRender.length === 0) {
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas para esta fecha.</p>';
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
                <h3 class="font-medium text-base truncate ${isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}">${tarea.tarea}</h3>
                
                <div class="text-xs text-on-surface-variant flex justify-between items-center mt-1">
                    <span>👷 @${tarea.operario_username}</span>
                    <a href="${mapsUrl}" target="_blank" class="flex items-center gap-1 text-primary font-medium hover:underline bg-surface px-2 py-1 rounded-md border border-outline-variant">
                        <span class="material-symbols-outlined text-[14px]">map</span> ${tarea.localidad}
                    </a>
                </div>
                
                <div class="flex gap-2 mt-3 pt-2 border-t border-outline-variant items-center justify-between">
                    <button onclick="verDetalles('${tarea.id}')" class="text-xs bg-surface text-primary px-3 py-1.5 rounded-lg border border-primary font-medium flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">visibility</span> Ver
                    </button>
                    
                    <div class="flex gap-2">
                        ${(!isCompleted && isMyTask) ? `
                            <button onclick="marcarCompletada('${tarea.id}')" class="text-xs bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-lg font-medium">Realizada</button>
                        ` : ''}

                        ${isAdmin ? `
                            <button onclick="editarTarea('${tarea.id}')" class="text-xs bg-surface-variant text-on-surface px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">edit</span> Editar
                            </button>
                            <button onclick="eliminarTarea('${tarea.id}')" class="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                        ` : ''}
                    </div>
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
                (t.fecha && t.fecha.toLowerCase().includes(q)) ||
                (t.cliente && t.cliente.toLowerCase().includes(q)) ||
                (t.obra && t.obra.toLowerCase().includes(q)) ||
                (t.direccion && t.direccion.toLowerCase().includes(q)) ||
                (t.localidad && t.localidad.toLowerCase().includes(q)) ||
                (t.tarea && t.tarea.toLowerCase().includes(q))
            );
            renderTasks(filtradas);
        });
    }

    // === 2. VER DETALLES ===
    window.verDetalles = function(id) {
        const tarea = allTasks.find(t => t.id === id);
        if (!tarea) return;

        const mapsQuery = encodeURIComponent(`${tarea.direccion}, ${tarea.localidad}`);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

        detalleContenido.innerHTML = `
            <div><span class="text-xs text-on-surface-variant">Cliente / Obra:</span><p class="font-medium text-lg">${tarea.cliente} - ${tarea.obra}</p></div>
            <div><span class="text-xs text-on-surface-variant">Fecha programada:</span><p class="font-medium">${tarea.fecha}</p></div>
            <div>
                <span class="text-xs text-on-surface-variant">Dirección:</span>
                <p class="font-medium flex items-center justify-between">
                    <span>${tarea.direccion}, ${tarea.localidad}</span>
                    <a href="${mapsUrl}" target="_blank" class="bg-primary text-on-primary text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-sm hover:opacity-90">
                        <span class="material-symbols-outlined text-[14px]">map</span> Google Maps
                    </a>
                </p>
            </div>
            <div><span class="text-xs text-on-surface-variant">Operario Asignado:</span><p class="font-medium">@${tarea.operario_username}</p></div>
            <div><span class="text-xs text-on-surface-variant">Descripción de la Tarea:</span><p class="bg-surface-container p-3 rounded-xl mt-1">${tarea.tarea}</p></div>
            ${tarea.imagen_url ? `<div><span class="text-xs text-on-surface-variant">Pizarra Adjunta:</span><img src="${tarea.imagen_url}" class="mt-2 rounded-xl border border-outline-variant w-full"></div>` : ''}
        `;
        modalDetalle.classList.remove('hidden');
    };

    if (btnCloseDetalle) btnCloseDetalle.addEventListener('click', () => modalDetalle.classList.add('hidden'));

    // === 3. EDITAR Y ELIMINAR ===
    window.editarTarea = function(id) {
        const tarea = allTasks.find(t => t.id === id);
        if (!tarea) return;

        hideAllViews();
        document.getElementById('form-task-title').textContent = "Editar Tarea";
        editTaskId.value = tarea.id;
        inputFecha.value = tarea.fecha;
        inputCliente.value = tarea.cliente;
        inputObra.value = tarea.obra;
        inputDireccion.value = tarea.direccion;
        inputLocalidad.value = tarea.localidad;
        selectOperario.value = tarea.operario_username;
        inputTarea.value = tarea.tarea;

        viewNewTask.classList.remove('hidden');
        viewNewTask.classList.add('flex');
    };

    window.eliminarTarea = async function(id) {
        if (confirm("¿Estás seguro de eliminar esta tarea?")) {
            const { error } = await supabaseClient.from('tareas').delete().eq('id', id);
            if (!error) loadTasks();
            else alert("Error al eliminar: " + error.message);
        }
    };

    window.marcarCompletada = async function(id) {
        const { error } = await supabaseClient.from('tareas').update({ completada: true }).eq('id', id);
        if (!error) loadTasks();
    };

    // === 4. EMPLEADOS ===
    async function loadEmpleados() {
        if (!empleadosContainer) return;
        empleadosContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        const { data, error } = await supabaseClient.from('perfiles').select('*').order('activo', { ascending: true });
        if (error) return;
        
        empleadosContainer.innerHTML = '';
        data.forEach(emp => {
            const card = document.createElement('div');
            card.className = `p-4 rounded-xl shadow-sm flex flex-col gap-2 ${emp.activo ? 'bg-surface-container' : 'bg-red-50 border border-red-200'}`;
            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-medium text-on-surface">${emp.nombre} ${emp.apellido}</h3>
                        <p class="text-xs text-on-surface-variant">@${emp.username} | ${emp.email}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full ${emp.rol === 'SuperAdmin' ? 'bg-purple-200 text-purple-900' : 'bg-blue-100 text-blue-800'}">${emp.rol}</span>
                </div>
                ${!emp.activo ? `<button onclick="activarEmpleado('${emp.id}')" class="mt-2 bg-primary text-on-primary py-2 rounded-lg text-sm font-medium">Aprobar Acceso</button>` : ''}
            `;
            empleadosContainer.appendChild(card);
        });
    }

    window.activarEmpleado = async function(id) {
        if (confirm("¿Aprobar a este operario?")) {
            const { error } = await supabaseClient.from('perfiles').update({ activo: true }).eq('id', id);
            if (!error) { loadEmpleados(); loadOperariosSelect(); }
        }
    };

    async function loadOperariosSelect() {
        if (!selectOperario) return;
        const { data, error } = await supabaseClient.from('perfiles').select('username').eq('activo', true);
        if (error) return;
        selectOperario.innerHTML = '<option value="" disabled selected>Selecciona un operario...</option>';
        data.forEach(op => selectOperario.innerHTML += `<option value="${op.username}">@${op.username}</option>`);
    }

    // === 5. PIZARRA ===
    let isDrawing = false, currentColor = '#000000';
    function resizeCanvas() {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (btnOpenCanvas) btnOpenCanvas.addEventListener('click', () => { modalCanvas.classList.remove('hidden'); setTimeout(resizeCanvas, 50); });
    if (btnCloseCanvas) btnCloseCanvas.addEventListener('click', () => modalCanvas.classList.add('hidden'));
    if (colorPickers) {
        colorPickers.forEach(btn => btn.addEventListener('click', (e) => {
            currentColor = e.target.dataset.color;
            colorPickers.forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-primary'));
            e.target.classList.add('ring-2', 'ring-offset-2', 'ring-primary');
        }));
    }
    function startDrawing(e) { isDrawing = true; draw(e); }
    function stopDrawing() { isDrawing = false; if (ctx) ctx.beginPath(); }
    function draw(e) {
        if (!isDrawing || !ctx) return;
        e.preventDefault();
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left; const y = clientY - rect.top;
        ctx.strokeStyle = currentColor; ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y);
    }
    if (canvas) {
        canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
    }
    if (btnClearCanvas) btnClearCanvas.addEventListener('click', resizeCanvas);
    if (btnSaveCanvas) {
        btnSaveCanvas.addEventListener('click', () => {
            if (!canvas) return;
            canvas.toBlob((blob) => {
                drawingBlob = blob;
                previewDrawing.src = URL.createObjectURL(blob);
                attachedDrawingContainer.classList.remove('hidden');
                modalCanvas.classList.add('hidden');
            }, 'image/jpeg', 0.8);
        });
    }
    if (btnRemoveDrawing) {
        btnRemoveDrawing.addEventListener('click', () => {
            drawingBlob = null; previewDrawing.src = '';
            attachedDrawingContainer.classList.add('hidden');
        });
    }

    // === 6. GUARDAR O ACTUALIZAR TAREA ===
    const formNewTask = document.getElementById('form-new-task');
    if (formNewTask) {
        formNewTask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-task');
            btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

            let imagenUrl = null;
            if (drawingBlob) {
                const fileName = `pizarra_${Date.now()}.jpg`;
                const { error: uploadError } = await supabaseClient.storage.from('pizarras').upload(fileName, drawingBlob);
                if (uploadError) { alert("Error al subir el dibujo."); btnSubmit.disabled = false; btnSubmit.textContent = "Guardar"; return; }
                const { data: { publicUrl } } = await supabaseClient.storage.from('pizarras').getPublicUrl(fileName);
                imagenUrl = publicUrl;
            }

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
            if (imagenUrl) tareaData.imagen_url = imagenUrl;

            const taskId = editTaskId.value;
            let error;

            if (taskId) {
                const res = await supabaseClient.from('tareas').update(tareaData).eq('id', taskId);
                error = res.error;
            } else {
                const res = await supabaseClient.from('tareas').insert([tareaData]);
                error = res.error;
            }

            if (error) {
                alert("Error: " + error.message);
            } else {
                formNewTask.reset();
                if (btnRemoveDrawing) btnRemoveDrawing.click();
                if (filtroFechaDiario) filtroFechaDiario.value = inputFecha.value;
                navHome.click();
            }
            btnSubmit.disabled = false; btnSubmit.textContent = "Guardar";
        });
    }
});
