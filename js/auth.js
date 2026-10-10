// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const formAuth = document.getElementById('form-auth');
    const btnToggleAuth = document.getElementById('btn-toggle-auth');
    const registerFields = document.getElementById('register-fields');
    const authTitle = document.getElementById('auth-title');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const authError = document.getElementById('auth-error');
    const authSuccess = document.getElementById('auth-success');
    
    let isLoginMode = true;

    checkSession();

    btnToggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if(isLoginMode) {
            registerFields.classList.add('hidden');
            authTitle.textContent = "Iniciar Sesión";
            btnAuthSubmit.textContent = "Ingresar";
            btnToggleAuth.textContent = "¿No tienes cuenta? Regístrate aquí";
            document.getElementById('auth-nombre').removeAttribute('required');
            document.getElementById('auth-apellido').removeAttribute('required');
        } else {
            registerFields.classList.remove('hidden');
            registerFields.classList.add('flex');
            authTitle.textContent = "Registrar Operario";
            btnAuthSubmit.textContent = "Crear Cuenta";
            btnToggleAuth.textContent = "Ya tengo cuenta, iniciar sesión";
            document.getElementById('auth-nombre').setAttribute('required', 'true');
            document.getElementById('auth-apellido').setAttribute('required', 'true');
        }
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
    });

    formAuth.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        authError.classList.add('hidden');
        authSuccess.classList.add('hidden');
        btnAuthSubmit.disabled = true;
        btnAuthSubmit.textContent = "Cargando...";

        if (isLoginMode) {
            // LOGIN (Actualizado a supabaseClient)
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                showError("Correo o contraseña incorrectos.");
            } else {
                await verifyProfileAndEnter(data.user);
            }
        } else {
            // REGISTRO (Actualizado a supabaseClient)
            const nombre = document.getElementById('auth-nombre').value.trim();
            const apellido = document.getElementById('auth-apellido').value.trim();
            
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) {
                showError(error.message);
                return;
            }

            const username = await generarUsername(nombre, apellido);

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
                showError("Error al guardar el perfil: " + profileError.message);
            } else {
                authSuccess.textContent = "Cuenta creada con éxito. Espera a que el Administrador te apruebe.";
                authSuccess.classList.remove('hidden');
                formAuth.reset();
                await supabaseClient.auth.signOut();
            }
        }
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = isLoginMode ? "Ingresar" : "Crear Cuenta";
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });

    async function checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await verifyProfileAndEnter(session.user);
        } else {
            document.getElementById('view-auth').classList.remove('hidden');
        }
    }

    async function verifyProfileAndEnter(user) {
        const { data: perfil, error } = await supabaseClient.from('perfiles').select('*').eq('id', user.id).single();
        
        if (error || !perfil) {
            showError("No se encontró tu perfil. Contacta al administrador.");
            await supabaseClient.auth.signOut();
            return;
        }

        if (perfil.activo === false) {
            showError("Tu cuenta está pendiente de aprobación por el Administrador.");
            await supabaseClient.auth.signOut();
            return;
        }

        window.currentUserProfile = perfil; 
        
        document.getElementById('view-auth').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('app-header').classList.remove('hidden');
        document.getElementById('app-header').classList.add('flex');
        document.getElementById('bottom-nav').classList.remove('hidden');
        document.getElementById('bottom-nav').classList.add('flex');
        
        document.getElementById('user-role-badge').textContent = perfil.rol;

        if (perfil.rol === 'Admin' || perfil.rol === 'SuperAdmin') {
            document.getElementById('fab-new-task').classList.remove('hidden');
            document.getElementById('fab-new-task').classList.add('flex');
            document.getElementById('nav-empleados').classList.remove('hidden');
            document.getElementById('nav-empleados').classList.add('flex');
        }

        window.dispatchEvent(new Event('userLoggedIn'));
    }

    async function generarUsername(nombre, apellido) {
        let base = (nombre + apellido).replace(/\s+/g, '');
        let usernameFinal = base;
        let contador = 2;
        let existe = true;

        while (existe) {
            const { data } = await supabaseClient.from('perfiles').select('username').eq('username', usernameFinal);
            if (data.length === 0) {
                existe = false;
            } else {
                usernameFinal = base + contador;
                contador++;
            }
        }
        return usernameFinal;
    }

    function showError(msg) {
        authError.textContent = msg;
        authError.classList.remove('hidden');
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = isLoginMode ? "Ingresar" : "Crear Cuenta";
    }
});
