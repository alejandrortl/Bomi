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

    // Declaraciones corregidas
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
    const modalDetalle = document.getElementById('modal-detalle-tarea');
    const detalleContenido = document.getElementById('detalle-contenido');
    const btnCloseDetalle = document.getElementById('btn-close-detalle');

    let allTasks = [];
    let allBitacora = [];
    let allMaterialesSolicitudes = [];
    let allMaterialesCatalogo = [];
    let allClientesCompletos = [];
    let allEmpleados = [];
    let currentMaterialItem = null;

    // --- MODO CLARO / OSCURO ---
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
        
        if (navHome) navHome.classList.remove('text-blue-600', 'dark:text-blue-400');
        if (navBitacora) navBitacora.classList.remove('text-blue-600', 'dark:text-blue-400');
        if (navMateriales) navMateriales.classList.remove('text-blue-600', 'dark:text-blue-400');
        if (navClientes) navClientes.classList.remove('text-blue-600', 'dark:text-blue-400');
        if (navEmpleados) navEmpleados.classList.remove('text-blue-600', 'dark:text-blue-400');
        
        if (fabNewTask) fabNewTask.classList.add('hidden');
        if (fabNewBitacora) fabNewBitacora.classList.add('hidden');
        if (fabNewMaterial) fabNewMaterial.classList.add('hidden');
        if (fabNewCliente) fabNewCliente.classList.add('hidden');
    }

    // --- NAVEGACIÓN INFERIOR ---
    if (navHome) navHome.addEventListener('click', () => { hideAllViews(); viewTaskList.classList.remove('hidden'); navHome.classList.add('text-blue-600', 'dark:text-blue-400'); fabNewTask.classList.remove('hidden'); fabNewTask.classList.add('flex'); loadTasks(); });
    if (navBitacora) navBitacora.addEventListener('click', () => { hideAllViews(); viewBitacora.classList.remove('hidden'); viewBitacora.classList.add('flex'); navBitacora.classList.add('text-blue-600', 'dark:text-blue-400'); fabNewBitacora.classList.remove('hidden'); fabNewBitacora.classList.add('flex'); loadBitacora(); });
    if (navMateriales) navMateriales.addEventListener('click', () => { hideAllViews(); viewMateriales.classList.remove('hidden'); viewMateriales.classList.add('flex'); navMateriales.classList.add('text-blue-600', 'dark:text-blue-400'); fabNewMaterial.classList.remove('hidden'); fabNewMaterial.classList.add('flex'); loadMaterialesSolicitudes(); });
    if (navClientes) navClientes.addEventListener('click', () => { hideAllViews(); viewClientes.classList.remove('hidden'); viewClientes.classList.add('flex'); navClientes.classList.add('text-blue-600', 'dark:text-blue-400'); fabNewCliente.classList.remove('hidden'); fabNewCliente.classList.add('flex'); loadClientes(); });
    if (navEmpleados) navEmpleados.addEventListener('click', () => { hideAllViews(); viewEmpleados.classList.remove('hidden'); viewEmpleados.classList.add('flex'); navEmpleados.classList.add('text-blue-600', 'dark:text-blue-400'); loadEmpleados(); });

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
                document.getElementById('perfil-nombre').value = window.currentUserProfile.nombre ||
