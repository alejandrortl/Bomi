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

    // Crear dinámicamente el botón de "Volver atrás" dentro del formulario de registro
    const backButtonContainer = document.createElement('div');
    backButtonContainer.id = 'back-login-container';
    backButtonContainer.className = 'hidden flex flex-col gap-2 mt-1';
    backButtonContainer.innerHTML = `
        <button type="button" id="btn-back-login" class="w-full py-2.5 rounded-full font-medium text-sm border border-outline-variant text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span> Volver a Iniciar Sesión
        </button>
    `;
    formAuth.insertBefore(backButtonContainer, btnAuthSubmit);

    const btnBackLogin = document.getElementById('btn-back-login');

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
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
        formAuth.reset();

        if (isRegistering) {
            authTitle.textContent = "Registro de Operario";
            authSubtitle.textContent = "Crea tu cuenta para solicitar acceso";
            btnAuthSubmit.textContent = "Registrarse";
            btnToggleAuth.classList.add('hidden'); // Ocultar el texto inferior para evitar redundancia
            registerFields.classList.remove('hidden');
            registerFields.classList.add('flex');
            backButtonContainer.classList.remove('hidden');
            backButtonContainer.classList.add('flex');
            authNombre.required = true;
            authApellido.required = true;
        } else {
            authTitle.textContent = "Iniciar Sesión";
            authSubtitle.textContent = "Acceso para operarios";
            btnAuthSubmit.textContent = "Ingresar";
            btnToggleAuth.classList.remove('hidden');
            registerFields.classList.add('hidden');
            registerFields.classList.remove('flex');
            backButtonContainer.classList.add('hidden');
            backButtonContainer.classList.remove('flex');
            authNombre.required = false;
            authApellido.required = false;
        }
    }

    if (formAuth) {
        formAuth.addEventListener('submit', async (e) => {
            e.preventDefault();
            authError.classList.add('hidden');
            authSuccess.classList.add('hidden');
            btnAuthSubmit.disabled = true;

            const email = authEmail.value.trim();
            const password = authPassword.value;

            if (isRegistering) {
                const nombre = authNombre.value.trim();
                const apellido = authApellido.value.trim();
                const username = email.split('@')[0].toLowerCase();

                btnAuthSubmit.textContent = "Registrando...";
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                
                if (error) {
                    authError.textContent = error.message;
                    authError.classList.remove('hidden');
                    btnAuthSubmit.disabled = false;
                    btnAuthSubmit.textContent = "Registrarse";
                    return;
                }

                if (data && data.user) {
                    const { error: profileError } = await supabaseClient.from('perfiles').insert([{
                        id: data.user.id,
                        email: email,
                        nombre: nombre,
                        apellido: apellido,
                        username: username,
                        rol: 'Operario',
                        activo: false
                    }]);

                    if (profileError) {
                        authError.textContent = "Error al crear perfil: " + profileError.message;
                        authError.classList.remove('hidden');
                        btnAuthSubmit.disabled = false;
                        btnAuthSubmit.textContent = "Registrarse";
                        return;
                    }

                    const { data: admins } = await supabaseClient
                        .from('perfiles')
                        .select('id')
                        .in('rol', ['Admin', 'SuperAdmin']);

                    if (admins && admins.length > 0) {
                        const notifInserts = admins.map(adm => ({
                            user_id: adm.id,
                            titulo: 'Nuevo Registro Pendiente',
                            mensaje: `${nombre} ${apellido} (@${username}) se ha registrado y requiere aprobación.`
                        }));
                        await supabaseClient.from('notificaciones').insert(notifInserts);
                    }

                    authSuccess.textContent = "¡Registro exitoso! Tu cuenta está pendiente de aprobación.";
                    authSuccess.classList.remove('hidden');
                    formAuth.reset();
                    btnAuthSubmit.disabled = false;
                    btnAuthSubmit.textContent = "Registrarse";
                }
            } else {
                btnAuthSubmit.textContent = "Ingresando...";
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                
                if (error) {
                    authError.textContent = error.message;
                    authError.classList.remove('hidden');
                    btnAuthSubmit.disabled = false;
                    btnAuthSubmit.textContent = "Ingresar";
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
            authError.textContent = "No se encontró el perfil de usuario.";
            authError.classList.remove('hidden');
            await supabaseClient.auth.signOut();
            btnAuthSubmit.disabled = false;
            btnAuthSubmit.textContent = "Ingresar";
            return;
        }

        if (!profile.activo) {
            authError.textContent = "Tu cuenta está pendiente de aprobación por un administrador.";
            authError.classList.remove('hidden');
            await supabaseClient.auth.signOut();
            btnAuthSubmit.disabled = false;
            btnAuthSubmit.textContent = "Ingresar";
            return;
        }

        window.currentUserProfile = profile;
        showAppInterface();
    }

    function showAppInterface() {
        if (viewAuth) viewAuth.classList.add('hidden');
        if (appHeader) {
            appHeader.classList.remove('hidden');
            appHeader.classList.add('flex');
        }
        if (mainContent) mainContent.classList.remove('hidden');
        if (bottomNav) {
            bottomNav.classList.remove('hidden');
            bottomNav.classList.add('flex');
        }

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
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            await checkUserProfileAndLogin(session.user.id);
        }
    }

    checkExistingSession();
});
