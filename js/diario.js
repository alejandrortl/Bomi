// js/diario.js

let currentUser = null;
let currentRol = null;
let allDiarios = []; // Almacena todos los registros para la búsqueda en tiempo real

async function initDiario() {
    // 1. Obtener usuario actual y su rol desde Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Obtenemos el registro de la tabla usuarios usando el email o auth.id
    const { data: userData } = await supabase
        .from('usuarios')
        .select('id, rol')
        .eq('email', session.user.email)
        .single();
        
    currentUser = userData.id;
    currentRol = userData.rol;

    // Mostrar botón de añadir solo a Admin/SuperAdmin
    if (currentRol === 'Admin' || currentRol === 'SuperAdmin') {
        document.getElementById('btn-add-diario').classList.remove('hidden');
    }

    setupEventListeners();
    await loadDiarios();
}

async function loadDiarios() {
    const listContainer = document.getElementById('diario-list');
    listContainer.innerHTML = '<p class="text-center mt-4">Cargando...</p>';

    // Consulta uniendo tablas (Join)
    const { data, error } = await supabase
        .from('diario')
        .select(`
            id, tarea, finalizado, operario_id,
            usuarios (nombre, apellido),
            clientes (nombre),
            obras (nombre, direccion, localidad)
        `)
        .order('creado_en', { ascending: false });

    if (error) {
        listContainer.innerHTML = `<p class="text-red-500 text-center">Error al cargar: ${error.message}</p>`;
        return;
    }

    allDiarios = data;
    renderDiarios(allDiarios, false); // false = no estamos buscando, aplicar filtro de operario
}

