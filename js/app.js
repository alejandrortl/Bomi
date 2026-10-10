// js/app.js

// Definición de todas las secciones de la App
const SECTIONS = [
    { id: 'diario', name: 'Diario', icon: 'view_agenda', file: 'components/diario.html' },
    { id: 'partes', name: 'Partes', icon: 'assignment', file: 'components/partes.html' },
    { id: 'material', name: 'Material', icon: 'inventory_2', file: 'components/material.html' },
    { id: 'bitacora', name: 'Bitácora', icon: 'book', file: 'components/bitacora.html' },
    { id: 'clientes', name: 'Clientes', icon: 'contacts', file: 'components/clientes.html' },
    { id: 'equipo', name: 'Equipo', icon: 'groups', file: 'components/equipo.html' }
];

document.addEventListener('DOMContentLoaded', async () => {
    // Comprobar sesión usando la función de auth.js
    const session = await checkSession(); 

    if (!session) {
        // No hay sesión: cargar vista de Login
        await loadView('components/login.html');
        setupLoginForm();
    } else {
        // Hay sesión: configurar UI y cargar la primera pantalla
        setupAuthenticatedUI();
        navigateTo('diario'); // Pantalla inicial por defecto
    }
});

// Configura la interfaz principal (barras y menús) una vez logueado
function setupAuthenticatedUI() {
    document.getElementById('topbar').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    
    // Inyectar Botón de Cerrar Sesión en el menú superior derecho
    const userMenu = document.getElementById('user-menu-container');
    userMenu.innerHTML = `
        <button onclick="logoutUser()" class="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800 transition-colors">
            <span class="material-symbols-outlined">logout</span> Salir
        </button>
    `;

    // Inyectar botones en la navegación inferior dinámicamente
    const bottomNav = document.getElementById('bottom-nav');
    bottomNav.innerHTML = '';
    
    SECTIONS.forEach(section => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn flex flex-col items-center justify-center w-full py-2 text-gray-500 hover:text-[#6750a4] transition-colors';
        btn.id = `nav-${section.id}`;
        btn.onclick = () => navigateTo(section.id);
        
        btn.innerHTML = `
            <span class="material-symbols-outlined rounded-full px-4 py-1 mb-1 transition-all duration-300">${section.icon}</span>
            <span class="text-[10px] font-medium tracking-wide">${section.name}</span>
        `;
        bottomNav.appendChild(btn);
    });
}

// Navegador principal: cambia de sección e inyecta la vista
async function navigateTo(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    // Actualizar Título e Icono Superior
    const logoContainer = document.getElementById('logo-container');
    logoContainer.innerHTML = `
        <span class="material-symbols-outlined text-[#6750a4] text-3xl">${section.icon}</span>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">${section.name}</h1>
    `;

    // Cargar el HTML de la vista
    await loadView(section.file);

    // --- Inicializador dinámico de scripts por sección ---
    if (sectionId === 'diario' && typeof initDiario === 'function') {
        initDiario();
    }
    // Aquí añadiremos los de las demás secciones según las vayamos creando:
    // else if (sectionId === 'partes' && typeof initPartes === 'function') { initPartes(); }
    // else if (sectionId === 'material' && typeof initMaterial === 'function') { initMaterial(); }
    // -----------------------------------------------------

    // Actualizar estado visual del menú inferior (Material Design 3 Active State)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const iconSpan = btn.querySelector('.material-symbols-outlined');
        if (btn.id === `nav-${sectionId}`) {
            btn.classList.add('text-[#1d1b20]', 'dark:text-white');
            btn.classList.remove('text-gray-500');
            iconSpan.classList.add('bg-[#eaddff]', 'text-[#21005d]', 'dark:bg-[#4f378b]', 'dark:text-[#eaddff]');
            iconSpan.style.fontVariationSettings = "'FILL' 1"; // Icono relleno
        } else {
            btn.classList.remove('text-[#1d1b20]', 'dark:text-white');
            btn.classList.add('text-gray-500');
            iconSpan.classList.remove('bg-[#eaddff]', 'text-[#21005d]', 'dark:bg-[#4f378b]', 'dark:text-[#eaddff]');
            iconSpan.style.fontVariationSettings = "'FILL' 0"; // Icono delineado
        }
    });
}

// Inyector HTML central
async function loadView(viewPath) {
    const appContent = document.getElementById('app-content');
    // Indicador de carga
    appContent.innerHTML = '<div class="flex justify-center mt-10"><span class="material-symbols-outlined animate-spin text-4xl text-[#6750a4]">sync</span></div>';
    try {
        const response = await fetch(viewPath);
        if (!response.ok) throw new Error('Vista no encontrada');
        appContent.innerHTML = await response.text();
    } catch (error) {
        appContent.innerHTML = `<p class="text-center text-red-500 mt-10">Error cargando la vista: ${error.message}</p>`;
    }
}

// Lógica de validación del formulario de Login
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin align-middle mr-2">sync</span> Cargando...';
        errorMsg.classList.add('hidden');

        // loginUser viene de auth.js
        const result = await loginUser(email, password);

        if (result.success) {
            window.location.reload(); // Recargar para mostrar la interfaz principal
        } else {
            errorMsg.textContent = 'Credenciales incorrectas o error de conexión.';
            errorMsg.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Entrar';
        }
    });
}