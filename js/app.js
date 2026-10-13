// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewFormTarea = document.getElementById('view-form-tarea');
    const viewDetalleTarea = document.getElementById('view-detalle-tarea');
    const viewPartes = document.getElementById('view-partes');
    const viewBitacora = document.getElementById('view-bitacora');
    const viewMateriales = document.getElementById('view-materiales');
    const viewClientes = document.getElementById('view-clientes');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    
    const navHome = document.getElementById('nav-home');
    const navPartes = document.getElementById('nav-partes');
    const navBitacora = document.getElementById('nav-bitacora');
    const navMateriales = document.getElementById('nav-materiales');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewParte = document.getElementById('fab-new-parte');
    
    const headerUsernameLabel = document.getElementById('header-username-label');
    const headerAppTitle = document.getElementById('header-app-title');
    const selectTema = document.getElementById('select-tema');

    let allTareas = [];
    let allClientesCompletos = [];
    let allOperarios = [];
    let allEmpleadosData = [];
    let currentTareaItem = null;
    
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const searchTareasInput = document.getElementById('search-tareas');
    const searchEmpleadosInput = document.getElementById('search-empleados');

    // TEMA
    function aplicarTema(tema) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (tema === 'oscuro' || (tema === 'auto' && prefersDark)) root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', tema);
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
    if(filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();

    function hideAllViews() {
        [viewTaskList, viewFormTarea, viewDetalleTarea, viewPartes, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
            if (v) { v.classList.add('hidden'); v.classList.remove('flex'); }
        });
        [navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-blue-600', 'dark:text-blue-400');
                nav.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        });
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewParte) fabNewParte.classList.add('hidden');
    }

    function setActiveNav(navBtn) {
        if (!navBtn) return;
        navBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        navBtn.classList.add('text-blue-600', 'dark:text-blue-400');
    }

    // NAVEGACIÓN
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); renderTareas(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); loadEmpleados(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); setActiveNav(navClientes); if (window.BomiClientes) window.BomiClientes.abrir(); });

    async function cargarNombreEmpresa() {
        if (!headerAppTitle) return;
        const { data } = await supabaseClient.from('configuracion_empresa').select('nombre_fiscal').limit(1).single();
        if (data && data.nombre_fiscal) headerAppTitle.textContent = data.nombre_fiscal;
    }

    function actualizarNombreHeader() {
        if (window.currentUserProfile && headerUsernameLabel) {
            headerUsernameLabel.textContent = ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() || window.currentUserProfile.email || 'Cuenta';
        }
    }

    function initAppAfterLogin() {
        actualizarNombreHeader();
        cargarNombreEmpresa();
        loadClientes();
        loadOperariosList();
        loadTasksFromDB();

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';
        if (navEmpleados) {
            if (isAdmin) { navEmpleados.classList.remove('hidden'); navEmpleados.classList.add('flex'); }
            else { navEmpleados.classList.add('hidden'); navEmpleados.classList.remove('flex'); }
        }
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    // Clientes u obras cambiados desde la pestaña Clientes: refresca el autocompletado de tareas.
    window.addEventListener('clientesActualizados', () => loadClientes());
    if (window.currentUserProfile) initAppAfterLogin();

    async function loadClientes() {
        const { data: clientesData } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        allClientesCompletos = [];
        const dlClientes = document.getElementById('clientes-datalist');
        const dlObras = document.getElementById('obras-datalist');
        if(dlClientes) dlClientes.innerHTML = '';
        if(dlObras) dlObras.innerHTML = '';

        for (const cli of (clientesData || [])) {
            const { data: obrasCli } = await supabaseClient.from('obras').select('*').eq('cliente_id', cli.id);
            allClientesCompletos.push({ ...cli, obras: obrasCli || [] });
            if(dlClientes) dlClientes.insertAdjacentHTML('beforeend', `<option value="${cli.nombre_cliente}"></option>`);
            (obrasCli || []).forEach(o => {
                if(dlObras) dlObras.insertAdjacentHTML('beforeend', `<option value="${o.nombre}"></option>`);
            });
        }
    }

    async function loadOperariosList() {
        const { data } = await supabaseClient.from('empleados').select('nombre, apellido, username');
        allOperarios = data || [];
        const dl = document.getElementById('operarios-datalist');
        if (dl) {
            dl.innerHTML = '';
            allOperarios.forEach(op => {
                dl.insertAdjacentHTML('beforeend', `<option value="${(op.nombre || '') + ' ' + (op.apellido || '')}"></option>`);
            });
        }
    }

    // --- MÓDULO EMPLEADOS ---
    async function loadEmpleados() {
        const c = document.getElementById('empleados-container');
        const countBadge = document.getElementById('empleados-count');
        if (!c) return;
        c.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';

        const { data, error } = await supabaseClient.from('empleados').select('*').order('nombre', { ascending: true });
        if (error) {
            c.innerHTML = `<p class="text-red-500 text-center">Error al cargar empleados: ${error.message}</p>`;
            return;
        }
        allEmpleadosData = data || [];
        renderEmpleados(allEmpleadosData);
    }

    if (searchEmpleadosInput) {
        searchEmpleadosInput.addEventListener('input', (e) => {
            const txt = e.target.value.toLowerCase().trim();
            const filtrados = allEmpleadosData.filter(emp => `${emp.nombre || ''} ${emp.apellido || ''} ${emp.email || ''} ${emp.rol || ''} ${emp.telefono || ''}`.toLowerCase().includes(txt));
            renderEmpleados(filtrados);
        });
    }

    function renderEmpleados(lista) {
        const c = document.getElementById('empleados-container');
        const countBadge = document.getElementById('empleados-count');
        if(!c) return;
        c.innerHTML = '';
        if(countBadge) countBadge.textContent = lista.length + ' empleados';

        if (lista.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-6">No hay empleados registrados.</p>';
            return;
        }

        const userRol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdminOrSuper = userRol === 'admin' || userRol === 'superadmin';

        lista.forEach(emp => {
            const rol = (emp.rol || 'empleado').toLowerCase();
            const isSuper = rol === 'superadmin';
            const activo = emp.activo !== false; // por defecto activo

            const card = document.createElement('div');
            card.className = "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex flex-col gap-3";
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-base">${emp.nombre || ''} ${emp.apellido || ''}</h3>
                        <p class="text-xs text-slate-500">${emp.email || 'Sin correo'}</p>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-full font-medium ${isSuper ? 'bg-purple-100 text-purple-800' : rol === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300'}">${rol.toUpperCase()}</span>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-sm">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px] text-slate-400">call</span>
                        <a href="tel:${emp.telefono || ''}" class="text-blue-600 dark:text-blue-400 font-medium hover:underline">${emp.telefono || 'Sin teléfono'}</a>
                    </div>
                    ${isAdminOrSuper ? `
                        <div class="flex gap-2">
                            ${!activo ? `<button onclick="window.aceptarEmpleado('${emp.id}')" class="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-medium">Aceptar</button>` : ''}
                            <button onclick="window.abrirModalEmpleado('${emp.id}')" class="text-xs bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg font-medium">Modificar</button>
                            ${!isSuper ? `<button onclick="window.eliminarEmpleado('${emp.id}')" class="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg font-medium">Eliminar</button>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
            c.appendChild(card);
        });
    }

    window.aceptarEmpleado = async function(id) {
        await supabaseClient.from('empleados').update({ activo: true }).eq('id', id);
        loadEmpleados();
    };

    window.abrirModalEmpleado = function(id) {
        const emp = allEmpleadosData.find(e => e.id === id);
        if(!emp) return;
        document.getElementById('edit-empleado-id').value = emp.id;
        document.getElementById('emp-nombre-modal').value = emp.nombre || '';
        document.getElementById('emp-apellido-modal').value = emp.apellido || '';
        document.getElementById('emp-telefono-modal').value = emp.telefono || '';
        document.getElementById('emp-rol-modal').value = (emp.rol || 'empleado').toLowerCase();
        document.getElementById('modal-empleado').classList.remove('hidden');
    };

    document.getElementById('btn-cancel-modal-empleado').addEventListener('click', () => {
        document.getElementById('modal-empleado').classList.add('hidden');
    });

    document.getElementById('form-empleado').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-empleado-id').value;
        const nombre = document.getElementById('emp-nombre-modal').value.trim();
        const apellido = document.getElementById('emp-apellido-modal').value.trim();
        const telefono = document.getElementById('emp-telefono-modal').value.trim();
        const rol = document.getElementById('emp-rol-modal').value;

        const { error } = await supabaseClient.from('empleados').update({ nombre, apellido, telefono, rol }).eq('id', id);
        if (error) { alert("Error al modificar empleado: " + error.message); }
        else {
            document.getElementById('modal-empleado').classList.add('hidden');
            loadEmpleados();
            loadOperariosList();
        }
    });

    window.eliminarEmpleado = async function(id) {
        const emp = allEmpleadosData.find(e => e.id === id);
        if (emp && (emp.rol || '').toLowerCase() === 'superadmin') {
            alert("No se puede eliminar a un Superadmin.");
            return;
        }
        if (confirm("¿Estás seguro de eliminar este empleado?")) {
            const { error } = await supabaseClient.from('empleados').delete().eq('id', id);
            if (error) alert("Error al eliminar: " + error.message);
            else loadEmpleados();
        }
    };

    // --- TAREAS (AUTOCOMPLETAR OBRA, PIZARRA, ETC) ---
    const inputTareaObra = document.getElementById('tarea-obra');
    if (inputTareaObra) {
        inputTareaObra.addEventListener('change', () => {
            const obraVal = inputTareaObra.value.trim().toLowerCase();
            for (const cli of allClientesCompletos) {
                const obraEncontrada = cli.obras.find(o => o.nombre.toLowerCase() === obraVal);
                if (obraEncontrada) {
                    document.getElementById('tarea-direccion').value = obraEncontrada.direccion || '';
                    document.getElementById('tarea-localidad').value = obraEncontrada.localidad || '';
                    document.getElementById('tarea-cliente').value = cli.nombre_cliente;
                    break;
                }
            }
        });
    }

    // WEB SPEECH API
    const btnDictarVoz = document.getElementById('btn-dictar-voz');
    const tareaNotas = document.getElementById('tarea-notas');
    if (btnDictarVoz) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            btnDictarVoz.addEventListener('click', (e) => {
                e.preventDefault();
                btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-pulse">mic</span> Escuchando...';
                recognition.start();
            });
            recognition.onresult = (event) => {
                tareaNotas.value = (tareaNotas.value + ' ' + event.results[0][0].transcript).trim();
                resetMic();
            };
            recognition.onerror = resetMic;
            recognition.onend = resetMic;
            function resetMic() { btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px]">mic</span> Dictar'; }
        } else { btnDictarVoz.style.display = 'none'; }
    }

    // PIZARRA
    const btnAbrirPizarra = document.getElementById('btn-abrir-pizarra');
    const modalPizarra = document.getElementById('modal-pizarra');
    const canvasPizarra = document.getElementById('canvas-pizarra');
    const ctxPiz = canvasPizarra ? canvasPizarra.getContext('2d') : null;
    let pizarraDrawing = false;

    if (btnAbrirPizarra && modalPizarra && canvasPizarra) {
        btnAbrirPizarra.addEventListener('click', () => {
            modalPizarra.classList.remove('hidden');
            const rect = canvasPizarra.parentElement.getBoundingClientRect();
            canvasPizarra.width = rect.width; canvasPizarra.height = rect.height;
            ctxPiz.fillStyle = '#ffffff'; ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height);
            ctxPiz.lineWidth = 3; ctxPiz.lineCap = 'round'; ctxPiz.strokeStyle = '#000000';
        });

        document.querySelectorAll('.btn-color-pizarra').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-color-pizarra').forEach(b => b.classList.remove('ring-2', 'ring-blue-500', 'scale-110'));
                ctxPiz.strokeStyle = e.target.dataset.color;
                e.target.classList.add('ring-2', 'ring-blue-500', 'scale-110');
            });
        });

        document.getElementById('btn-limpiar-pizarra').addEventListener('click', () => ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height));
        document.getElementById('btn-cerrar-pizarra').addEventListener('click', () => modalPizarra.classList.add('hidden'));

        const getPizPos = (e) => {
            const rect = canvasPizarra.getBoundingClientRect();
            return { x: (e.clientX || e.touches[0].clientX) - rect.left, y: (e.clientY || e.touches[0].clientY) - rect.top };
        };

        canvasPizarra.addEventListener('mousedown', (e) => { pizarraDrawing = true; ctxPiz.beginPath(); ctxPiz.moveTo(getPizPos(e).x, getPizPos(e).y); });
        canvasPizarra.addEventListener('mousemove', (e) => { if (pizarraDrawing) { ctxPiz.lineTo(getPizPos(e).x, getPizPos(e).y); ctxPiz.stroke(); } });
        canvasPizarra.addEventListener('mouseup', () => pizarraDrawing = false);
        canvasPizarra.addEventListener('touchstart', (e) => { e.preventDefault(); pizarraDrawing = true; ctxPiz.beginPath(); ctxPiz.moveTo(getPizPos(e).x, getPizPos(e).y); }, {passive: false});
        canvasPizarra.addEventListener('touchmove', (e) => { e.preventDefault(); if (pizarraDrawing) { ctxPiz.lineTo(getPizPos(e).x, getPizPos(e).y); ctxPiz.stroke(); } }, {passive: false});
        canvasPizarra.addEventListener('touchend', () => pizarraDrawing = false);

        document.getElementById('btn-guardar-pizarra').addEventListener('click', () => {
            canvasPizarra.toBlob(async (blob) => {
                const fileName = `pizarra_${Date.now()}.png`;
                const { error } = await supabaseClient.storage.from('pizarras').upload(fileName, blob, { contentType: 'image/png' });
                if (!error) {
                    const { data: pubData } = supabaseClient.storage.from('pizarras').getPublicUrl(fileName);
                    document.getElementById('tarea-dibujo-url').value = pubData.publicUrl;
                    document.getElementById('img-dibujo-preview').src = pubData.publicUrl;
                    document.getElementById('preview-dibujo').classList.remove('hidden');
                } else { alert("Error al subir a bucket: " + error.message); }
                modalPizarra.classList.add('hidden');
            });
        });

        document.getElementById('btn-borrar-dibujo').addEventListener('click', () => {
            document.getElementById('tarea-dibujo-url').value = '';
            document.getElementById('preview-dibujo').classList.add('hidden');
        });
    }

    if (fabNewTask) {
        fabNewTask.addEventListener('click', () => {
            document.getElementById('form-tarea-title').textContent = "Nueva Tarea";
            document.getElementById('form-tarea').reset();
            document.getElementById('edit-tarea-id').value = "";
            document.getElementById('tarea-fecha').value = getTodayLocalString();
            document.getElementById('tarea-operario').value = window.currentUserProfile ? ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() : '';
            document.getElementById('tarea-dibujo-url').value = '';
            document.getElementById('preview-dibujo').classList.add('hidden');
            hideAllViews();
            viewFormTarea.classList.remove('hidden');
            viewFormTarea.classList.add('flex');
        });
    }

    document.getElementById('btn-cancel-tarea').addEventListener('click', () => navHome.click());
    document.getElementById('btn-back-tarea-list').addEventListener('click', () => navHome.click());

    document.getElementById('form-tarea').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cName = document.getElementById('tarea-cliente').value.trim();
        const oName = document.getElementById('tarea-obra').value.trim();
        const dName = document.getElementById('tarea-direccion').value.trim();
        const lName = document.getElementById('tarea-localidad').value.trim();
        const editId = document.getElementById('edit-tarea-id').value;

        let cliEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === cName.toLowerCase());
        let clienteId;
        if (!cliEncontrado) {
            const { data: newC } = await supabaseClient.from('clientes').insert([{ nombre_cliente: cName }]).select().single();
            clienteId = newC.id;
        } else { clienteId = cliEncontrado.id; }

        const obraEncontrada = allClientesCompletos.find(c => c.id === clienteId)?.obras?.find(o => o.nombre.toLowerCase() === oName.toLowerCase());
        if (!obraEncontrada) {
            await supabaseClient.from('obras').insert([{ cliente_id: clienteId, nombre: oName, direccion: dName, localidad: lName }]);
            loadClientes();
        }

        const username = window.currentUserProfile ? ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() : 'Usuario';
        const tareaData = {
            cliente: cName, obra: oName, direccion: dName, localidad: lName,
            operario_asignado: document.getElementById('tarea-operario').value.trim(),
            fecha: document.getElementById('tarea-fecha').value,
            notas: document.getElementById('tarea-notas').value.trim(),
            dibujo_url: document.getElementById('tarea-dibujo-url').value
        };

        if (editId) {
            tareaData.updated_by = username;
            await supabaseClient.from('tareas').update(tareaData).eq('id', editId);
        } else {
            tareaData.created_by = username;
            tareaData.completada = false;
            await supabaseClient.from('tareas').insert([tareaData]);
        }

        await loadTasksFromDB();
        navHome.click();
    });

    async function loadTasksFromDB() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const { data, error } = await supabaseClient.from('tareas').select('*');
        if (error) {
            c.innerHTML = `<p class="text-red-500 text-center mt-4">Error al cargar tareas: ${error.message}</p>`;
            return;
        }
        allTareas = data || [];
        renderTareas();
    }

    if(searchTareasInput) searchTareasInput.addEventListener('input', renderTareas);
    if(filtroFechaDiario) filtroFechaDiario.addEventListener('change', renderTareas);

    function renderTareas() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const fechaSelect = filtroFechaDiario.value;
        const searchTxt = searchTareasInput.value.toLowerCase().trim();

        let filtradas = allTareas.filter(t => {
            const tFecha = t.fecha ? t.fecha.split('T')[0] : '';
            if (searchTxt === '') {
                if (tFecha !== fechaSelect) return false;
            } else {
                const fullText = `${t.cliente || ''} ${t.obra || ''} ${t.direccion || ''} ${t.localidad || ''} ${t.operario_asignado || ''} ${t.fecha || ''} ${t.notas || ''} ${t.created_by || ''}`.toLowerCase();
                if (!fullText.includes(searchTxt)) return false;
            }
            return true;
        });

        filtradas.sort((a, b) => (a.completada === b.completada ? 0 : a.completada ? 1 : -1));
        c.innerHTML = '';

        if (filtradas.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">No se encontraron tareas con estos criterios.</p>';
            return;
        }

        filtradas.forEach(t => {
            const isComp = t.completada;
            const cardBg = isComp ? 'bg-slate-100 dark:bg-zinc-800 opacity-75' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';
            const div = document.createElement('div');
            div.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2`;
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">${t.cliente || 'Sin cliente'} - ${t.obra || 'Sin obra'}</span>
                    <button onclick="window.toggleTareaCompletada('${t.id}', ${!isComp})" class="w-8 h-8 rounded-full flex items-center justify-center border-2 ${isComp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent hover:border-blue-500'}"><span class="material-symbols-outlined text-[18px]">check</span></button>
                </div>
                <div class="text-sm cursor-pointer" onclick="window.verDetalleTarea('${t.id}')">
                    <p>📅 <strong>Fecha:</strong> ${t.fecha || 'N/D'} | 👷 <strong>Operario:</strong> ${t.operario_asignado || 'Sin asignar'}</p>
                    <p class="text-slate-500 truncate mt-1">📍 ${t.direccion || ''}, ${t.localidad || ''}</p>
                    <p class="mt-2 text-slate-700 dark:text-slate-300 line-clamp-2">${t.notas || 'Sin notas...'}</p>
                </div>
            `;
            c.appendChild(div);
        });
    }

    window.toggleTareaCompletada = async function(id, status) {
        await supabaseClient.from('tareas').update({ completada: status }).eq('id', id);
        const t = allTareas.find(x => x.id === id);
        if(t) t.completada = status;
        renderTareas();
    };

    window.verDetalleTarea = function(id) {
        const item = allTareas.find(t => t.id === id);
        if (!item) return;
        currentTareaItem = item;
        hideAllViews();
        viewDetalleTarea.classList.remove('hidden');
        viewDetalleTarea.classList.add('flex');

        const sello = document.getElementById('sello-completada');
        if(item.completada) sello.classList.remove('hidden'); else sello.classList.add('hidden');
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.direccion || '') + ', ' + (item.localidad || ''))}`;

        document.getElementById('detalle-tarea-content').innerHTML = `
            <div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">${item.cliente || ''} - ${item.obra || ''}</p></div>
            <div><span class="text-xs text-slate-500">Ubicación y Fecha:</span><div class="flex items-center justify-between mt-1"><p class="font-medium">${item.direccion || ''}, ${item.localidad || ''} (${item.fecha || ''})</p><a href="${mapsLink}" target="_blank" class="text-blue-600 bg-blue-50 dark:bg-blue-950 p-1.5 rounded-full flex items-center"><span class="material-symbols-outlined text-[18px]">map</span></a></div></div>
            <div><span class="text-xs text-slate-500">Asignada a:</span><p class="font-medium">${item.operario_asignado || ''}</p></div>
            <div><span class="text-xs text-slate-500">Notas:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1">${item.notas || 'N/A'}</p></div>
            ${item.dibujo_url ? `<div><span class="text-xs text-slate-500">Dibujo:</span><img src="${item.dibujo_url}" class="mt-2 rounded-xl max-h-48 border border-slate-200"></div>` : ''}
            <div class="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between mt-4">
                <span>Creado por: ${item.created_by || '?'} ${item.updated_by ? '<br>Editado por: ' + item.updated_by : ''}</span>
                <button onclick="window.editarTarea('${item.id}')" class="bg-slate-100 dark:bg-zinc-800 px-4 py-2 rounded-xl font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">edit</span> Modificar</button>
            </div>
        `;
    };

    document.getElementById('btn-export-pdf-tarea').addEventListener('click', () => {
        const element = document.getElementById('pdf-export-container-tarea');
        const opt = { margin: 10, filename: `Tarea_${currentTareaItem.obra || 'trabajo'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } };
        html2pdf().from(element).set(opt).save();
    });

    window.editarTarea = function(id) {
        const item = allTareas.find(t => t.id === id);
        if (!item) return;
        document.getElementById('form-tarea-title').textContent = "Modificar Tarea";
        document.getElementById('edit-tarea-id').value = item.id;
        document.getElementById('tarea-cliente').value = item.cliente || '';
        document.getElementById('tarea-obra').value = item.obra || '';
        document.getElementById('tarea-direccion').value = item.direccion || '';
        document.getElementById('tarea-localidad').value = item.localidad || '';
        document.getElementById('tarea-operario').value = item.operario_asignado || '';
        document.getElementById('tarea-fecha').value = item.fecha ? item.fecha.split('T')[0] : getTodayLocalString();
        document.getElementById('tarea-notas').value = item.notas || '';
        document.getElementById('tarea-dibujo-url').value = item.dibujo_url || '';
        if (item.dibujo_url) {
            document.getElementById('img-dibujo-preview').src = item.dibujo_url;
            document.getElementById('preview-dibujo').classList.remove('hidden');
        } else { document.getElementById('preview-dibujo').classList.add('hidden'); }
        hideAllViews();
        viewFormTarea.classList.remove('hidden');
        viewFormTarea.classList.add('flex');
    };
})();
