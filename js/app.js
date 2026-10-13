// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewFormTarea = document.getElementById('view-form-tarea');
    const viewDetalleTarea = document.getElementById('view-detalle-tarea');
    const viewPartes = document.getElementById('view-partes');
    const viewFormParte = document.getElementById('view-form-parte');
    const viewDetalleParte = document.getElementById('view-detalle-parte');
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

    let allPartes = [];
    let allClientesCompletos = [];
    let allOperarios = [];
    let currentParteItem = null;
    
    // --- NUEVAS VARIABLES TAREAS ---
    let allTareas = [];
    let currentTareaItem = null;
    const filtroFechaDiario = document.getElementById('filtro-fecha-diario');
    const searchTareasInput = document.getElementById('search-tareas');

    // --- MODO CLARO / OSCURO ROBUSTO ---
    function aplicarTema(tema) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (tema === 'oscuro' || (tema === 'auto' && prefersDark)) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', tema);
        if(typeof redibujarFirmaFondo === 'function') redibujarFirmaFondo();
    }

    if (selectTema) {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        selectTema.value = savedTheme;
        aplicarTema(savedTheme);
        selectTema.addEventListener('change', (e) => aplicarTema(e.target.value));
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem('theme') || 'auto') === 'auto') aplicarTema('auto');
    });

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }
    
    if(filtroFechaDiario) filtroFechaDiario.value = getTodayLocalString();

    function hideAllViews() {
        [viewTaskList, viewFormTarea, viewDetalleTarea, viewPartes, viewFormParte, viewDetalleParte, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
            if (v) { v.classList.add('hidden'); v.classList.remove('flex'); }
        });
        [navHome, navPartes, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-blue-600', 'dark:text-blue-400');
                nav.classList.add('text-slate-500', 'dark:text-slate-400');
                const badge = nav.querySelector('span:first-child');
                if (badge) badge.classList.remove('bg-blue-100', 'dark:bg-blue-950');
            }
        });
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewParte) fabNewParte.classList.add('hidden');
    }

    function setActiveNav(navBtn) {
        if (!navBtn) return;
        navBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        navBtn.classList.add('text-blue-600', 'dark:text-blue-400');
        const badge = navBtn.querySelector('span:first-child');
        if (badge) badge.classList.add('bg-blue-100', 'dark:bg-blue-950');
    }

    // --- NAVEGACIÓN ---
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); renderTareas(); });
    if (navPartes) navPartes.addEventListener('click', () => { hideAllViews(); viewPartes.classList.remove('hidden'); viewPartes.classList.add('flex'); setActiveNav(navPartes); fabNewParte.classList.remove('hidden'); fabNewParte.classList.add('flex'); if(typeof loadPartes==='function') loadPartes(); });
    // Eventos de bitácora, clientes, empleados, etc... (intactos)

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
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    if (window.currentUserProfile) initAppAfterLogin();

    // --- LÓGICA DE CLIENTES Y OPERARIOS ---
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
        const { data } = await supabaseClient.from('perfiles').select('nombre, apellido, username');
        allOperarios = data || [];
        const dl = document.getElementById('operarios-datalist');
        if (dl) {
            dl.innerHTML = '';
            allOperarios.forEach(op => {
                dl.insertAdjacentHTML('beforeend', `<option value="${(op.nombre || '') + ' ' + (op.apellido || '')}"></option>`);
            });
        }
    }

    // --- MÓDULO NUEVO: DIARIO DE TAREAS ---
    
    // Autocompletar Dirección al elegir Obra
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

    // Web Speech API (Dictado)
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
                btnDictarVoz.classList.replace('text-blue-700', 'text-red-600');
                btnDictarVoz.classList.replace('bg-blue-100', 'bg-red-100');
                btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-pulse">mic</span> Escuchando...';
                recognition.start();
            });
            
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                tareaNotas.value = (tareaNotas.value + ' ' + text).trim();
                resetMicBtn();
            };
            recognition.onerror = resetMicBtn;
            recognition.onend = resetMicBtn;
            
            function resetMicBtn() {
                btnDictarVoz.classList.replace('text-red-600', 'text-blue-700');
                btnDictarVoz.classList.replace('bg-red-100', 'bg-blue-100');
                btnDictarVoz.innerHTML = '<span class="material-symbols-outlined text-[16px]">mic</span> Dictar';
            }
        } else {
            btnDictarVoz.style.display = 'none'; // No soportado
        }
    }

    // Pizarra Lógica
    const btnAbrirPizarra = document.getElementById('btn-abrir-pizarra');
    const modalPizarra = document.getElementById('modal-pizarra');
    const canvasPizarra = document.getElementById('canvas-pizarra');
    const ctxPiz = canvasPizarra ? canvasPizarra.getContext('2d') : null;
    let pizarraDrawing = false;

    if (btnAbrirPizarra && modalPizarra && canvasPizarra) {
        btnAbrirPizarra.addEventListener('click', () => {
            modalPizarra.classList.remove('hidden');
            // Resize canvas to match container exactly
            const rect = canvasPizarra.parentElement.getBoundingClientRect();
            canvasPizarra.width = rect.width;
            canvasPizarra.height = rect.height;
            ctxPiz.fillStyle = '#ffffff'; // Fondo blanco por defecto para la imagen
            ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height);
            ctxPiz.lineWidth = 3;
            ctxPiz.lineCap = 'round';
            ctxPiz.strokeStyle = '#000000'; // negro por defecto
        });

        // Controles Pizarra
        document.querySelectorAll('.btn-color-pizarra').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-color-pizarra').forEach(b => {
                    b.classList.remove('ring-2', 'ring-blue-500', 'scale-110');
                });
                const color = e.target.dataset.color;
                ctxPiz.strokeStyle = color;
                e.target.classList.add('ring-2', 'ring-blue-500', 'scale-110');
            });
        });

        document.getElementById('btn-limpiar-pizarra').addEventListener('click', () => {
            ctxPiz.fillRect(0, 0, canvasPizarra.width, canvasPizarra.height);
        });
        
        document.getElementById('btn-cerrar-pizarra').addEventListener('click', () => {
            modalPizarra.classList.add('hidden');
        });

        // Dibujo events
        const getPizPos = (e) => {
            const rect = canvasPizarra.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        canvasPizarra.addEventListener('mousedown', (e) => { pizarraDrawing = true; ctxPiz.beginPath(); ctxPiz.moveTo(getPizPos(e).x, getPizPos(e).y); });
        canvasPizarra.addEventListener('mousemove', (e) => { if (pizarraDrawing) { ctxPiz.lineTo(getPizPos(e).x, getPizPos(e).y); ctxPiz.stroke(); } });
        canvasPizarra.addEventListener('mouseup', () => pizarraDrawing = false);
        canvasPizarra.addEventListener('mouseleave', () => pizarraDrawing = false);
        canvasPizarra.addEventListener('touchstart', (e) => { e.preventDefault(); pizarraDrawing = true; ctxPiz.beginPath(); ctxPiz.moveTo(getPizPos(e).x, getPizPos(e).y); }, {passive: false});
        canvasPizarra.addEventListener('touchmove', (e) => { e.preventDefault(); if (pizarraDrawing) { ctxPiz.lineTo(getPizPos(e).x, getPizPos(e).y); ctxPiz.stroke(); } }, {passive: false});
        canvasPizarra.addEventListener('touchend', () => pizarraDrawing = false);

        // Guardar dibujo y subir al Bucket
        document.getElementById('btn-guardar-pizarra').addEventListener('click', () => {
            const btnGuardar = document.getElementById('btn-guardar-pizarra');
            btnGuardar.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Subiendo...';
            
            canvasPizarra.toBlob(async (blob) => {
                const fileName = `pizarra_${Date.now()}.png`;
                // SE ASUME QUE EL BUCKET SE LLAMA 'pizarras' Y ES PUBLICO. 
                const { data, error } = await supabaseClient.storage.from('pizarras').upload(fileName, blob, { contentType: 'image/png' });
                
                if (error) {
                    alert('Error subiendo imagen: ' + error.message);
                } else {
                    const { data: pubData } = supabaseClient.storage.from('pizarras').getPublicUrl(fileName);
                    document.getElementById('tarea-dibujo-url').value = pubData.publicUrl;
                    document.getElementById('img-dibujo-preview').src = pubData.publicUrl;
                    document.getElementById('preview-dibujo').classList.remove('hidden');
                }
                modalPizarra.classList.add('hidden');
                btnGuardar.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span> Listo';
            });
        });

        document.getElementById('btn-borrar-dibujo').addEventListener('click', () => {
            document.getElementById('tarea-dibujo-url').value = '';
            document.getElementById('preview-dibujo').classList.add('hidden');
        });
    }

    // --- FORMULARIO NUEVA TAREA ---
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
        const btnSubmit = document.getElementById('btn-submit-tarea');
        btnSubmit.disabled = true;

        const cName = document.getElementById('tarea-cliente').value.trim();
        const oName = document.getElementById('tarea-obra').value.trim();
        const dName = document.getElementById('tarea-direccion').value.trim();
        const lName = document.getElementById('tarea-localidad').value.trim();
        const editId = document.getElementById('edit-tarea-id').value;

        // Auto-crear cliente u obra si no existen
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
            cliente: cName,
            obra: oName,
            direccion: dName,
            localidad: lName,
            operario_asignado: document.getElementById('tarea-operario').value.trim(),
            fecha: document.getElementById('tarea-fecha').value,
            notas: document.getElementById('tarea-notas').value.trim(),
            dibujo_url: document.getElementById('tarea-dibujo-url').value,
        };

        if (editId) {
            tareaData.updated_by = username;
            await supabaseClient.from('tareas').update(tareaData).eq('id', editId);
        } else {
            tareaData.created_by = username;
            tareaData.completada = false;
            await supabaseClient.from('tareas').insert([tareaData]);
        }

        btnSubmit.disabled = false;
        await loadTasksFromDB();
        navHome.click();
    });

    // --- CARGA Y RENDERIZADO DE TAREAS (Buscador y Filtro) ---
    async function loadTasksFromDB() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        c.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
        
        const { data, error } = await supabaseClient.from('tareas').select('*').order('created_at', { ascending: false });
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
        
        // Filtrar
        let filtradas = allTareas.filter(t => {
            const cumpleFecha = t.fecha === fechaSelect;
            if (!cumpleFecha) return false;
            
            if (searchTxt === '') return true;
            const fullText = `${t.cliente} ${t.obra} ${t.direccion} ${t.localidad} ${t.operario_asignado} ${t.notas} ${t.created_by}`.toLowerCase();
            return fullText.includes(searchTxt);
        });

        // Ordenar: pendientes primero, completadas al final
        filtradas.sort((a, b) => (a.completada === b.completada ? 0 : a.completada ? 1 : -1));

        c.innerHTML = '';
        if (filtradas.length === 0) {
            c.innerHTML = '<p class="text-slate-500 text-center mt-8 bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl">No hay tareas para esta fecha.</p>';
            return;
        }

        filtradas.forEach(t => {
            const isComp = t.completada;
            const cardBg = isComp ? 'bg-slate-100 dark:bg-zinc-800 opacity-75' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';
            
            const div = document.createElement('div');
            div.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-2 relative overflow-hidden transition-all`;
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">${t.cliente} - ${t.obra}</span>
                    <button onclick="window.toggleTareaCompletada('${t.id}', ${!isComp})" class="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isComp ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-zinc-600 text-transparent hover:border-blue-500'}">
                        <span class="material-symbols-outlined text-[18px]">check</span>
                    </button>
                </div>
                <div class="text-sm cursor-pointer" onclick="window.verDetalleTarea('${t.id}')">
                    <p>👷 <strong>Operario:</strong> ${t.operario_asignado}</p>
                    <p class="text-slate-500 truncate mt-1">📍 ${t.direccion}, ${t.localidad}</p>
                    <p class="mt-2 text-slate-700 dark:text-slate-300 line-clamp-2">${t.notas || 'Sin notas...'}</p>
                </div>
            `;
            c.appendChild(div);
        });
    }

    window.toggleTareaCompletada = async function(id, status) {
        await supabaseClient.from('tareas').update({ completada: status }).eq('id', id);
        const tarea = allTareas.find(t => t.id === id);
        if(tarea) tarea.completada = status;
        renderTareas(); // Reordena y manda al final
    }

    window.verDetalleTarea = function(id) {
        const item = allTareas.find(t => t.id === id);
        if (!item) return;
        currentTareaItem = item;
        
        hideAllViews();
        viewDetalleTarea.classList.remove('hidden');
        viewDetalleTarea.classList.add('flex');

        const sello = document.getElementById('sello-completada');
        if(item.completada) sello.classList.remove('hidden'); else sello.classList.add('hidden');

        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion + ', ' + item.localidad)}`;

        document.getElementById('detalle-tarea-content').innerHTML = `
            <div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">${item.cliente} - ${item.obra}</p></div>
            <div>
                <span class="text-xs text-slate-500">Ubicación:</span>
                <div class="flex items-center gap-2 mt-1">
                    <p class="font-medium">${item.direccion}, ${item.localidad}</p>
                    <a href="${googleMapsLink}" target="_blank" class="text-blue-600 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-full hover:bg-blue-100 flex items-center"><span class="material-symbols-outlined text-[18px]">map</span></a>
                </div>
            </div>
            <div><span class="text-xs text-slate-500">Asignada a:</span><p class="font-medium">${item.operario_asignado}</p></div>
            <div><span class="text-xs text-slate-500">Notas / Descripción:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1 whitespace-pre-line">${item.notas || 'N/A'}</p></div>
            ${item.dibujo_url ? `<div><span class="text-xs text-slate-500">Dibujo Adjunto:</span><img src="${item.dibujo_url}" class="mt-2 rounded-xl border border-slate-200 max-h-48"></div>` : ''}
            <div class="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-between mt-4">
                <span>Creado por: ${item.created_by || '?'} <br> ${item.updated_by ? 'Editado por: ' + item.updated_by : ''}</span>
                <button onclick="window.editarTarea('${item.id}')" class="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-xl font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">edit</span> Modificar</button>
            </div>
        `;
    };

    document.getElementById('btn-export-pdf-tarea').addEventListener('click', () => {
        const element = document.getElementById('pdf-export-container-tarea');
        const opt = { margin: 10, filename: `Tarea_${currentTareaItem.obra}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
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
        document.getElementById('tarea-fecha').value = item.fecha || getTodayLocalString();
        document.getElementById('tarea-notas').value = item.notas || '';
        document.getElementById('tarea-dibujo-url').value = item.dibujo_url || '';
        
        if (item.dibujo_url) {
            document.getElementById('img-dibujo-preview').src = item.dibujo_url;
            document.getElementById('preview-dibujo').classList.remove('hidden');
        } else {
            document.getElementById('preview-dibujo').classList.add('hidden');
        }

        hideAllViews();
        viewFormTarea.classList.remove('hidden');
        viewFormTarea.classList.add('flex');
    };

    // (Lógica previa de Partes vaciada para abreviar aquí, ¡MANTÉN LA TUYA INTACTA SI LA COPIAS POR BLOQUES!)
})();
