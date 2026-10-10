// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const tasksContainer = document.getElementById('tasks-container');
    const searchInput = document.getElementById('search-operario');
    const viewTaskList = document.getElementById('view-task-list');
    const viewNewTask = document.getElementById('view-new-task');
    const fabNewTask = document.getElementById('fab-new-task');
    const navHome = document.getElementById('nav-home');
    
    // Referencias Pizarra
    const modalCanvas = document.getElementById('modal-canvas');
    const btnOpenCanvas = document.getElementById('btn-open-canvas');
    const btnCloseCanvas = document.getElementById('btn-close-canvas');
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const btnClearCanvas = document.getElementById('btn-clear-canvas');
    const btnSaveCanvas = document.getElementById('btn-save-canvas');
    const colorPickers = document.querySelectorAll('.color-picker');
    const attachedDrawingContainer = document.getElementById('attached-drawing-container');
    const previewDrawing = document.getElementById('preview-drawing');
    const btnRemoveDrawing = document.getElementById('btn-remove-drawing');
    
    let allTasks = [];
    let drawingBlob = null; // Guardará el dibujo temporalmente
    
    // === 1. CARGA Y RENDERIZADO DE TAREAS ===
    
    window.addEventListener('userLoggedIn', loadTasks);

    async function loadTasks() {
        tasksContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-3xl text-primary">sync</span></div>';
        
        // Obtenemos tareas ordenadas: completadas al final (false primero, true después), y luego por fecha
        const { data, error } = await supabase
            .from('tareas')
            .select('*')
            .order('completada', { ascending: true })
            .order('fecha', { ascending: false });

        if (error) {
            console.error("Error cargando tareas:", error);
            tasksContainer.innerHTML = '<p class="text-error text-center">Error al cargar tareas</p>';
            return;
        }

        allTasks = data;
        renderTasks(allTasks);
    }

    function renderTasks(tasksToRender) {
        tasksContainer.innerHTML = '';
        if (tasksToRender.length === 0) {
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas para mostrar.</p>';
            return;
        }

        tasksToRender.forEach(tarea => {
            const isCompleted = tarea.completada;
            // Estilos dinámicos MD3 dependiendo de si está completada
            const cardBg = isCompleted ? 'bg-surface-variant opacity-70' : 'bg-surface-container-low';
            const textStyle = isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface';
            
            // Lógica de validación: ¿El usuario actual es el operario asignado?
            // (Compara el nombre del operario con parte del email del usuario logueado)
            const userEmail = window.currentUser.email.split('@')[0].toLowerCase();
            const operarioName = tarea.operario.toLowerCase();
            const isMyTask = operarioName.includes(userEmail) || userEmail.includes(operarioName);

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2 transition-all`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-sm font-medium text-primary bg-primary-container px-2 py-1 rounded-md">${tarea.cliente} - ${tarea.obra}</span>
                    ${isCompleted ? '<span class="material-symbols-outlined text-green-600">check_circle</span>' : ''}
                </div>
                <h3 class="font-medium ${textStyle} text-lg">${tarea.tarea}</h3>
                <div class="text-sm text-on-surface-variant flex flex-col gap-1 mt-1">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">location_on</span> ${tarea.direccion}, ${tarea.localidad}</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">person</span> Operario: <b>${tarea.operario}</b></span>
                </div>
                ${tarea.imagen_url ? `<img src="${tarea.imagen_url}" class="mt-2 rounded-xl border border-outline-variant max-w-full h-auto" alt="Esquema adjunto">` : ''}
                
                ${(!isCompleted && isMyTask) ? `
                    <button onclick="marcarCompletada('${tarea.id}')" class="mt-3 bg-secondary-container text-on-secondary-container py-2 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-container transition-colors">
                        <span class="material-symbols-outlined">done</span> Marcar como realizada
                    </button>
                ` : ''}
            `;
            tasksContainer.appendChild(card);
        });
    }

    // Hacer la función global para que el botón onclick pueda llamarla
    window.marcarCompletada = async function(id) {
        const { error } = await supabase
            .from('tareas')
            .update({ completada: true })
            .eq('id', id);
            
        if (!error) loadTasks(); // Recargar para moverla al fondo automáticamente
    };

    // Buscador
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtradas = allTasks.filter(t => 
            t.operario.toLowerCase().includes(query) || 
            t.tarea.toLowerCase().includes(query) ||
            t.obra.toLowerCase().includes(query)
        );
        renderTasks(filtradas);
    });

    // === 2. NAVEGACIÓN Y VISTAS ===
    
    fabNewTask.addEventListener('click', () => {
        viewTaskList.classList.add('hidden');
        viewNewTask.classList.remove('hidden');
        viewNewTask.classList.add('flex');
    });

    navHome.addEventListener('click', () => {
        viewNewTask.classList.add('hidden');
        viewNewTask.classList.remove('flex');
        viewTaskList.classList.remove('hidden');
        loadTasks();
    });

    // === 3. LÓGICA DE LA PIZARRA (CANVAS) ===
    
    let isDrawing = false;
    let currentColor = '#000000';

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        // Fondo blanco por defecto
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    btnOpenCanvas.addEventListener('click', () => {
        modalCanvas.classList.remove('hidden');
        setTimeout(resizeCanvas, 50); // Dar tiempo a que el modal se renderice
    });

    btnCloseCanvas.addEventListener('click', () => modalCanvas.classList.add('hidden'));

    // Cambiar color
    colorPickers.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentColor = e.target.dataset.color;
            // Efecto visual de selección
            colorPickers.forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-primary'));
            e.target.classList.add('ring-2', 'ring-offset-2', 'ring-primary');
        });
    });

    // Dibujar (Mouse y Táctil)
    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }
    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }
    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault(); // Evitar scroll en móviles mientras se dibuja
        
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.strokeStyle = currentColor;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    btnClearCanvas.addEventListener('click', resizeCanvas);

    // Guardar dibujo temporalmente
    btnSaveCanvas.addEventListener('click', () => {
        canvas.toBlob((blob) => {
            drawingBlob = blob;
            previewDrawing.src = URL.createObjectURL(blob);
            attachedDrawingContainer.classList.remove('hidden');
            modalCanvas.classList.add('hidden');
        }, 'image/jpeg', 0.8);
    });

    btnRemoveDrawing.addEventListener('click', () => {
        drawingBlob = null;
        previewDrawing.src = '';
        attachedDrawingContainer.classList.add('hidden');
    });

    // === 4. GUARDAR NUEVA TAREA ===
    
    document.getElementById('form-new-task').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";

        let imagenUrl = null;

        // 1. Subir imagen a Storage si existe
        if (drawingBlob) {
            const fileName = `pizarra_${Date.now()}.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('pizarras')
                .upload(fileName, drawingBlob);

            if (uploadError) {
                alert("Error al subir el dibujo: " + uploadError.message);
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Guardar Tarea";
                return;
            }

            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage.from('pizarras').getPublicUrl(fileName);
            imagenUrl = publicUrl;
        }

        // 2. Insertar en base de datos
        const nuevaTarea = {
            cliente: document.getElementById('input-cliente').value,
            obra: document.getElementById('input-obra').value,
            direccion: document.getElementById('input-direccion').value,
            localidad: document.getElementById('input-localidad').value,
            operario: document.getElementById('input-operario').value,
            tarea: document.getElementById('input-tarea').value,
            imagen_url: imagenUrl,
            user_id: window.currentUser.id
        };

        const { error } = await supabase.from('tareas').insert([nuevaTarea]);

        if (error) {
            alert("Error al guardar: " + error.message);
        } else {
            // Limpiar formulario y volver al inicio
            e.target.reset();
            btnRemoveDrawing.click();
            navHome.click();
        }

        btnSubmit.disabled = false;
        btnSubmit.textContent = "Guardar Tarea";
    });
});
