// js/app.js
(function() {
    const viewTaskList = document.getElementById('view-task-list');
    const viewBitacora = document.getElementById('view-bitacora');
    const viewMateriales = document.getElementById('view-materiales');
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
    const clientesContainer = document.getElementById('clientes-container');
    const empleadosContainer = document.getElementById('empleados-container');
    const materialesContainer = document.getElementById('materiales-container');
    const modalCliente = document.getElementById('modal-cliente');
    const formCliente = document.getElementById('form-cliente');
    const btnCancelModalCliente = document.getElementById('btn-cancel-modal-cliente');

    let allTasks = [];
    let allBitacora = [];
    let allMaterialesSolicitudes = [];
    let allClientesCompletos = [];
    let allEmpleados = [];

    // --- GESTIÓN DE TEMA CLARO / OSCURO ---
    function aplicarTema(tema) {
        const root = document.documentElement;
        if (tema === 'oscuro' || (tema === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
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
        [viewTaskList, viewBitacora, viewMateriales, viewClientes, viewEmpleados, viewPerfil, viewEmpresa].forEach(v => {
            if (v) { v.classList.add('hidden'); v.classList.remove('flex'); }
        });
        
        [navHome, navBitacora, navMateriales, navClientes, navEmpleados].forEach(nav => {
            if (nav) {
                nav.classList.remove('text-blue-600', 'dark:text-blue-400');
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

    // --- NAVEGACIÓN INFERIOR ---
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); setActiveNav(navHome); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); loadTasks(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); setActiveNav(navBitacora); fabNewBitacora.classList.remove('hidden'); fabNewBitacora.classList.add('flex'); loadBitacora(); });
    if (navMateriales) navMateriales.addEventListener('click', () => { hideAllViews(); viewMateriales.classList.remove('hidden'); viewMateriales.classList.add('flex'); setActiveNav(navMateriales); fabNewMaterial.classList.remove('hidden'); fabNewMaterial.classList.add('flex'); loadMaterialesSolicitudes(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); setActiveNav(navClientes); fabNewCliente.classList.remove('hidden'); fabNewCliente.classList.add('flex'); loadClientes(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); setActiveNav(navEmpleados); loadEmpleados(); });

    // --- FABs (+) ACCIONES ---
    if (fabNewTask) fabNewTask.addEventListener('click', () => alert("Redirigiendo a nueva tarea..."));
    if (fabNewBitacora) fabNewBitacora.addEventListener('click', () => alert("Creando registro en bitácora..."));
    if (fabNewMaterial) fabNewMaterial.addEventListener('click', () => alert("Nueva solicitud de materiales..."));
    if (fabNewCliente) {
        fabNewCliente.addEventListener('click', () => {
            if (modalCliente) modalCliente.classList.remove('hidden');
        });
    }
    if (btnCancelModalCliente) btnCancelModalCliente.addEventListener('click', () => modalCliente.classList.add('hidden'));

    // --- MENÚ HEADER & PERFIL ---
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

    const formEmpresa = document.getElementById('form-empresa');
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
            alert("¡Datos de empresa guardados con éxito!");
        });
    }

    // --- INICIALIZACIÓN ---
    function initAppAfterLogin() {
        loadTasks();
        loadBitacora();
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

    // --- CARGAS BÁSICAS ---
    async function loadTasks() {
        const c = document.getElementById('tasks-container');
        if (!c) return;
        const { data } = await supabaseClient.from('tareas').select('*').order('completada', { ascending: true });
        allTasks = data || [];
        c.innerHTML = allTasks.length === 0 ? '<p class="text-slate-500 text-center mt-4">No hay tareas.</p>' : allTasks.map(t => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">${t.tarea}</h3></div>`).join('');
    }

    async function loadBitacora() {
        if (!bitacoraContainer) return;
        const { data } = await supabaseClient.from('bitacora').select('*').order('created_at', { ascending: false });
        allBitacora = data || [];
        bitacoraContainer.innerHTML = allBitacora.length === 0 ? '<p class="text-slate-500 text-center mt-4">No hay registros.</p>' : allBitacora.map(b => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><p class="text-sm">${b.notas || 'Sin notas'}</p></div>`).join('');
    }

    async function loadMaterialesSolicitudes() {
        if (!materialesContainer) return;
        const { data } = await supabaseClient.from('materiales_solicitudes').select('*');
        materialesContainer.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay solicitudes de materiales.</p>' : data.map(m => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">${m.cliente} - ${m.obra}</h3></div>`).join('');
    }

    async function loadClientes() {
        if (!clientesContainer) return;
        const { data } = await supabaseClient.from('clientes').select('*').order('nombre_cliente', { ascending: true });
        clientesContainer.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay clientes.</p>' : data.map(cl => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-bold">${cl.nombre_cliente}</h3></div>`).join('');
    }

    async function loadEmpleados() {
        if (!empleadosContainer) return;
        const { data } = await supabaseClient.from('perfiles').select('*').order('nombre', { ascending: true });
        empleadosContainer.innerHTML = (!data || data.length === 0) ? '<p class="text-slate-500 text-center mt-4">No hay empleados.</p>' : data.map(emp => `<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><h3 class="font-medium">${emp.nombre} ${emp.apellido} (${emp.rol})</h3></div>`).join('');
    }
})();
