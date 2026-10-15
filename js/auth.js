// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const viewAuth = document.getElementById('view-auth');
    const mainContent = document.getElementById('main-content');
    const appHeader = document.getElementById('app-header');
    const bottomNav = document.getElementById('bottom-nav');
    
    const formAuth = document.getElementById('form-auth');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const btnToggleAuth = document.getElementById('btn-toggle-auth');
    const btnBackLogin = document.getElementById('btn-back-login');
    const registerFields = document.getElementById('register-fields');
    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');
    
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authNombre = document.getElementById('auth-nombre');
    const authApellido = document.getElementById('auth-apellido');
    
    const userRoleBadge = document.getElementById('user-role-badge');
    const btnLogout = document.getElementById('btn-logout');

    let isRegistering = false;

    if (btnToggleAuth) {
        btnToggleAuth.addEventListener('click', () => {
            toggleAuthMode(true);
        });
    }

    if (btnBackLogin) {
        btnBackLogin.addEventListener('click', () => {
            toggleAuthMode(false);
        });
    }

    function toggleAuthMode(registering) {
        isRegistering = registering;
        if (authError) authError.classList.add('hidden');
        if (authSuccess) authSuccess.classList.add('hidden');
        if (formAuth) formAuth.reset();

        if (isRegistering) {
            if (authTitle) authTitle.textContent = "Registro de Operario";
            if (authSubtitle) authSubtitle.textContent = "Crea tu cuenta para solicitar acceso";
            if (btnAuthSubmit) btnAuthSubmit.textContent = "Registrarse";
            if (btnToggleAuth) btnToggleAuth.classList.add('hidden'); 
            const btnOlvide = document.getElementById('btn-olvide'); if (btnOlvide) btnOlvide.classList.add('hidden');
            if (registerFields) { registerFields.classList.remove('hidden'); registerFields.classList.add('flex'); }
            if (btnBackLogin) { btnBackLogin.classList.remove('hidden'); btnBackLogin.classList.add('flex'); }
            if (authNombre) authNombre.required = true;
            if (authApellido) authApellido.required = true;
        } else {
            if (authTitle) authTitle.textContent = "Iniciar Sesión";
            if (authSubtitle) authSubtitle.textContent = "Acceso para operarios";
            if (btnAuthSubmit) btnAuthSubmit.textContent = "Ingresar";
            if (btnToggleAuth) btnToggleAuth.classList.remove('hidden');
            const btnOlvide = document.getElementById('btn-olvide'); if (btnOlvide) btnOlvide.classList.remove('hidden');
            if (registerFields) { registerFields.classList.add('hidden'); registerFields.classList.remove('flex'); }
            if (btnBackLogin) { btnBackLogin.classList.add('hidden'); btnBackLogin.classList.remove('flex'); }
            if (authNombre) authNombre.required = false;
            if (authApellido) authApellido.required = false;
        }
    }

    if (formAuth) {
        formAuth.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authError) authError.classList.add('hidden');
            if (authSuccess) authSuccess.classList.add('hidden');
            if (btnAuthSubmit) btnAuthSubmit.disabled = true;

            const email = authEmail.value.trim();
            const password = authPassword.value;

            if (isRegistering) {
                const nombre = authNombre.value.trim();
                const apellido = authApellido.value.trim();
                const username = email.split('@')[0].toLowerCase();

                if (btnAuthSubmit) btnAuthSubmit.textContent = "Registrando...";
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                
                if (error) {
                    if (authError) { authError.textContent = error.message; authError.classList.remove('hidden'); }
                    if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Registrarse"; }
                    return;
                }

                if (data && data.user) {
                    await supabaseClient.from('perfiles').insert([{
                        id: data.user.id,
                        email: email,
                        nombre: nombre,
                        apellido: apellido,
                        username: username,
                        rol: 'Operario',
                        activo: false
                    }]);

                    if (authSuccess) {
                        authSuccess.textContent = "¡Registro exitoso! Cuenta pendiente de aprobación.";
                        authSuccess.classList.remove('hidden');
                    }
                    if (formAuth) formAuth.reset();
                    if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Registrarse"; }
                }
            } else {
                if (btnAuthSubmit) btnAuthSubmit.textContent = "Ingresando...";
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                
                if (error) {
                    if (authError) { authError.textContent = error.message; authError.classList.remove('hidden'); }
                    if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Ingresar"; }
                    return;
                }

                if (data && data.user) {
                    await checkUserProfileAndLogin(data.user.id);
                }
            }
        });
    }

    async function checkUserProfileAndLogin(userId) {
        const { data: profile, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            if (authError) { authError.textContent = "No se encontró el perfil de usuario."; authError.classList.remove('hidden'); }
            await supabaseClient.auth.signOut();
            if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Ingresar"; }
            return;
        }

        if (profile.en_papelera === true) {
            if (authError) { authError.textContent = "Tu cuenta está desactivada. Contacta con un administrador."; authError.classList.remove('hidden'); }
            await supabaseClient.auth.signOut();
            if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Ingresar"; }
            return;
        }

        if (!profile.activo) {
            if (authError) { authError.textContent = "Tu cuenta está pendiente de aprobación."; authError.classList.remove('hidden'); }
            await supabaseClient.auth.signOut();
            if (btnAuthSubmit) { btnAuthSubmit.disabled = false; btnAuthSubmit.textContent = "Ingresar"; }
            return;
        }

        window.currentUserProfile = profile;
        showAppInterface();
    }

    // Si un administrador cambia el rol de alguien mientras tiene la app abierta, el perfil en memoria se queda viejo.
    // Esto lo vuelve a leer (al volver a la app y antes de acciones de administrador) y actualiza la etiqueta de rol.
    let perfilLeidoEn = 0;
    window.refrescarPerfil = async function (forzar) {
        const yo = window.currentUserProfile;
        if (!yo || !yo.id) return yo;
        if (!forzar && Date.now() - perfilLeidoEn < 15000) return yo;
        try {
            const { data } = await supabaseClient.from('perfiles').select('*').eq('id', yo.id).single();
            perfilLeidoEn = Date.now();
            if (data && data.activo !== false) {
                window.currentUserProfile = data;
                if (userRoleBadge) userRoleBadge.textContent = data.rol;
                if (data.rol !== yo.rol) window.dispatchEvent(new CustomEvent('rolActualizado'));
            }
        } catch (e) { /* sin conexión: se sigue con lo que hay */ }
        return window.currentUserProfile;
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) window.refrescarPerfil(); });

    function showAppInterface() {
        if (viewAuth) viewAuth.classList.add('hidden');
        if (appHeader) { appHeader.classList.remove('hidden'); appHeader.classList.add('flex'); }
        if (mainContent) mainContent.classList.remove('hidden');
        if (bottomNav) { bottomNav.classList.remove('hidden'); bottomNav.classList.add('flex'); }

        if (userRoleBadge && window.currentUserProfile) {
            userRoleBadge.textContent = window.currentUserProfile.rol;
        }

        window.dispatchEvent(new CustomEvent('userLoggedIn'));
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.currentUserProfile = null;
            location.reload();
        });
    }

    async function checkExistingSession() {
        // Llegó desde el enlace de "olvidé mi contraseña": primero debe crear la nueva, no entrar directamente.
        if (window.__recuperacion && (window.__recuperacion.modo || window.__recuperacion.error)) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            await checkUserProfileAndLogin(session.user.id);
        }
    }

    checkExistingSession();
});
