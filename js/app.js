// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
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
    const fabNewBitacora = document.getElementById('fab-new-bitacora');
    const fabNewMaterial = document.getElementById('fab-new-material');
    const fabNewCliente = document.getElementById('fab-new-cliente');

    const selectTema = document.getElementById('select-tema');
    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownMenuPerfil = document.getElementById('dropdown-menu-perfil');
    const menuItemPerfil = document.getElementById('menu-item-perfil');
    const menuItemEmpresa = document.getElementById('menu-item-empresa');
    const headerUsernameLabel = document.getElementById('header-username-label');
    const btnNotificaciones = document.getElementById('btn-notificaciones');

    // Partes Elements
    const partesContainer = document.getElementById('partes-container');
    const partesCount = document.getElementById('partes-count');
    const searchPartesInput = document.getElementById('search-partes');
    const formParte = document.getElementById('form-parte');
    const formParteTitle = document.getElementById('form-parte-title');
    const editParteId = document.getElementById('edit-parte-id');
    const parteCliente = document.getElementById('parte-cliente');
    const parteObra = document.getElementById('parte-obra');
    const parteDireccion = document.getElementById('parte-direccion');
    const parteLocalidad = document.getElementById('parte-localidad');
    const parteFecha = document.getElementById('parte-fecha');
    const parteDetalle = document.getElementById('parte-detalle');
    const operariosParteContainer = document.getElementById('operarios-parte-container');
    const btnAddOperarioParte = document.getElementById('btn-add-operario-parte');
    const materialesParteContainer = document.getElementById('materiales-parte-container');
    const btnAddMaterialParte = document.getElementById('btn-add-material-parte');
    const btnCancelParte = document.getElementById('btn-cancel-parte');
    const btnBackParteList = document.getElementById('btn-back-parte-list');
    const detalleParteContent = document.getElementById('detalle-parte-content');
    const btnExportPdfParte = document.getElementById('btn-export-pdf-parte');
    const parteBtnBloquear = document.getElementById('parte-btn-bloquear');
    const datalistOperarios = document.getElementById('operarios-datalist');

    // Firma Canvas
    const canvasFirma = document.getElementById('firma-canvas');
    const ctxFirma = canvasFirma ? canvasFirma.getContext('2d') : null;
    const btnLimpiarFirma = document.getElementById('btn-limpiar-firma');

    // Perfil y Empresa
    const formPerfil = document.getElementById('form-perfil');
    const perfilNewPass = document.getElementById('perfil-new-pass');
    const perfilConfirmPass = document.getElementById('perfil-confirm-pass');
    const perfilMensaje = document.getElementById('perfil-mensaje');
    const formEmpresa = document.getElementById('form-empresa');

    let allPartes = [];
    let allClientesCompletos = [];
    let allOperarios = [];
    let currentParteItem = null;

    // --- MANEJO DEL TEMA CLARO / OSCURO ROBUSTO ---
    function aplicarTema(tema) {
        const root = document.documentElement;
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (tema === 'oscuro' || (tema === 'auto' && prefersDark)) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', tema);
        redibujarFirmaFondo();
    }

    if (selectTema) {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        selectTema.value = savedTheme;
        aplicarTema(savedTheme);
        selectTema.addEventListener('change', (e) => aplicarTema(e.target.value));
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem('theme') || 'auto') === 'auto') {
            aplicarTema('auto');
        }
    });

    function getTodayLocalString() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    }

    function hideAllViews() {
        [viewTaskList, viewPartes, viewFormParte, viewDetalleParte, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
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
        if (fabNewBitacora) fabNewBitacora.classList.add('hidden');
        if (fabNewMaterial) fabNewMaterial.classList.add('hidden');
        if (fabNewCliente) fabNewCliente.classList.add('hidden');
    }

    function setActiveNav(navBtn) {
        if (!navBtn) return;
        navBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        navBtn.classList.add('text-blue-600', 'dark:text-blue-400');
        const badge = navBtn.querySelector('span:first-child');
        if (badge) badge.classList.add('bg-blue-100', 'dark:bg-blue-950');
    }

    // --- NAVEGACIÓN ---
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); loadTasks(); });
    if (navPartes) navPartes.addEventListener('click', () => { hideAllViews(); viewPartes.classList.remove('hidden'); viewPartes.classList.add('flex'); setActiveNav(navPartes); fabNewParte.classList.remove('hidden'); fabNewParte.classList.add('flex'); loadPartes(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); setActiveNav(navBitacora); fabNewBitacora.classList.remove('hidden'); fabNewBitacora.classList.add('flex'); loadBitacora(); });
    if (navMateriales) navMateriales.addEventListener('click', () => { hideAllViews(); viewMateriales.classList.remove('hidden'); viewMateriales.classList.add('flex'); setActiveNav(navMateriales); fabNewMaterial.classList.remove('hidden'); fabNewMaterial.classList.add('flex'); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); setActiveNav(navClientes); fabNewCliente.classList.remove('hidden'); fabNewCliente.classList.add('flex'); loadClientes(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); loadEmpleados(); });

    // --- INICIALIZACIÓN Y ACTUALIZACIÓN DEL USUARIO ---
    function actualizarNombreHeader() {
        if (window.currentUserProfile && headerUsernameLabel) {
            const nombre = window.currentUserProfile.nombre || '';
            const apellido = window.currentUserProfile.apellido || '';
            const nombreCompleto = (nombre + ' ' + apellido).trim();
            headerUsernameLabel.textContent = nombreCompleto || window.currentUserProfile.email || 'Cuenta';
        }
    }

    function initAppAfterLogin() {
        actualizarNombreHeader();
        loadTasks();
        loadClientes();
        loadOperariosList();
        loadPartes();

        const rol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdmin = rol === 'admin' || rol === 'superadmin';

        if (navEmpleados) {
            if (isAdmin) { navEmpleados.classList.remove('hidden'); navEmpleados.classList.add('flex'); }
            else { navEmpleados.classList.add('hidden'); navEmpleados.classList.remove('flex'); }
        }
        if (isAdmin && menuItemEmpresa) { menuItemEmpresa.classList.remove('hidden'); menuItemEmpresa.classList.add('flex'); }
    }

    window.addEventListener('userLoggedIn', initAppAfterLogin);
    if (window.currentUserProfile) initAppAfterLogin();

    // Notificaciones
    if (btnNotificaciones) {
        btnNotificaciones.addEventListener('click', () => {
            alert("No tienes notificaciones pendientes.");
        });
    }

    // --- MENÚ PERFIL & EMPRESA ---
    if (btnMenuPerfil && dropdownMenuPerfil) {
        btnMenuPerfil.addEventListener('click', (e) => { e.stopPropagation(); dropdownMenuPerfil.classList.toggle('hidden'); });
    }
    document.addEventListener('click', () => { if (dropdownMenuPerfil) dropdownMenuPerfil.classList.add('hidden'); });

    if (menuItemPerfil) {
        menuItemPerfil.addEventListener('click', () => {
            hideAllViews();
            viewPerfil.classList.remove('hidden');
            viewPerfil.classList.add('flex');
            if (window.currentUserProfile) {
                document.getElementById('perfil-nombre').value = window.currentUserProfile.nombre || '';
                document.getElementById('perfil-apellido').value = window.currentUserProfile.apellido || '';
                document.getElementById('perfil-telefono').value = window.currentUserProfile.telefono || '';
                document.getElementById('perfil-nombre-header').textContent = ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() || 'Mi Perfil';
                document.getElementById('perfil-email-header').textContent = window.currentUserProfile.email || '';
                actualizarNombreHeader();
                if (perfilNewPass) perfilNewPass.value = '';
                if (perfilConfirmPass) perfilConfirmPass.value = '';
                if (perfilMensaje) perfilMensaje.classList.add('hidden');
            }
        });
    }

    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (perfilMensaje) perfilMensaje.classList.add('hidden');
            const nuevoNombre = document.getElementById('perfil-nombre').value.trim();
            const nuevoApellido = document.getElementById('perfil-apellido').value.trim();
            const nuevoTelefono = document.getElementById('perfil-telefono').value.trim();
            const pass1 = perfilNewPass.value;
            const pass2 = perfilConfirmPass.value;

            if (pass1 || pass2) {
                if (pass1 !== pass2) {
                    perfilMensaje.textContent = "Las contraseñas no coinciden.";
                    perfilMensaje.className = "text-red-600 text-sm text-center font-medium";
                    perfilMensaje.classList.remove('hidden');
                    return;
                }
                const { error: passError } = await supabaseClient.auth.updateUser({ password: pass1 });
                if (passError) {
                    perfilMensaje.textContent = "Error al actualizar contraseña.";
                    perfilMensaje.className = "text-red-600 text-sm text-center font-medium";
                    perfilMensaje.classList.remove('hidden');
                    return;
                }
            }

            const { error } = await supabaseClient.from('perfiles').update({
                nombre: nuevoNombre, apellido: nuevoApellido, telefono: nuevoTelefono
            }).eq('id', window.currentUserProfile.id);

            if (error) {
                perfilMensaje.textContent = "Error al actualizar perfil.";
                perfilMensaje.className = "text-red-600 text-sm text-center font-medium";
                perfilMensaje.classList.remove('hidden');
            } else {
                window.currentUserProfile.nombre = nuevoNombre;
                window.currentUserProfile.apellido = nuevoApellido;
                window.currentUserProfile.telefono = nuevoTelefono;
                actualizarNombreHeader();
                perfilMensaje.textContent = "¡Perfil actualizado con éxito!";
                perfilMensaje.className = "text-emerald-600 text-sm text-center font-medium";
                perfilMensaje.classList.remove('hidden');
                perfilNewPass.value = ''; perfilConfirmPass.value = '';
            }
        });
    }

    if (menuItemEmpresa) {
        menuItemEmpresa.addEventListener('click', async () => {
            hideAllViews();
            viewEmpresa.classList.remove('hidden');
            viewEmpresa.classList.add('flex');
            const { data } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
            if (data) {
                document.getElementById('emp-nombre').value = data.nombre_fiscal || '';
                document.getElementById('emp-cif').value = data.cif || '';
                document.getElementById('emp-direccion').value = data.direccion || '';
                document.getElementById('emp-logo').value = data.logo_url || '';
            }
        });
    }

    if (formEmpresa) {
        formEmpresa.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empresaData = {
                nombre_fiscal: document.getElementById('emp-nombre').value.trim(),
                cif: document.getElementById('emp-cif').value.trim(),
                direccion: document.getElementById('emp-direccion').value.trim(),
                logo_url: document.getElementById('emp-logo').value.trim()
            };
            const { data: existing } = await supabaseClient.from('configuracion_empresa').select('id').limit(1).single();
            if (existing) {
                await supabaseClient.from('configuracion_empresa').update(empresaData).eq('id', existing.id);
            } else {
                await supabaseClient.from('configuracion_empresa').insert([empresaData]);
            }
            alert("¡Logotipo y nombre de empresa guardados con éxito!");
        });
    }

    // --- MÓDULO PARTES DE TRABAJO ---
    async function loadOperariosList() {
        const { data } = await supabaseClient.from('perfiles').select('nombre, apellido, username');
        allOperarios = data || [];
        if (datalistOperarios) {
            datalistOperarios.innerHTML = '';
            allOperarios.forEach(op => {
                const opt = document.createElement('option');
                opt.value = (op.nombre || '') + ' ' + (op.apellido || '') + ' (@' + (op.username || '') + ')';
                datalistOperarios.appendChild(opt);
            });
        }
    }

    if (fabNewParte) {
        fabNewParte.addEventListener('click', () => {
            formParteTitle.textContent = "Nuevo Parte de Trabajo";
            formParte.reset();
            editParteId.value = "";
            if (parteFecha) parteFecha.value = getTodayLocalString();
            if (operariosParteContainer) operariosParteContainer.innerHTML = '';
            if (materialesParteContainer) materialesParteContainer.innerHTML = '';
            
            const currentUserFull = window.currentUserProfile ? ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() : 'Usuario';
            agregarFilaOperario(currentUserFull, '8h');
            agregarFilaMaterialParte();
            limpiarFirmaCanvas();

            if (parteBtnBloquear) {
                parteBtnBloquear.textContent = "Bloquear Parte";
                parteBtnBloquear.classList.remove('bg-emerald-100', 'text-emerald-800');
                parteBtnBloquear.classList.add('bg-amber-100', 'text-amber-800');
            }

            hideAllViews();
            viewFormParte.classList.remove('hidden');
            viewFormParte.classList.add('flex');
        });
    }

    if (btnCancelParte) btnCancelParte.addEventListener('click', () => navPartes.click());
    if (btnBackParteList) btnBackParteList.addEventListener('click', () => navPartes.click());
    if (btnAddOperarioParte) btnAddOperarioParte.addEventListener('click', () => agregarFilaOperario());
    if (btnAddMaterialParte) btnAddMaterialParte.addEventListener('click', () => agregarFilaMaterialParte());

    function agregarFilaOperario(nombre = '', horas = '') {
        const div = document.createElement('div');
        div.className = "operario-row flex gap-2 items-center bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700";
        div.innerHTML = 
            '<input type="text" aria-label="Nombre de operario" placeholder="Operario" value="' + nombre + '" list="operarios-datalist" class="op-nombre flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>' +
            '<input type="text" aria-label="Horas trabajadas" placeholder="Horas (ej. 8h)" value="' + horas + '" class="op-horas w-32 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>' +
            '<button type="button" aria-label="Eliminar operario" class="text-red-600 material-symbols-outlined text-sm p-1.5 hover:bg-red-100 rounded" onclick="this.closest(\'.operario-row\').remove()">delete</button>';
        operariosParteContainer.appendChild(div);
    }

    function agregarFilaMaterialParte(unidades = 1, material = '', referencia = '') {
        const div = document.createElement('div');
        div.className = "material-parte-row flex gap-2 items-center bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700";
        div.innerHTML = 
            '<input type="number" step="any" aria-label="Unidades de material" placeholder="Unid." value="' + unidades + '" class="mp-unidades w-20 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>' +
            '<input type="text" aria-label="Nombre de material" placeholder="Material" value="' + material + '" class="mp-material flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>' +
            '<input type="text" aria-label="Referencia de material" placeholder="Referencia" value="' + referencia + '" class="mp-referencia w-32 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm">' +
            '<button type="button" aria-label="Eliminar material" class="text-red-600 material-symbols-outlined text-sm p-1.5 hover:bg-red-100 rounded" onclick="this.closest(\'.material-parte-row\').remove()">delete</button>';
        materialesParteContainer.appendChild(div);
    }

    // Configurar Canvas de Firma
    function configurarFirmaCanvas() {
        if (!canvasFirma || !ctxFirma) return;
        ctxFirma.lineWidth = 2;
        ctxFirma.lineCap = 'round';
        let drawing = false;

        function getPos(e) {
            const rect = canvasFirma.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            return { x: clientX - rect.left, y: clientY - rect.top };
        }

        canvasFirma.onmousedown = (e) => { drawing = true; const p = getPos(e); ctxFirma.beginPath(); ctxFirma.moveTo(p.x, p.y); };
        canvasFirma.onmousemove = (e) => { if (!drawing) return; const p = getPos(e); ctxFirma.lineTo(p.x, p.y); ctxFirma.stroke(); };
        canvasFirma.onmouseup = () => { drawing = false; };
        canvasFirma.onmouseleave = () => { drawing = false; };
        canvasFirma.ontouchstart = (e) => { drawing = true; const p = getPos(e); ctxFirma.beginPath(); ctxFirma.moveTo(p.x, p.y); e.preventDefault(); };
        canvasFirma.ontouchmove = (e) => { if (!drawing) return; const p = getPos(e); ctxFirma.lineTo(p.x, p.y); ctxFirma.stroke(); e.preventDefault(); };
        canvasFirma.ontouchend = () => { drawing = false; };
    }
    configurarFirmaCanvas();

    function redibujarFirmaFondo() {
        if (!canvasFirma || !ctxFirma) return;
        const isDark = document.documentElement.classList.contains('dark');
        canvasFirma.style.backgroundColor = isDark ? '#000000' : '#ffffff';
        ctxFirma.strokeStyle = isDark ? '#ffffff' : '#000000';
    }

    function limpiarFirmaCanvas() {
        if (!ctxFirma || !canvasFirma) return;
        ctxFirma.clearRect(0, 0, canvasFirma.width, canvasFirma.height);
        redibujarFirmaFondo();
    }

    if (btnLimpiarFirma) btnLimpiarFirma.addEventListener('click', limpiarFirmaCanvas);

    let isBloqueado = false;
    if (parteBtnBloquear) {
        parteBtnBloquear.addEventListener('click', () => {
            isBloqueado = !isBloqueado;
            if (isBloqueado) {
                parteBtnBloquear.textContent = "Parte Bloqueado 🔒";
                parteBtnBloquear.classList.remove('bg-amber-100', 'text-amber-800');
                parteBtnBloquear.classList.add('bg-emerald-100', 'text-emerald-800');
            } else {
                parteBtnBloquear.textContent = "Bloquear Parte";
                parteBtnBloquear.classList.remove('bg-emerald-100', 'text-emerald-800');
                parteBtnBloquear.classList.add('bg-amber-100', 'text-amber-800');
            }
        });
    }

    if (formParte) {
        formParte.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-parte');
            btnSubmit.disabled = true;

            const cName = parteCliente.value.trim();
            const oName = parteObra.value.trim();
            const dName = parteDireccion.value.trim();
            const lName = parteLocalidad.value.trim();
            const editId = editParteId.value;

            let cliEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === cName.toLowerCase());
            let clienteId;
            if (!cliEncontrado) {
                const { data: newC } = await supabaseClient.from('clientes').insert([{ nombre_cliente: cName }]).select().single();
                clienteId = newC.id;
            } else {
                clienteId = cliEncontrado.id;
            }

            const obraEncontrada = allClientesCompletos.find(c => c.id === clienteId)?.obras?.find(o => o.nombre.toLowerCase() === oName.toLowerCase());
            if (!obraEncontrada) {
                await supabaseClient.from('obras').insert([{
                    cliente_id: clienteId, nombre: oName, direccion: dName, localidad: lName
                }]);
                loadClientes();
            }

            const username = window.currentUserProfile ? ((window.currentUserProfile.nombre || '') + ' ' + (window.currentUserProfile.apellido || '')).trim() : 'Usuario';
            const firmaDataURL = canvasFirma ? canvasFirma.toDataURL() : '';

            const parteData = {
                cliente: cName,
                obra: oName,
                direccion: dName,
                localidad: lName,
                fecha: parteFecha.value,
                detalle_trabajo: parteDetalle.value.trim(),
                firma_digital: firmaDataURL,
                bloqueado: isBloqueado,
                created_by: username
            };

            let parteId = editId;
            if (editId) {
                await supabaseClient.from('partes_trabajo').update(parteData).eq('id', editId);
                await supabaseClient.from('partes_operarios').delete().eq('parte_id', editId);
                await supabaseClient.from('partes_materiales').delete().eq('parte_id', editId);
            } else {
                const { data: newP, error } = await supabaseClient.from('partes_trabajo').insert([parteData]).select().single();
                if (error) { alert("Error al guardar parte: " + error.message); btnSubmit.disabled = false; return; }
                parteId = newP.id;
            }

            const filasOps = operariosParteContainer.querySelectorAll('.operario-row');
            for (const fOp of filasOps) {
                const operario_nombre = fOp.querySelector('.op-nombre').value.trim();
                const horas = fOp.querySelector('.op-horas').value.trim();
                if (operario_nombre) {
                    await supabaseClient.from('partes_operarios').insert([{ parte_id: parteId, operario_nombre, horas }]);
                }
            }

            const filasMats = materialesParteContainer.querySelectorAll('.material-parte-row');
            for (const fMat of filasMats) {
                const unidades = parseFloat(fMat.querySelector('.mp-unidades').value) || 1;
                const material = fMat.querySelector('.mp-material').value.trim();
                const referencia = fMat.querySelector('.mp-referencia').value.trim();
                if (material) {
                    await supabaseClient.from('partes_materiales').insert([{ parte_id: parteId, unidades, material, referencia }]);
                }
            }

            btnSubmit.disabled = false;
            navPartes.click();
        });
    }

    async function loadPartes() {
        if (!partesContainer) return;
        partesContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
        
        const { data: partesData, error } = await supabaseClient.from('partes_trabajo').select('*').order('fecha', { ascending: false });
        if (error) {
            partesContainer.innerHTML = '<p class="text-red-600 text-center">Error al cargar partes.</p>';
            return;
        }

        allPartes = [];
        for (const p of (partesData || [])) {
            const { data: ops } = await supabaseClient.from('partes_operarios').select('*').eq('parte_id', p.id);
            const { data: mats } = await supabaseClient.from('partes_materiales').select('*').eq('parte_id', p.id);
            allPartes.push({ ...p, operarios: ops || [], materiales: mats || [] });
        }

        renderPartes(allPartes);
    }

    function renderPartes(items) {
        partesContainer.innerHTML = '';
        if (partesCount) partesCount.textContent = items.length + ' partes';
        if (items.length === 0) {
            partesContainer.innerHTML = '<p class="text-slate-500 text-center mt-4">No hay partes de trabajo registrados.</p>';
            return;
        }

        items.forEach(parte => {
            const isBloq = parte.bloqueado;
            const cardBg = isBloq ? 'bg-slate-100 dark:bg-zinc-800 opacity-90' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';

            const card = document.createElement('div');
            card.className = cardBg + ' p-4 rounded-2xl shadow-sm flex flex-col gap-3';
            card.innerHTML = 
                '<div class="flex justify-between items-start">' +
                    '<span class="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-md">' + parte.cliente + ' - ' + parte.obra + '</span>' +
                    '<span class="text-xs px-2.5 py-1 rounded-full font-bold ' + (isBloq ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800') + '">' + (isBloq ? 'Bloqueado 🔒' : 'Abierto') + '</span>' +
                '</div>' +
                '<p class="text-sm">📅 <strong>Fecha:</strong> ' + parte.fecha + ' | 📍 <strong>Localidad:</strong> ' + parte.localidad + '</p>' +
                '<p class="text-sm line-clamp-2">💬 ' + (parte.detalle_trabajo || 'Sin detalle') + '</p>' +
                '<div class="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">' +
                    '<span>Creado por: <strong>' + (parte.created_by || 'Desconocido') + '</strong></span>' +
                    '<div class="flex gap-2">' +
                        '<button onclick="window.verDetalleParte(\'' + parte.id + '\')" class="bg-slate-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 font-medium">Ver PDF</button>' +
                        (!isBloq ? '<button onclick="window.editarParte(\'' + parte.id + '\')" class="bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg font-medium">Modificar</button>' : '') +
                    '</div>' +
                '</div>';
            partesContainer.appendChild(card);
        });
    }

    window.verDetalleParte = async function(id) {
        const item = allPartes.find(p => p.id === id);
        if (!item) return;
        currentParteItem = item;
        hideAllViews();
        viewDetalleParte.classList.remove('hidden');
        viewDetalleParte.classList.add('flex');

        const { data: emp } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
        const logoImg = document.getElementById('pdf-parte-emp-logo');
        if (emp) {
            document.getElementById('pdf-parte-emp-nombre').textContent = emp.nombre_fiscal || 'Diario de Obra';
            document.getElementById('pdf-parte-emp-cif').textContent = emp.cif ? 'CIF: ' + emp.cif : '';
            document.getElementById('pdf-parte-emp-dir').textContent = emp.direccion || '';
            if (emp.logo_url && logoImg) {
                logoImg.src = emp.logo_url;
                logoImg.classList.remove('hidden');
            } else if (logoImg) {
                logoImg.classList.add('hidden');
            }
        }

        const opsHtml = item.operarios.map(op => '<span class="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs">👷 ' + op.operario_nombre + ' (' + op.horas + ')</span>').join(' ');
        const matsHtml = item.materiales.map(m => '<tr class="border-b border-slate-200 dark:border-zinc-800"><td class="py-1 px-2 font-bold">' + m.unidades + '</td><td class="py-1 px-2">' + m.material + '</td><td class="py-1 px-2">' + (m.referencia || 'N/D') + '</td></tr>').join('');

        detalleParteContent.innerHTML = 
            '<div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">' + item.cliente + ' - ' + item.obra + '</p></div>' +
            '<div><span class="text-xs text-slate-500">Dirección y Localidad:</span><p class="font-medium">' + item.direccion + ', ' + item.localidad + ' (' + item.fecha + ')</p></div>' +
            '<div><span class="text-xs text-slate-500">Operarios y Horas:</span><div class="flex flex-wrap gap-2 mt-1">' + opsHtml + '</div></div>' +
            '<div><span class="text-xs text-slate-500">Detalle de Trabajos:</span><p class="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl mt-1 whitespace-pre-line">' + (item.detalle_trabajo || 'Sin detalle') + '</p></div>' +
            '<div>' +
                '<span class="text-xs text-slate-500">Materiales:</span>' +
                '<table class="w-full text-left border-collapse mt-1 text-xs">' +
                    '<thead><tr class="bg-slate-100 dark:bg-zinc-800"><th class="p-2">Unid.</th><th class="p-2">Material</th><th class="p-2">Ref.</th></tr></thead>' +
                    '<tbody>' + matsHtml + '</tbody>' +
                '</table>' +
            '</div>' +
            (item.firma_digital ? '<div><span class="text-xs text-slate-500">Firma Digital:</span><div class="mt-1 border border-slate-200 rounded-xl p-2 bg-white inline-block"><img src="' + item.firma_digital + '" class="max-h-32 rounded"/></div></div>' : '');
    };

    if (btnExportPdfParte) {
        btnExportPdfParte.addEventListener('click', () => {
            const element = document.getElementById('pdf-export-container-parte');
            const opt = {
                margin: 10,
                filename: 'Parte_Trabajo_' + (currentParteItem ? currentParteItem.cliente : 'obra') + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    }

    window.editarParte = function(id) {
        const item = allPartes.find(p => p.id === id);
        if (!item) return;
        formParteTitle.textContent = "Modificar Parte de Trabajo";
        editParteId.value = item.id;
        parteCliente.value = item.cliente || '';
        parteObra.value = item.obra || '';
        parteDireccion.value = item.direccion || '';
        parteLocalidad.value = item.localidad || '';
        parteFecha.value = item.fecha || getTodayLocalString();
        parteDetalle.value = item.detalle_trabajo || '';

        if (operariosParteContainer) operariosParteContainer.innerHTML = '';
        if (item.operarios && item.operarios.length > 0) {
            item.operarios.forEach(op => agregarFilaOperario(op.operario_nombre, op.horas));
        } else {
            agregarFilaOperario();
        }

        if (materialesParteContainer) materialesParteContainer.innerHTML = '';
        if (item.materiales && item.materiales.length > 0) {
            item.materiales.forEach(m => agregarFilaMaterialParte(m.unidades, m.material, m.referencia));
        } else {
            agregarFilaMaterialParte();
        }

        limpiarFirmaCanvas();
        if (item.firma_digital && ctxFirma && canvasFirma) {
            const img = new Image();
            img.onload = () => { ctxFirma.drawImage(img, 0, 0); };
            img.src = item.firma_digital;
        }

        isBloqueado = false;
        if (parteBtnBloquear) {
            parteBtnBloquear.textContent = "Bloquear Parte";
            parteBtnBloquear.classList.remove('bg-emerald-100', 'text-emerald-800');
            parteBtnBloquear.classList.add('bg-amber-100', 'text-amber-800');
        }

        hideAllViews();
        viewFormParte.classList.remove('hidden');
        viewFormParte.classList.add('flex');
    };

    // --- CARGAS BÁSICAS ---
    async function loadTasks() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const { data } = await supabaseClient.from('tareas').select('*').order('completada', { ascending: true });
        c.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay tareas.</p>' : data.map(t => '<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">' + t.tarea + '</h3></div>').join('');
    }

    async function loadBitacora() {
        const c = document.getElementById('bitacora-container');
        if (!c) return;
        const { data } = await supabaseClient.from('bitacora').select('*').order('created_at', { ascending: false });
        c.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay registros.</p>' : data.map(b => '<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><p class="text-sm">' + (b.notas || 'Sin notas') + '</p></div>').join('');
    }

    async function loadClientes() {
        const { data: clientesData } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        allClientesCompletos = [];
        for (const cli of (clientesData || [])) {
            const { data: obrasCli } = await supabaseClient.from('obras').select('*').eq('cliente_id', cli.id);
            allClientesCompletos.push({ ...cli, obras: obrasCli || [] });
        }
    }

    async function loadEmpleados() {
        const c = document.getElementById('empleados-container');
        if (!c) return;
        const { data } = await supabaseClient.from('perfiles').select('*').order('nombre', { ascending: true });
        c.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay empleados.</p>' : data.map(emp => '<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">' + (emp.nombre || '') + ' ' + (emp.apellido || '') + ' (' + (emp.rol || '') + ')</h3></div>').join('');
    }
})();
