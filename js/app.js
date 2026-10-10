// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const viewEmpleados = document.getElementById('view-empleados');
    
    const navHome = document.getElementById('nav-home');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    
    const tasksContainer = document.getElementById('tasks-container');
    const empleadosContainer = document.getElementById('empleados-container');
    const selectOperario = document.getElementById('select-operario');
    const searchInput = document.getElementById('search-tareas');
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');

    const inputFecha = document.getElementById('input-fecha');
    const inputCliente = document.getElementById('input-cliente');
    const inputObra = document.getElementById('input-obra');
    const inputDireccion = document.getElementById('input-direccion');
    const inputLocalidad = document.getElementById('input-localidad');
    const inputTarea = document.getElementById('input-tarea');
    const editTaskId = document.getElementById('edit-task-id');
    const btnCancelTask = document.getElementById('btn-cancel-task');
    const btnDictar = document.getElementById('btn-dictar');

    // Modales
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
        loadTasks();
        if (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin') {
            loadEmpleados();
            loadOperariosSelect();
        }
    });

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }

    // === NAVEGACIÓN ===
    function hideAllViews() {
        viewTaskList.classList.add('hidden');
        viewNewTask.classList.add('hidden');
        viewNewTask.classList.remove('flex');
        if (viewEmpleados) {
            viewEmpleados.classList.add('hidden');
            viewEmpleados.classList.remove('flex');
        }
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

    if (btnCancelTask) {
        btnCancelTask.addEventListener('click', () => {
            navHome.click();
        });
    }

    // === DICTADO POR VOZ (Con manejo de error de red) ===
    if (btnDictar && inputTarea) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = false;

            btnDictar.addEventListener('click', () => {
                try {
                    recognition.start();
                    btnDictar.classList.add('bg-red-100', 'text-red-600', 'animate-pulse');
                } catch (e) {
                    console.log("Reconocimiento ya activo.");
                }
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                inputTarea.value += (inputTarea.value ? ' ' : '') + transcript;
            };

            recognition.onend = () => {
                btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse');
            };

            recognition.onerror = (event) => {
                btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse');
                if (event.error === 'network') {
                    alert("Error de red: El dictado por voz requiere conexión estable a internet y permisos de los servicios de voz del navegador.");
                } else if (event.error === 'not-allowed') {
                    alert("Permiso de micrófono denegado.");
                } else {
                    alert("Error en dictado: " + event.error);
                }
            };
        } else {
            btnDictar.addEventListener('click', () => {
                alert("Tu navegador no soporta el dictado por voz nativo.");
            });
        }
    }

    // === 1. TAREAS Y BUSCADOR MULTICRITERIO ===
    if (filtroFechaDiario) {
        filtroFechaDiario.addEventListener('change', loadTasks);
    }

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

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2 transition-all`;
            
            // Vista resumida
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-primary bg-primary-container px-2 py-1 rounded-md">${tarea.cliente} - ${tarea.obra}</span>
                    ${isCompleted ? '<span class="material-symbols-outlined text-green-600">check_circle</span>' : ''}
                </div>
                <h3 class="font-medium text-base truncate ${isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}">${tarea.tarea}</h3>
                <div class="text-xs text-on-surface-variant flex justify-between mt-1">
                    <span>👷 @${tarea.operario_username}</span>
                    <span>📍 ${tarea.localidad}</span>
                </div>
                
                <!-- Botones de Acción (Ver, Editar, Eliminar, Marcar realizada) -->
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

    // Buscador Multicriterio (operario, fecha, cliente, obra, direccion, localidad)
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

    // === 2. VER DETALLES Y GOOGLE MAPS ===
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

    // === 3. EDITAR Y ELIMINAR TAREA (Solo Admin) ===
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
                // Actualizar tarea existente
                const res = await supabaseClient.from('tareas').update(tareaData).eq('id', taskId);
                error = res.error;
            } else {
                // Crear nueva tarea
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
