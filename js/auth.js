// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const btnLogout = document.getElementById('btn-logout');
    const loginView = document.getElementById('view-login');
    const mainContent = document.getElementById('main-content');
    const appHeader = document.getElementById('app-header');
    const bottomNav = document.getElementById('bottom-nav');
    const fabNewTask = document.getElementById('fab-new-task');
    const loginError = document.getElementById('login-error');

    // Comprobar si ya hay una sesión iniciada al abrir la app
    checkSession();

    // Listener del formulario de login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        loginError.classList.add('hidden');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            loginError.textContent = "Correo o contraseña incorrectos.";
            loginError.classList.remove('hidden');
        } else {
            showApp(data.user);
        }
    });

    // Listener para cerrar sesión
    btnLogout.addEventListener('click', async () => {
        await supabase.auth.signOut();
        showLogin();
    });

    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showApp(session.user);
        } else {
            showLogin();
        }
    }

    function showApp(user) {
        // Guardamos el usuario globalmente para usarlo en app.js
        window.currentUser = user; 
        
        loginView.classList.add('hidden');
        mainContent.classList.remove('hidden');
        appHeader.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        fabNewTask.classList.remove('hidden');
        appHeader.classList.add('flex');
        
        // Disparamos un evento para avisarle a app.js que cargue los datos
        window.dispatchEvent(new Event('userLoggedIn'));
    }

    function showLogin() {
        window.currentUser = null;
        loginView.classList.remove('hidden');
        mainContent.classList.add('hidden');
        appHeader.classList.add('hidden');
        bottomNav.classList.add('hidden');
        fabNewTask.classList.add('hidden');
        appHeader.classList.remove('flex');
    }
});
