// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    // Vistas principales
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const viewEmpleados = document.getElementById('view-empleados');
    
    // Navegación
    const navHome = document.getElementById('nav-home');
    const navEmpleados = document.getElementById('nav-empleados');
    const fabNewTask = document.getElementById('fab-new-task');
    
    // Contenedores y Buscador
    const tasksContainer = document.getElementById('tasks-container');
    const empleadosContainer = document.getElementById('empleados-container');
    const selectOperario = document.getElementById('select-operario');
    const searchInput = document.getElementById('search-tareas');

    // Referencias Nueva Tarea (Fecha y Voz)
    const inputFecha = document.getElementById('input-fecha');
    const inputTarea = document.getElementById('input-tarea');
    const btnDictar = document.getElementById('btn-dictar');

    // Referencias Pizarra (Canvas)
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

    // Escuchar cuando el usuario inicie sesión
    window.addEventListener('userLoggedIn', () => {
        loadTasks();
        if (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin') {
            loadEmpleados();
            loadOperariosSelect();
        }
    });

    // Función auxiliar para obtener la fecha local de hoy en formato YYYY-MM-DD
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
        viewNewTask.classList.remove('hidden');
        viewNewTask.classList.add('flex');
        // Al abrir el formulario, poner la fecha de hoy por defecto
        if (inputFecha) inputFecha.value = getTodayLocalString();
    });

    // === DICTADO POR VOZ (Web Speech API) ===
    if (btnDictar && inputTarea) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES'; // Español
            recognition.continuous = false; // Se detiene al hacer pausa
            recognition.interimResults = false;

            btnDictar.addEventListener('click', () => {
                recognition.start();
                // Animación visual MD3 para indicar que está escuchando
                btnDictar.classList.add('bg-red-100', 'text-red-600', 'animate-pulse');
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                // Añade al final dejando un espacio si ya hay texto
                inputTarea.value += (inputTarea.value ? ' ' : '') + transcript;
            };

            recognition.onend = () => {
                btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse');
            };

            recognition.onerror = (event) => {
                console.error("Error en dictado: ", event.error);
                btnDictar.classList.remove('bg-red-100', 'text-red-600', 'animate-pulse');
            };
        } else {
            // Si el navegador (como algunos Safari antiguos) no lo soporta, ocultamos el botón
            btnDictar.style.display = 'none';
        }
    }

    // === 1. TAREAS ===
    async function loadTasks() {
        tasksContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary text-3xl">sync</span></div>';
        
        const today = getTodayLocalString();

        // Cargar SOLO las tareas programadas para HOY
        const { data, error } = await supabaseClient
            .from('tareas')
            .select('*')
            .eq('fecha', today)
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
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas programadas para hoy.</p>';
            return;
        }

        tasksToRender.forEach(tarea => {
            const isCompleted = tarea.completada;
            const cardBg = isCompleted ? 'bg-surface-variant opacity-70' : 'bg-surface-container-low';
            const isMyTask = window.currentUserProfile && (tarea.operario_username === window.currentUserProfile.username);

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2 transition-all`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-primary bg-primary-container px-2 py-1 rounded-md">${tarea.cliente} - ${tarea.obra}</span>
                    ${isCompleted ? '<span class="material-symbols-outlined text-green-600">check_circle</span>' : ''}
                </div>
                <h3 class="font-medium text-lg ${isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}">${tarea.tarea}</h3>
                <div class="text-sm text-on-surface-variant flex flex-col gap-1 mt-1">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">location_on</span> ${tarea.direccion}, ${tarea.localidad}</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">person</span> Operario: <b>@${tarea.operario_username}</b></span>
                </div>
                ${tarea.imagen_url ? `<img src="${tarea.imagen_url}" class="mt-2 rounded-xl border border-outline-variant max-w-full h-auto" alt="Pizarra adjunta">` : ''}
                
                ${(!isCompleted && isMyTask) ? `
                    <button onclick="marcarCompletada('${tarea.id}')" class="mt-3 bg-secondary-container text-on-secondary-container py-2 rounded-xl font-medium w-full flex items-center justify-center gap-2 hover:bg-primary-container transition-colors">
                        <span class="material-symbols-outlined">done</span> Marcar Realizada
                    </button>
                ` : ''}
            `;
            tasksContainer.appendChild(card);
        });
    }

    window.marcarCompletada = async function(id) {
        const { error } = await supabaseClient.from('tareas').update({ completada: true }).eq('id', id);
        if (!error) loadTasks();
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtradas = allTasks.filter(t => 
                (t.operario_username && t.operario_username.toLowerCase().includes(query)) || 
                (t.tarea && t.tarea.toLowerCase().includes(query)) ||
                (t.obra && t.obra.toLowerCase().includes(query))
            );
            renderTasks(filtradas);
        });
    }

    // === 2. EMPLEADOS ===
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
                ${!emp.activo ? `<button onclick="activarEmpleado('${emp.id}')" class="mt-2 bg-primary text-on-primary py-2 rounded-lg text-sm font-medium hover:shadow-md transition-all">Aprobar Acceso</button>` : ''}
            `;
            empleadosContainer.appendChild(card);
        });
    }

    window.activarEmpleado = async function(id) {
        if (confirm("¿Aprobar a este operario para que pueda usar la app?")) {
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

    // === 3. PIZARRA ===
    let isDrawing = false, currentColor = '#000000';

    function resizeCanvas() {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
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

    // === 4. GUARDAR TAREA ===
    const formNewTask = document.getElementById('form-new-task');
    if (formNewTask) {
        formNewTask.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = e.target.querySelector('button[type="submit"]');
            btnSubmit.disabled = true; btnSubmit.textContent = "Guardando...";

            let imagenUrl = null;
            if (drawingBlob) {
                const fileName = `pizarra_${Date.now()}.jpg`;
                const { error: uploadError } = await supabaseClient.storage.from('pizarras').upload(fileName, drawingBlob);
                if (uploadError) { alert("Error al subir el dibujo."); btnSubmit.disabled = false; btnSubmit.textContent = "Guardar Tarea"; return; }
                const { data: { publicUrl } } = supabaseClient.storage.from('pizarras').getPublicUrl(fileName);
                imagenUrl = publicUrl;
            }

            const nuevaTarea = {
                fecha: document.getElementById('input-fecha').value, // Guardamos la fecha seleccionada
                cliente: document.getElementById('input-cliente').value,
                obra: document.getElementById('input-obra').value,
                direccion: document.getElementById('input-direccion').value,
                localidad: document.getElementById('input-localidad').value,
                operario_username: document.getElementById('select-operario').value,
                tarea: document.getElementById('input-tarea').value,
                imagen_url: imagenUrl,
                user_id: window.currentUserProfile.id
            };

            const { error } = await supabaseClient.from('tareas').insert([nuevaTarea]);
            if (error) alert("Error: " + error.message);
            else { e.target.reset(); if (btnRemoveDrawing) btnRemoveDrawing.click(); navHome.click(); }
            btnSubmit.disabled = false; btnSubmit.textContent = "Guardar Tarea";
        });
    }
});