function renderDiarios(datos, isSearching) {
    const listContainer = document.getElementById('diario-list');
    listContainer.innerHTML = '';

    let filtrados = datos;

    // Si es operario Y NO está buscando, solo mostrar sus tareas
    if (currentRol === 'Operario' && !isSearching) {
        filtrados = datos.filter(d => d.operario_id === currentUser);
    }

    if (filtrados.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 mt-4">No hay registros.</p>';
        return;
    }

    filtrados.forEach(item => {
        const canCheck = (item.operario_id === currentUser); // Solo el operario asignado puede hacer check
        
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-3";
        card.innerHTML = `
            <div class="pt-1">
                <input type="checkbox" ${item.finalizado ? 'checked' : ''} ${!canCheck ? 'disabled' : ''} 
                    onchange="toggleDiarioStatus('${item.id}', this.checked)"
                    class="w-6 h-6 text-md-primary rounded border-gray-300 focus:ring-md-primary ${!canCheck ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
            </div>
            <div class="flex-1 cursor-pointer" onclick='openViewModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
                <h4 class="font-bold text-gray-900 dark:text-white ${item.finalizado ? 'line-through text-gray-400' : ''}">${item.clientes?.nombre} - ${item.obras?.nombre}</h4>
                <p class="text-xs text-gray-500 mb-1"><span class="material-symbols-outlined text-[12px] align-middle">location_on</span> ${item.obras?.localidad}</p>
                <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">${item.tarea}</p>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// Funciones de estado y búsqueda
async function toggleDiarioStatus(id, isChecked) {
    await supabase.from('diario').update({ finalizado: isChecked }).eq('id', id);
    // Actualizar variable local para no recargar todo de la base de datos
    const idx = allDiarios.findIndex(d => d.id === id);
    if(idx > -1) allDiarios[idx].finalizado = isChecked;
    renderDiarios(allDiarios, document.getElementById('diario-search').value.trim() !== '');
}

// Configuración de eventos UI
function setupEventListeners() {
    // Buscador
    const searchInput = document.getElementById('diario-search');
    searchInput.addEventListener('input', (e) => {
        const txt = e.target.value.toLowerCase();
        if (txt === '') {
            renderDiarios(allDiarios, false);
            return;
        }
        
        const results = allDiarios.filter(d => 
            (d.clientes?.nombre || '').toLowerCase().includes(txt) ||
            (d.obras?.nombre || '').toLowerCase().includes(txt) ||
            (d.obras?.localidad || '').toLowerCase().includes(txt) ||
            (d.obras?.direccion || '').toLowerCase().includes(txt) ||
            (d.tarea || '').toLowerCase().includes(txt)
        );
        renderDiarios(results, true);
    });

    // Abrir modal de crear (cargar datos en selects)
    document.getElementById('btn-add-diario').addEventListener('click', async () => {
        document.getElementById('modal-diario-form').classList.remove('hidden');
        document.getElementById('diario-form-content').classList.remove('translate-y-full');
        
        // Cargar Operarios
        const { data: ops } = await supabase.from('usuarios').select('id, nombre, apellido').in('rol', ['Operario', 'Admin', 'SuperAdmin']);
        const sOp = document.getElementById('select-operario');
        sOp.innerHTML = '<option value="">Selecciona...</option>' + ops.map(o => `<option value="${o.id}">${o.nombre} ${o.apellido}</option>`).join('');
        
        // Cargar Clientes
        const { data: cls } = await supabase.from('clientes').select('id, nombre');
        const sCl = document.getElementById('select-cliente');
        sCl.innerHTML = '<option value="">Selecciona cliente...</option>' + cls.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('') + '<option value="NEW">+ Crear nuevo cliente</option>';
    });

    // Desplegables inline
    document.getElementById('select-cliente').addEventListener('change', async (e) => {
        const val = e.target.value;
        const sObra = document.getElementById('select-obra');
        const newClientDiv = document.getElementById('new-cliente-fields');
        
        if (val === 'NEW') {
            newClientDiv.classList.remove('hidden');
            document.getElementById('new-cliente-nombre').required = true;
            sObra.disabled = false;
            sObra.innerHTML = '<option value="NEW">+ Crear nueva obra</option>';
            sObra.value = 'NEW';
            sObra.dispatchEvent(new Event('change')); // Forzar despliegue de obra nueva
        } else {
            newClientDiv.classList.add('hidden');
            document.getElementById('new-cliente-nombre').required = false;
            if(val !== "") {
                sObra.disabled = false;
                const { data: obs } = await supabase.from('obras').select('id, nombre').eq('cliente_id', val);
                sObra.innerHTML = '<option value="">Selecciona obra...</option>' + obs.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('') + '<option value="NEW">+ Crear nueva obra</option>';
            } else {
                sObra.disabled = true;
            }
        }
    });

    document.getElementById('select-obra').addEventListener('change', (e) => {
        const val = e.target.value;
        const newObraDiv = document.getElementById('new-obra-fields');
        if (val === 'NEW') {
            newObraDiv.classList.remove('hidden');
            ['nombre', 'direccion', 'localidad'].forEach(f => document.getElementById(`new-obra-${f}`).required = true);
        } else {
            newObraDiv.classList.add('hidden');
            ['nombre', 'direccion', 'localidad'].forEach(f => document.getElementById(`new-obra-${f}`).required = false);
        }
    });

    // Cerrar modales
    document.getElementById('btn-close-form').addEventListener('click', () => {
        document.getElementById('modal-diario-form').classList.add('hidden');
        document.getElementById('form-diario').reset();
    });
    document.getElementById('btn-close-view').addEventListener('click', () => {
        document.getElementById('modal-diario-view').classList.add('hidden');
    });

    // Formulario de guardado
    document.getElementById('form-diario').addEventListener('submit', handleSaveDiario);

    // Dictado por voz
    initSpeechRecognition();
}

async function handleSaveDiario(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = 'Guardando...';
    submitBtn.disabled = true;

    try {
        let clienteId = document.getElementById('select-cliente').value;
        let obraId = document.getElementById('select-obra').value;

        // Si es cliente nuevo
        if (clienteId === 'NEW') {
            const { data: newC, error: errC } = await supabase.from('clientes')
                .insert([{ nombre: document.getElementById('new-cliente-nombre').value }]).select().single();
            if(errC) throw errC;
            clienteId = newC.id;
        }

        // Si es obra nueva
        if (obraId === 'NEW') {
            const { data: newO, error: errO } = await supabase.from('obras')
                .insert([{ 
                    cliente_id: clienteId, 
                    nombre: document.getElementById('new-obra-nombre').value,
                    direccion: document.getElementById('new-obra-direccion').value,
                    localidad: document.getElementById('new-obra-localidad').value
                }]).select().single();
            if(errO) throw errO;
            obraId = newO.id;
        }

        // Insertar Diario
        const { error: errD } = await supabase.from('diario').insert([{
            cliente_id: clienteId,
            obra_id: obraId,
            operario_id: document.getElementById('select-operario').value,
            tarea: document.getElementById('input-tarea').value,
            creador_id: currentUser
        }]);
        if(errD) throw errD;

        // Limpiar y recargar
        document.getElementById('form-diario').reset();
        document.getElementById('modal-diario-form').classList.add('hidden');
        await loadDiarios();

    } catch (error) {
        alert("Error al guardar: " + error.message);
    } finally {
        submitBtn.innerHTML = 'Guardar Registro';
        submitBtn.disabled = false;
    }
}

// Ver Detalles y Mapas
function openViewModal(item) {
    document.getElementById('view-obra-nombre').textContent = item.obras?.nombre;
    document.getElementById('view-cliente').textContent = item.clientes?.nombre;
    document.getElementById('view-operario').textContent = `${item.usuarios?.nombre} ${item.usuarios?.apellido}`;
    document.getElementById('view-direccion').textContent = item.obras?.direccion;
    document.getElementById('view-localidad').textContent = item.obras?.localidad;
    document.getElementById('view-tarea').textContent = item.tarea;

    const btnMap = document.getElementById('btn-view-map');
    btnMap.onclick = () => {
        const query = encodeURIComponent(`${item.obras?.direccion}, ${item.obras?.localidad}`);
        window.open(`https://maps.google.com/?q=${query}`, '_blank');
    };

    document.getElementById('modal-diario-view').classList.remove('hidden');
}

// Web Speech API
function initSpeechRecognition() {
    const btnDictar = document.getElementById('btn-dictar');
    const inputTarea = document.getElementById('input-tarea');
    
    // Comprobar soporte del navegador
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btnDictar.classList.add('hidden'); // Ocultar si no es compatible
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;

    btnDictar.addEventListener('click', () => {
        if (btnDictar.classList.contains('text-red-500')) {
            recognition.stop();
            return;
        }
        
        recognition.start();
        btnDictar.innerHTML = '<span class="material-symbols-outlined text-sm animate-pulse">mic</span> Escuchando...';
        btnDictar.classList.replace('text-md-primary', 'text-red-500');
    });

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        inputTarea.value = inputTarea.value ? inputTarea.value + ' ' + text : text;
    };

    recognition.onend = () => {
        btnDictar.innerHTML = '<span class="material-symbols-outlined text-sm">mic</span> Dictar';
        btnDictar.classList.replace('text-red-500', 'text-md-primary');
    };
}