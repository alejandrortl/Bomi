// js/modules/recuperar.js
// "He olvidado mi contraseña": pide un enlace por correo y, al volver con él, deja crear una contraseña nueva.
// Debe cargarse ANTES de supabase-config.js y auth.js: lee la URL antes de que supabase-js la limpie
// y marca window.__recuperacion para que auth.js no inicie sesión automáticamente con la sesión de recuperación.
(function () {
    'use strict';

    // ---------- Lectura temprana de la URL ----------
    const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const consulta = new URLSearchParams(location.search || '');
    const errorUrl = params.get('error_description') || consulta.get('error_description') || '';
    window.__recuperacion = {
        modo: params.get('type') === 'recovery' && !!params.get('access_token'),
        error: errorUrl ? errorUrl.replace(/\+/g, ' ') : '',
    };
    const MIN = 6;
    const ESPERA_S = 60;

    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const BTN = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full py-3 rounded-full font-medium shadow-md transition-colors';
    let seccion = null;
    let esperaTimer = null;

    const mostrar = (el) => { el.classList.remove('hidden'); el.classList.add('flex'); };
    const ocultarEl = (el) => { el.classList.add('hidden'); el.classList.remove('flex'); };
    function msg(texto, ok) {
        const p = seccion.querySelector('#rec-msg');
        p.textContent = texto || '';
        p.className = texto ? 'text-sm text-center rounded-xl p-3 ' + (ok ? 'text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950') : 'hidden';
    }

    function traducir(m) {
        const t = String(m || '').toLowerCase();
        if (t.includes('rate limit') || t.includes('too many') || t.includes('seconds')) return 'Has pedido demasiados enlaces seguidos. Espera unos minutos e inténtalo de nuevo.';
        if (t.includes('different from the old')) return 'La nueva contraseña debe ser distinta de la anterior.';
        if (t.includes('weak') || t.includes('at least') || t.includes('too short')) return `La contraseña es demasiado débil o corta. Usa al menos ${MIN} caracteres.`;
        if (t.includes('expired') || t.includes('invalid') || t.includes('session')) return 'El enlace ha caducado o ya se usó. Pide uno nuevo.';
        return m || 'Ha ocurrido un error inesperado.';
    }

    // ---------- Pantallas ----------
    function pantallaPedir() {
        seccion.querySelector('#rec-contenido').innerHTML = `
            <div class="text-center">
                <span class="material-symbols-outlined text-5xl text-blue-600 dark:text-blue-400 mb-2">lock_reset</span>
                <h2 class="text-2xl font-semibold">Recuperar contraseña</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
            </div>
            <form id="form-recuperar" class="flex flex-col gap-4" novalidate>
                <div class="flex flex-col gap-1"><label for="rec-email" class="text-xs font-medium">Correo electrónico</label><input id="rec-email" type="email" required autocomplete="email" class="${INPUT}"></div>
                <p id="rec-msg" class="hidden" role="status"></p>
                <button type="submit" id="rec-enviar" class="${BTN}">Enviar enlace</button>
                <button type="button" id="rec-volver" class="w-full py-3 rounded-full font-medium text-sm border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-2"><span class="material-symbols-outlined text-[18px]">arrow_back</span> Volver</button>
            </form>`;
        seccion.querySelector('#form-recuperar').addEventListener('submit', enviarEnlace);
        seccion.querySelector('#rec-volver').addEventListener('click', volverAlLogin);
        const mailLogin = document.getElementById('auth-email');
        if (mailLogin && mailLogin.value) seccion.querySelector('#rec-email').value = mailLogin.value;
        seccion.querySelector('#rec-email').focus();
    }

    function pantallaNueva() {
        seccion.querySelector('#rec-contenido').innerHTML = `
            <div class="text-center">
                <span class="material-symbols-outlined text-5xl text-blue-600 dark:text-blue-400 mb-2">password</span>
                <h2 class="text-2xl font-semibold">Crea tu nueva contraseña</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Escríbela dos veces para asegurarte de que está bien.</p>
            </div>
            <form id="form-nueva" class="flex flex-col gap-4" novalidate>
                <div class="flex flex-col gap-1"><label for="rec-nueva" class="text-xs font-medium">Nueva contraseña</label><input id="rec-nueva" type="password" required autocomplete="new-password" class="${INPUT}"></div>
                <div class="flex flex-col gap-1"><label for="rec-repite" class="text-xs font-medium">Repite la nueva contraseña</label><input id="rec-repite" type="password" required autocomplete="new-password" class="${INPUT}"></div>
                <p id="rec-msg" class="hidden" role="status"></p>
                <button type="submit" id="rec-guardar" class="${BTN}">Guardar contraseña</button>
            </form>`;
        seccion.querySelector('#form-nueva').addEventListener('submit', guardarNueva);
        seccion.querySelector('#rec-nueva').focus();
    }

    function pantallaError(texto) {
        seccion.querySelector('#rec-contenido').innerHTML = `
            <div class="text-center">
                <span class="material-symbols-outlined text-5xl text-red-600 mb-2">link_off</span>
                <h2 class="text-2xl font-semibold">Enlace no válido</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${esc(texto)}</p>
            </div>
            <button type="button" id="rec-otro" class="${BTN}">Pedir un enlace nuevo</button>`;
        seccion.querySelector('#rec-otro').addEventListener('click', () => { limpiarUrl(); pantallaPedir(); });
    }

    // ---------- Acciones ----------
    function limpiarUrl() {
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* sin historial */ }
    }

    function abrirRecuperar() {
        ocultarEl(document.getElementById('view-auth'));
        mostrar(seccion);
        pantallaPedir();
    }

    function volverAlLogin() {
        ocultarEl(seccion);
        mostrar(document.getElementById('view-auth'));
    }

    async function enviarEnlace(e) {
        e.preventDefault();
        const btn = seccion.querySelector('#rec-enviar');
        const email = seccion.querySelector('#rec-email').value.trim();
        msg('');
        if (!/^\S+@\S+\.\S+$/.test(email)) { msg('Escribe un correo válido.', false); return; }
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) {
            msg(traducir(error.message), false);
            btn.disabled = false;
            btn.textContent = 'Enviar enlace';
            return;
        }
        // Mensaje igual exista o no la cuenta: no revela qué correos están registrados.
        msg('Si ese correo está registrado, recibirás un enlace en unos minutos. Revisa también la carpeta de spam.', true);
        let restante = ESPERA_S;
        clearInterval(esperaTimer);
        const pintar = () => { btn.textContent = restante > 0 ? `Reenviar en ${restante} s` : 'Enviar enlace'; };
        pintar();
        esperaTimer = setInterval(() => {
            restante--;
            pintar();
            if (restante <= 0) { clearInterval(esperaTimer); btn.disabled = false; }
        }, 1000);
    }

    async function guardarNueva(e) {
        e.preventDefault();
        const btn = seccion.querySelector('#rec-guardar');
        const nueva = seccion.querySelector('#rec-nueva').value;
        const repite = seccion.querySelector('#rec-repite').value;
        msg('');
        if (nueva.length < MIN) { msg(`La contraseña debe tener al menos ${MIN} caracteres.`, false); return; }
        if (nueva !== repite) { msg('Las contraseñas no coinciden.', false); return; }
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            const { data } = await supabaseClient.auth.getSession();
            if (!data || !data.session) throw new Error('session missing');
            const { error } = await supabaseClient.auth.updateUser({ password: nueva });
            if (error) throw error;
            await supabaseClient.auth.signOut();
            window.__recuperacion.modo = false;
            limpiarUrl();
            volverAlLogin();
            const ok = document.getElementById('auth-success');
            if (ok) { ok.textContent = 'Contraseña cambiada. Ya puedes iniciar sesión con la nueva.'; ok.classList.remove('hidden'); }
        } catch (ex) {
            msg(traducir(ex.message), false);
            btn.disabled = false;
            btn.textContent = 'Guardar contraseña';
        }
    }

    // ---------- Montaje ----------
    document.addEventListener('DOMContentLoaded', () => {
        const auth = document.getElementById('view-auth');
        if (!auth) return;
        auth.insertAdjacentHTML('afterend', `
            <main id="view-recuperar" class="hidden flex-1 flex-col items-center justify-center p-6 w-full max-w-md mx-auto overflow-y-auto">
                <div id="rec-contenido" class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-8 rounded-3xl shadow-lg w-full flex flex-col gap-6"></div>
            </main>`);
        seccion = document.getElementById('view-recuperar');
        const enlace = document.getElementById('btn-olvide');
        if (enlace) enlace.addEventListener('click', abrirRecuperar);

        if (window.__recuperacion.modo) {
            ocultarEl(auth);
            mostrar(seccion);
            pantallaNueva();
        } else if (window.__recuperacion.error) {
            ocultarEl(auth);
            mostrar(seccion);
            pantallaError(traducir(window.__recuperacion.error));
        }
    });
})();
