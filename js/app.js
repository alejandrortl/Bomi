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
    
    // Contenedores
    const tasksContainer = document.getElementById('tasks-container');
    const empleadosContainer = document.getElementById('empleados-container');
    const selectOperario = document.getElementById('select-operario');

    let allTasks = [];

    window.addEventListener('userLoggedIn', () => {
        loadTasks();
        if (window.currentUserProfile.rol === 'Admin' || window.currentUserProfile.rol === 'SuperAdmin') {
            loadEmpleados();
            loadOperariosSelect();
        }
    });

    // === NAVEGACIÓN ===
    function hideAllViews() {
        viewTaskList.classList.add('hidden');
        viewNewTask.classList.add('hidden');
        viewEmpleados.classList.add('hidden');
        navHome.classList.remove('text-primary');
        navEmpleados.classList.remove('text-primary');
    }

    navHome.addEventListener('click', () => {
        hideAllViews();
        viewTaskList.classList.remove('hidden');
        navHome.classList.add('text-primary');
        loadTasks();
    });

    if(navEmpleados) {
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
    });

    // === 1. TAREAS ===
    async function loadTasks() {
        tasksContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary">sync</span></div>';
        
        const { data, error } = await supabase
            .from('tareas')
            .select('*')
            .order('completada', { ascending: true })
            .order('fecha', { ascending: false });

        if (error) return console.error(error);
        allTasks = data;
        renderTasks(allTasks);
    }

    function renderTasks(tasksToRender) {
        tasksContainer.innerHTML = '';
        if (tasksToRender.length === 0) {
            tasksContainer.innerHTML = '<p class="text-on-surface-variant text-center mt-4">No hay tareas.</p>';
            return;
        }

        tasksToRender.forEach(tarea => {
            const isCompleted = tarea.completada;
            const cardBg = isCompleted ? 'bg-surface-variant opacity-70' : 'bg-surface-container-low';
            
            // Validar si el usuario actual es el operario (usando username)
            const isMyTask = tarea.operario_username === window.currentUserProfile.username;

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-primary bg-primary-container px-2 py-1 rounded-md">${tarea.cliente} - ${tarea.obra}</span>
                    ${isCompleted ? '<span class="material-symbols-outlined text-green-600">check_circle</span>' : ''}
                </div>
                <h3 class="font-medium text-lg ${isCompleted ? 'line-through text-on-surface-variant' : 'text-on-surface'}">${tarea.tarea}</h3>
                <div class="text-sm text-on-surface-variant flex flex-col gap-1 mt-1">
                    <span>📍 ${tarea.direccion}, ${tarea.localidad}</span>
                    <span>👷 Operario: <b>${tarea.operario_username}</b></span>
                </div>
                ${tarea.imagen_url ? `<img src="${tarea.imagen_url}" class="mt-2 rounded-xl w-full" alt="Pizarra">` : ''}
                
                ${(!isCompleted && isMyTask) ? `
                    <button onclick="marcarCompletada('${tarea.id}')" class="mt-3 bg-secondary-container py-2 rounded-xl font-medium w-full">✅ Marcar Realizada</button>
                ` : ''}
            `;
            tasksContainer.appendChild(card);
        });
    }

    window.marcarCompletada = async function(id) {
        await supabase.from('tareas').update({ completada: true }).eq('id', id);
        loadTasks();
    };

    document.getElementById('search-tareas').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtradas = allTasks.filter(t => 
            t.operario_username.toLowerCase().includes(query) || 
            t.tarea.toLowerCase().includes(query) ||
            t.obra.toLowerCase().includes(query)
        );
        renderTasks(filtradas);
    });

    // === 2. EMPLEADOS (Gestión Admin) ===
    async function loadEmpleados() {
        empleadosContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-primary">sync</span></div>';
        
        const { data, error } = await supabase.from('perfiles').select('*').order('activo', { ascending: true });
        if (error) return console.error(error);
        
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
                ${!emp.activo ? `
                    <button onclick="activarEmpleado('${emp.id}')" class="mt-2 bg-primary text-on-primary py-2 rounded-lg text-sm font-medium">Aprobar Acceso</button>
                ` : ''}
            `;
            empleadosContainer.appendChild(card);
        });
    }

    window.activarEmpleado = async function(id) {
        if(confirm("¿Aprobar a este operario para que pueda usar la app?")) {
            await supabase.from('perfiles').update({ activo: true }).eq('id', id);
            loadEmpleados();
            loadOperariosSelect();
        }
    };

    // Cargar select de operarios en nueva tarea
    async function loadOperariosSelect() {
        const { data, error } = await supabase.from('perfiles').select('username').eq('activo', true);
        if (error) return;
        
        selectOperario.innerHTML = '<option value="" disabled selected>Selecciona un operario...</option>';
        data.forEach(op => {
            selectOperario.innerHTML += `<option value="${op.username}">${op.username}</option>`;
        });
    }

    // === 3. GUARDAR TAREA ===
    document.getElementById('form-new-task').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;

        // Insertar tarea usando select-operario
        const nuevaTarea = {
            cliente: document.getElementById('input-cliente').value,
            obra: document.getElementById('input-obra').value,
            direccion: document.getElementById('input-direccion').value,
            localidad: document.getElementById('input-localidad').value,
            operario_username: document.getElementById('select-operario').value,
            tarea: document.getElementById('input-tarea').value,
            user_id: window.currentUserProfile.id
            // (La lógica de imagen es igual a la del archivo anterior, recórtala de allí si usas pizarra)
        };

        const { error } = await supabase.from('tareas').insert([nuevaTarea]);
        if (!error) {
            e.target.reset();
            navHome.click();
        }
        btnSubmit.disabled = false;
    });
});
