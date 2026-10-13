// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewBitacora = document.getElementById('view-bitacora');
    const viewMateriales = document.getElementById('view-materiales');
    const viewFormMaterial = document.getElementById('view-form-material');
    const viewDetalleMaterial = document.getElementById('view-detalle-material');
    const viewClientes = document.getElementById('view-clientes');
    const viewEmpleados = document.getElementById('view-empleados');
    const viewPerfil = document.getElementById('view-perfil');
    const viewEmpresa = document.getElementById('view-empresa');
    
    const navHome = document.getElementById('nav-home');
    const navBitacora = document.getElementById('nav-bitacora');
    const navMateriales = document.getElementById('nav-materiales');
    const navClientes = document.getElementById('nav-clientes');
    const navEmpleados = document.getElementById('nav-empleados');
    
    const fabNewTask = document.getElementById('fab-new-task');
    const fabNewBitacora = document.getElementById('fab-new-bitacora');
    const fabNewMaterial = document.getElementById('fab-new-material');
    const fabNewCliente = document.getElementById('fab-new-cliente');

    const selectTema = document.getElementById('select-tema');
    const btnMenuPerfil = document.getElementById('btn-menu-perfil');
    const dropdownMenuPerfil = document.getElementById('dropdown-menu-perfil');
    const menuItemPerfil = document.getElementById('menu-item-perfil');
    const menuItemEmpresa = document.getElementById('menu-item-empresa');
    const headerUsernameLabel = document.getElementById('header-username-label');

    const bitacoraContainer = document.getElementById('bitacora-container');
    const bitacoraCount = document.getElementById('bitacora-count');
    const searchBitacoraInput = document.getElementById('search-bitacora');

    const materialesContainer = document.getElementById('materiales-container');
    const materialesCount = document.getElementById('materiales-count');
    const searchMaterialesInput = document.getElementById('search-materiales');
    const formMaterial = document.getElementById('form-material');
    const formMaterialTitle = document.getElementById('form-material-title');
    const editMaterialId = document.getElementById('edit-material-id');
    const matCliente = document.getElementById('mat-cliente');
    const matObra = document.getElementById('mat-obra');
    const matDireccion = document.getElementById('mat-direccion');
    const matLocalidad = document.getElementById('mat-localidad');
    const lineasMaterialesContainer = document.getElementById('lineas-materiales-container');
    const btnAddLineaMaterial = document.getElementById('btn-add-linea-material');
    const btnCancelMaterial = document.getElementById('btn-cancel-material');
    const btnBackMaterialList = document.getElementById('btn-back-material-list');
    const detalleMaterialContent = document.getElementById('detalle-material-content');
    const btnExportPdfMaterial = document.getElementById('btn-export-pdf-material');
    const datalistMateriales = document.getElementById('materiales-datalist');

    const clientesContainer = document.getElementById('clientes-container');
    const clientesCount = document.getElementById('clientes-count');
    const searchClientesInput = document.getElementById('search-clientes');
    const datalistClientes = document.getElementById('clientes-datalist');
    const datalistObras = document.getElementById('obras-datalist');

    const empleadosContainer = document.getElementById('empleados-container');
    const empleadosCount = document.getElementById('empleados-count');
    const searchEmpleadosInput = document.getElementById('search-empleados');

    let allTasks = [];
    let allBitacora = [];
    let allMaterialesSolicitudes = [];
    let allMaterialesCatalogo = [];
    let allClientesCompletos = [];
    let allEmpleados = [];
    let currentMaterialItem = null;

    function aplicarTema(tema) {
        const isDark = tema === 'oscuro' || (tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', tema);
    }

    if (selectTema) {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        selectTema.value = savedTheme;
        aplicarTema(savedTheme);
        selectTema.addEventListener('change', (e) => aplicarTema(e.target.value));
    }

    function hideAllViews() {
        if (viewTaskList) viewTaskList.classList.add('hidden');
        if (viewBitacora) { viewBitacora.classList.add('hidden'); viewBitacora.classList.remove('flex'); }
        if (viewMateriales) { viewMateriales.classList.add('hidden'); viewMateriales.classList.remove('flex'); }
        if (viewFormMaterial) { viewFormMaterial.classList.add('hidden'); viewFormMaterial.classList.remove('flex'); }
        if (viewDetalleMaterial) { viewDetalleMaterial.classList.add('hidden'); viewDetalleMaterial.classList.remove('flex'); }
        if (viewClientes) { viewClientes.classList.add('hidden'); viewClientes.classList.remove('flex'); }
        if (viewEmpleados) { viewEmpleados.classList.add('hidden'); viewEmpleados.classList.remove('flex'); }
        if (viewPerfil) { viewPerfil.classList.add('hidden'); viewPerfil.classList.remove('flex'); }
        if (viewEmpresa) { viewEmpresa.classList.add('hidden'); viewEmpresa.classList.remove('flex'); }
        
        [navHome, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-blue-600', 'dark:text-blue-400', 'font-bold');
                nav.classList.add('text-slate-500', 'dark:text-slate-400');
                const badge = nav.querySelector('span:first-child');
                if (badge) badge.classList.remove('bg-blue-100', 'dark:bg-blue-950');
            }
        });

        if (fabNewTask) fabNewTask.classList.add('hidden');
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

    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); loadTasks(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); setActiveNav(navBitacora); fabNewBitacora.classList.remove('hidden'); fabNewBitacora.classList.add('flex'); loadBitacora(); });
    if (navMateriales) navMateriales.addEventListener('click', () => { hideAllViews(); viewMateriales.classList.remove('hidden'); viewMateriales.classList.add('flex'); setActiveNav(navMateriales); fabNewMaterial.classList.remove('hidden'); fabNewMaterial.classList.add('flex'); loadMaterialesSolicitudes(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); setActiveNav(navClientes); fabNewCliente.classList.remove('hidden'); fabNewCliente.classList.add('flex'); loadClientes(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); loadEmpleados(); });

    function initAppAfterLogin() {
        loadTasks();
        loadBitacora();
        loadMaterialesCatalogo();
        loadClientes();

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
                document.getElementById('perfil-nombre-header').textContent = `${window.currentUserProfile.nombre} ${window.currentUserProfile.apellido}`;
                document.getElementById('perfil-email-header').textContent = window.currentUserProfile.email;
                if (headerUsernameLabel) headerUsernameLabel.textContent = window.currentUserProfile.nombre || 'Cuenta';
            }
        });
    }

    // --- MATERIALES ---
    async function loadMaterialesCatalogo() {
        const { data } = await supabaseClient.from('materiales_catalogo').select('*');
        allMaterialesCatalogo = data || [];
        actualizarDatalistMateriales();
    }

    function actualizarDatalistMateriales() {
        if (datalistMateriales) {
            datalistMateriales.innerHTML = '';
            allMaterialesCatalogo.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.nombre_material;
                opt.textContent = m.referencia ? `Ref: ${m.referencia}` : '';
                datalistMateriales.appendChild(opt);
            });
        }
    }

    if (fabNewMaterial) {
        fabNewMaterial.addEventListener('click', () => {
            formMaterialTitle.textContent = "Nueva Solicitud de Materiales";
            formMaterial.reset();
            editMaterialId.value = "";
            if (lineasMaterialesContainer) lineasMaterialesContainer.innerHTML = '';
            agregarLineaMaterial();
            hideAllViews();
            viewFormMaterial.classList.remove('hidden');
            viewFormMaterial.classList.add('flex');
        });
    }
    if (btnCancelMaterial) btnCancelMaterial.addEventListener('click', () => navMateriales.click());
    if (btnBackMaterialList) btnBackMaterialList.addEventListener('click', () => navMateriales.click());
    if (btnAddLineaMaterial) btnAddLineaMaterial.addEventListener('click', () => agregarLineaMaterial());

    function agregarLineaMaterial(cantidad = 1, material = '', referencia = '') {
        const div = document.createElement('div');
        div.className = "linea-material-row flex gap-2 items-center bg-slate-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700";
        div.innerHTML = `
            <input type="number" step="any" placeholder="Cant." value="${cantidad}" class="mat-item-cant w-20 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>
            <input type="text" placeholder="Material" value="${material}" list="materiales-datalist" class="mat-item-nombre flex-1 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm" required>
            <input type="text" placeholder="Referencia" value="${referencia}" class="mat-item-ref w-32 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-2 text-sm">
            <button type="button" class="text-red-600 material-symbols-outlined text-sm p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded" onclick="this.closest('.linea-material-row').remove()">delete</button>
        `;
        lineasMaterialesContainer.appendChild(div);

        const inputMat = div.querySelector('.mat-item-nombre');
        const inputRef = div.querySelector('.mat-item-ref');
        inputMat.addEventListener('input', () => {
            const encontrado = allMaterialesCatalogo.find(mc => mc.nombre_material.toLowerCase() === inputMat.value.trim().toLowerCase());
            if (encontrado && encontrado.referencia) {
                inputRef.value = encontrado.referencia;
            }
        });
    }

    if (matCliente) {
        matCliente.addEventListener('input', () => {
            actualizarDatalists();
            const clienteSel = matCliente.value.trim().toLowerCase();
            const encontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (encontrado && encontrado.obras && encontrado.obras.length > 0) {
                if (matObra) matObra.value = encontrado.obras[0].nombre || '';
                if (matDireccion) matDireccion.value = encontrado.obras[0].direccion || '';
                if (matLocalidad) matLocalidad.value = encontrado.obras[0].localidad || '';
            }
        });
    }

    if (matObra) {
        matObra.addEventListener('input', () => {
            const clienteSel = matCliente.value.trim().toLowerCase();
            const obraSel = matObra.value.trim().toLowerCase();
            const clienteEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (clienteEncontrado && clienteEncontrado.obras) {
                const obraEncontrada = clienteEncontrado.obras.find(o => o.nombre.toLowerCase() === obraSel);
                if (obraEncontrada) {
                    if (matDireccion) matDireccion.value = obraEncontrada.direccion || '';
                    if (matLocalidad) matLocalidad.value = obraEncontrada.localidad || '';
                }
            }
        });
    }

    if (formMaterial) {
        formMaterial.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-material');
            btnSubmit.disabled = true;

            const cName = matCliente.value.trim();
            const oName = matObra.value.trim();
            const dName = matDireccion.value.trim();
            const lName = matLocalidad.value.trim();
            const editId = editMaterialId.value;

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

            const username = window.currentUserProfile ? (window.currentUserProfile.nombre + ' ' + window.currentUserProfile.apellido) : 'Usuario';

            let solicitudId = editId;
            if (editId) {
                await supabaseClient.from('materiales_solicitudes').update({
                    cliente: cName, obra: oName, direccion: dName, localidad: lName, updated_by: username, updated_at: new Date()
                }).eq('id', editId);
                await supabaseClient.from('materiales_solicitud_items').delete().eq('solicitud_id', editId);
            } else {
                const { data: newSol, error } = await supabaseClient.from('materiales_solicitudes').insert([{
                    cliente: cName, obra: oName, direccion: dName, localidad: lName, created_by: username, updated_by: username
                }]).select().single();
                if (error) { alert("Error al guardar solicitud: " + error.message); btnSubmit.disabled = false; return; }
                solicitudId = newSol.id;
            }

            const filasLineas = lineasMaterialesContainer.querySelectorAll('.linea-material-row');
            for (const fila of filasLineas) {
                const cantidad = parseFloat(fila.querySelector('.mat-item-cant').value) || 1;
                const material = fila.querySelector('.mat-item-nombre').value.trim();
                const referencia = fila.querySelector('.mat-item-ref').value.trim();

                if (material) {
                    await supabaseClient.from('materiales_solicitud_items').insert([{
                        solicitud_id: solicitudId, cantidad, material, referencia
                    }]);

                    const existeCat = allMaterialesCatalogo.find(mc => mc.nombre_material.toLowerCase() === material.toLowerCase());
                    if (!existeCat) {
                        await supabaseClient.from('materiales_catalogo').insert([{ nombre_material: material, referencia }]);
                        loadMaterialesCatalogo();
                    }
                }
            }

            btnSubmit.disabled = false;
            navMateriales.click();
        });
    }

    async function loadMaterialesSolicitudes() {
        if (!materialesContainer) return;
        materialesContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
        
        const { data: solData, error } = await supabaseClient.from('materiales_solicitudes').select('*').order('updated_at', { ascending: false });
        if (error) {
            materialesContainer.innerHTML = '<p class="text-red-600 text-center">Error al cargar solicitudes.</p>';
            return;
        }

        allMaterialesSolicitudes = [];
        for (const sol of (solData || [])) {
            const { data: items } = await supabaseClient.from('materiales_solicitud_items').select('*').eq('solicitud_id', sol.id);
            allMaterialesSolicitudes.push({ ...sol, items: items || [] });
        }

        renderMateriales(allMaterialesSolicitudes);
    }

    function renderMateriales(items) {
        materialesContainer.innerHTML = '';
        if (materialesCount) materialesCount.textContent = `${items.length} solicitudes`;
        if (items.length === 0) {
            materialesContainer.innerHTML = '<p class="text-slate-500 text-center mt-4">No hay solicitudes de materiales.</p>';
            return;
        }

        items.forEach(sol => {
            const isPedido = sol.estado === 'Pedido';
            const cardBg = isPedido ? 'bg-slate-100 dark:bg-zinc-800 opacity-80' : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800';
            const itemsHtml = sol.items.map(it => `<li class="text-xs"><strong>${it.cantidad}x</strong> ${it.material} ${it.referencia ? `(Ref: ${it.referencia})` : ''}</li>`).join('');

            const card = document.createElement('div');
            card.className = `${cardBg} p-4 rounded-2xl shadow-sm flex flex-col gap-3`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-md">${sol.cliente} - ${sol.obra}</span>
                    <span class="text-xs px-2.5 py-1 rounded-full font-bold ${isPedido ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}">${sol.estado || 'Pendiente'}</span>
                </div>
                <ul class="flex flex-col gap-1 pl-4 list-disc">${itemsHtml}</ul>
                <div class="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                    <span>Solicitado por: <strong>${sol.created_by || 'Desconocido'}</strong></span>
                    <div class="flex gap-2">
                        <button onclick="window.verDetalleMaterial('${sol.id}')" class="bg-slate-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 font-medium">Ver PDF</button>
                        <button onclick="window.toggleEstadoPedido('${sol.id}')" class="bg-slate-200 dark:bg-zinc-700 px-3 py-1.5 rounded-lg font-medium">${isPedido ? 'Marcar Pendiente' : 'Marcar Pedido'}</button>
                        <button onclick="window.editarMaterial('${sol.id}')" class="bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg font-medium">Modificar</button>
                    </div>
                </div>
            `;
            materialesContainer.appendChild(card);
        });
    }

    if (searchMaterialesInput) {
        searchMaterialesInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtrados = allMaterialesSolicitudes.filter(s => 
                s.cliente.toLowerCase().includes(q) || 
                s.obra.toLowerCase().includes(q) || 
                s.items.some(i => i.material.toLowerCase().includes(q) || (i.referencia && i.referencia.toLowerCase().includes(q)))
            );
            renderMateriales(filtrados);
        });
    }

    window.toggleEstadoPedido = async function(id) {
        const sol = allMaterialesSolicitudes.find(s => s.id === id);
        if (!sol) return;
        const nuevoEstado = sol.estado === 'Pedido' ? 'Pendiente' : 'Pedido';
        const username = window.currentUserProfile ? (window.currentUserProfile.nombre + ' ' + window.currentUserProfile.apellido) : 'Usuario';

        await supabaseClient.from('materiales_solicitudes').update({
            estado: nuevoEstado, updated_by: username, updated_at: new Date()
        }).eq('id', id);

        loadMaterialesSolicitudes();
    };

    window.verDetalleMaterial = async function(id) {
        const item = allMaterialesSolicitudes.find(s => s.id === id);
        if (!item) return;
        currentMaterialItem = item;
        hideAllViews();
        viewDetalleMaterial.classList.remove('hidden');
        viewDetalleMaterial.classList.add('flex');

        const { data: emp } = await supabaseClient.from('configuracion_empresa').select('*').limit(1).single();
        const logoImg = document.getElementById('pdf-mat-emp-logo');
        if (emp) {
            document.getElementById('pdf-mat-emp-nombre').textContent = emp.nombre_fiscal || 'Diario de Obra';
            document.getElementById('pdf-mat-emp-cif').textContent = emp.cif ? `CIF: ${emp.cif}` : '';
            document.getElementById('pdf-mat-emp-dir').textContent = emp.direccion || '';
            if (emp.logo_url && logoImg) {
                logoImg.src = emp.logo_url;
                logoImg.classList.remove('hidden');
            } else if (logoImg) {
                logoImg.classList.add('hidden');
            }
        }

        const itemsTablaHtml = item.items.map(it => `
            <tr class="border-b border-slate-200 dark:border-zinc-800">
                <td class="py-2 px-3 font-bold">${it.cantidad}</td>
                <td class="py-2 px-3">${it.material}</td>
                <td class="py-2 px-3">${it.referencia || 'N/D'}</td>
            </tr>
        `).join('');

        detalleMaterialContent.innerHTML = `
            <div><span class="text-xs text-slate-500">Cliente / Obra:</span><p class="font-medium text-lg">${item.cliente} - ${item.obra}</p></div>
            <div><span class="text-xs text-slate-500">Dirección:</span><p class="font-medium">${item.direccion}, ${item.localidad}</p></div>
            <div><span class="text-xs text-slate-500">Estado:</span><p class="font-bold">${item.estado || 'Pendiente'}</p></div>
            <div class="mt-2">
                <span class="text-xs text-slate-500">Materiales Solicitados:</span>
                <table class="w-full text-left border-collapse mt-1 text-sm">
                    <thead>
                        <tr class="border-b border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                            <th class="py-2 px-3">Cant.</th>
                            <th class="py-2 px-3">Material</th>
                            <th class="py-2 px-3">Referencia</th>
                        </tr>
                    </thead>
                    <tbody>${itemsTablaHtml}</tbody>
                </table>
            </div>
            <div class="text-xs text-slate-500 pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-between">
                <span>Creado por: <strong>${item.created_by || 'Desconocido'}</strong></span>
                <span>Última modif: <strong>${item.updated_by || 'N/D'}</strong></span>
            </div>
        `;
    };

    if (btnExportPdfMaterial) {
        btnExportPdfMaterial.addEventListener('click', () => {
            const element = document.getElementById('pdf-export-container-material');
            const opt = {
                margin: 10,
                filename: `Solicitud_Materiales_${currentMaterialItem ? currentMaterialItem.cliente : 'obra'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    }

    window.editarMaterial = function(id) {
        const item = allMaterialesSolicitudes.find(s => s.id === id);
        if (!item) return;
        formMaterialTitle.textContent = "Modificar Solicitud de Materiales";
        editMaterialId.value = item.id;
        matCliente.value = item.cliente || '';
        matObra.value = item.obra || '';
        matDireccion.value = item.direccion || '';
        matLocalidad.value = item.localidad || '';

        if (lineasMaterialesContainer) lineasMaterialesContainer.innerHTML = '';
        if (item.items && item.items.length > 0) {
            item.items.forEach(it => agregarLineaMaterial(it.cantidad, it.material, it.referencia));
        } else {
            agregarLineaMaterial();
        }

        hideAllViews();
        viewFormMaterial.classList.remove('hidden');
        viewFormMaterial.classList.add('flex');
    };

    // --- EMPLEADOS ---
    async function loadEmpleados() {
        if (!empleadosContainer) return;
        empleadosContainer.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
        const { data, error } = await supabaseClient.from('perfiles').select('*').order('nombre', { ascending: true });
        if (error) {
            empleadosContainer.innerHTML = '<p class="text-red-600 text-center">Error al cargar empleados.</p>';
            return;
        }
        allEmpleados = data || [];
        renderEmpleados(allEmpleados);
    }

    function renderEmpleados(empleadosToRender) {
        empleadosContainer.innerHTML = '';
        if (empleadosCount) empleadosCount.textContent = `${empleadosToRender.length} empleados`;
        
        const currentRol = window.currentUserProfile ? (window.currentUserProfile.rol || '').trim().toLowerCase() : '';
        const isAdminOrSuper = currentRol === 'admin' || currentRol === 'superadmin';

        empleadosToRender.forEach(emp => {
            const isSuperAdmin = (emp.rol || '').trim().toLowerCase() === 'superadmin';
            const card = document.createElement('div');
            card.className = `p-4 rounded-2xl shadow-sm flex flex-col gap-3 ${emp.activo ? 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800' : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200'}`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-medium text-base">${emp.nombre || ''} ${emp.apellido || ''} ${!emp.activo ? '<span class="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-bold ml-2">Pendiente</span>' : ''}</h3>
                        <p class="text-xs text-slate-500">@${emp.username || 'sin_usuario'} — <span class="font-semibold text-blue-600">${emp.rol || 'operario'}</span></p>
                    </div>
                    ${isAdminOrSuper ? `
                        <div class="flex gap-2">
                            <button onclick="window.editarEmpleadoModal('${emp.id}')" class="text-xs bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg font-medium">Editar</button>
                            ${!isSuperAdmin ? `<button onclick="window.eliminarEmpleado('${emp.id}')" class="text-xs bg-red-100 dark:bg-red-950 text-red-600 px-3 py-1.5 rounded-lg font-medium">Eliminar</button>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="flex flex-wrap gap-2 items-center text-sm pt-1">
                    <a href="tel:${emp.telefono || ''}" class="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400 font-medium">
                        <span class="material-symbols-outlined text-[16px]">call</span> ${emp.telefono || 'Sin teléfono'}
                    </a>
                </div>
            `;
            empleadosContainer.appendChild(card);
        });
    }

    window.eliminarEmpleado = async function(id) {
        if (!confirm("¿Estás seguro de eliminar este empleado?")) return;
        const { error } = await supabaseClient.from('perfiles').delete().eq('id', id);
        if (error) { alert("Error al eliminar: " + error.message); }
        else { loadEmpleados(); }
    };

    window.editarEmpleadoModal = async function(id) {
        const emp = allEmpleados.find(e => e.id === id);
        if (!emp) return;
        const nuevoNombre = prompt("Nombre:", emp.nombre || '');
        if (nuevoNombre === null) return;
        const nuevoRol = prompt("Rol (operario / admin / superadmin):", emp.rol || 'operario');
        if (nuevoRol === null) return;
        const activar = confirm("¿Aprobar / Activar empleado?");

        await supabaseClient.from('perfiles').update({
            nombre: nuevoNombre, rol: nuevoRol.trim().toLowerCase(), activo: activar
        }).eq('id', id);
        loadEmpleados();
    };

    if (searchEmpleadosInput) {
        searchEmpleadosInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtradas = allEmpleados.filter(emp => 
                (emp.nombre && emp.nombre.toLowerCase().includes(q)) || 
                (emp.apellido && emp.apellido.toLowerCase().includes(q)) || 
                (emp.email && emp.email.toLowerCase().includes(q)) || 
                (emp.telefono && emp.telefono.includes(q))
            );
            renderEmpleados(filtradas);
        });
    }

    // --- CLIENTES Y OBRAS ---
    async function loadClientes() {
        const { data: clientesData } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        allClientesCompletos = [];
        for (const cli of (clientesData || [])) {
            const { data: cCli } = await supabaseClient.from('contactos_clientes').select('*').eq('cliente_id', cli.id);
            const { data: obrasCli } = await supabaseClient.from('obras').select('*').eq('cliente_id', cli.id);
            allClientesCompletos.push({ ...cli, contactos_clientes: cCli || [], obras: obrasCli || [] });
        }
        actualizarDatalists();
        if (clientesContainer) renderClientes(allClientesCompletos);
    }

    function actualizarDatalists() {
        if (datalistClientes) {
            datalistClientes.innerHTML = '';
            allClientesCompletos.forEach(cli => {
                const opt = document.createElement('option');
                opt.value = cli.nombre_cliente;
                datalistClientes.appendChild(opt);
            });
        }
        if (datalistObras && matCliente) {
            datalistObras.innerHTML = '';
            const clienteSel = matCliente.value.trim().toLowerCase();
            const clienteEncontrado = allClientesCompletos.find(c => c.nombre_cliente.toLowerCase() === clienteSel);
            if (clienteEncontrado && clienteEncontrado.obras) {
                clienteEncontrado.obras.forEach(ob => {
                    const opt = document.createElement('option');
                    opt.value = ob.nombre;
                    opt.textContent = `${ob.direccion}, ${ob.localidad}`;
                    datalistObras.appendChild(opt);
                });
            }
        }
    }

    function renderClientes(clientesToRender) {
        if (!clientesContainer) return;
        clientesContainer.innerHTML = '';
        if (clientesCount) clientesCount.textContent = `${clientesToRender.length} clientes`;
        clientesToRender.forEach(cli => {
            const card = document.createElement('div');
            card.className = "p-5 rounded-3xl shadow-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col gap-4";
            card.innerHTML = `<h3 class="font-bold text-lg">${cli.nombre_cliente}</h3>`;
            clientesContainer.appendChild(card);
        });
    }

    // --- TAREAS Y BITÁCORA ---
    async function loadTasks() {
        if (!document.getElementById('tasks-container')) return;
        const { data } = await supabaseClient.from('tareas').select('*').order('completada', { ascending: true });
        allTasks = data || [];
        renderTasks(allTasks);
    }
    function renderTasks(tasksToRender) {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        c.innerHTML = tasksToRender.length === 0 ? '<p class="text-slate-500 text-center mt-4">No hay tareas.</p>' : tasksToRender.map(t => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">${t.tarea}</h3></div>`).join('');
    }

    async function loadBitacora() {
        if (!bitacoraContainer) return;
        const { data } = await supabaseClient.from('bitacora').select('*').order('created_at', { ascending: false });
        allBitacora = data || [];
        renderBitacora(allBitacora);
    }
    function renderBitacora(items) {
        if (!bitacoraContainer) return;
        bitacoraContainer.innerHTML = items.length === 0 ? '<p class="text-slate-500 text-center mt-4">No hay registros.</p>' : items.map(b => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><p class="text-sm">${b.notas || 'Sin notas'}</p></div>`).join('');
    }
})();
