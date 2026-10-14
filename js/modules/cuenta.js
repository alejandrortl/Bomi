// js/modules/cuenta.js
// Pantallas del menú superior: "Mi Perfil" (todos) y "Logotipo y empresa" (Admin/SuperAdmin).
// Script clásico: expone window.BomiCuenta. Depende de `supabaseClient` y `window.currentUserProfile`.
(function () {
    'use strict';

    const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm';
    const MAX_LOGO = 2 * 1024 * 1024;
    const db = () => supabaseClient;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const yo = () => window.currentUserProfile || null;
    const esAdmin = () => ['admin', 'superadmin'].includes(String(yo()?.rol ?? '').trim().toLowerCase());
    const campo = (id, etiqueta, valor, extra = '') =>
        `<div class="flex flex-col gap-1"><label for="${id}" class="text-xs font-medium">${etiqueta}</label><input id="${id}" value="${esc(valor)}" ${extra} class="${INPUT}"></div>`;
    const solo = (etiqueta, valor) =>
        `<div class="flex flex-col gap-1"><span class="text-xs font-medium">${etiqueta}</span><p class="text-sm text-slate-500 px-1 break-words">${esc(valor || '—')}</p></div>`;
    const cabecera = (icono, titulo) =>
        `<h2 class="text-lg font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-blue-600">${icono}</span> ${titulo}</h2>`;
    const tarjeta = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 flex flex-col gap-4';
    const BTN = 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-full font-medium self-end';

    function mensaje(id, texto, ok) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = texto;
        el.className = 'text-sm rounded-xl p-3 ' + (ok
            ? 'text-emerald-800 bg-emerald-50 dark:text-emerald-200 dark:bg-emerald-950'
            : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950');
    }
    const ocultar = (id) => { const el = document.getElementById(id); if (el) { el.textContent = ''; el.className = 'hidden'; } };

    // ---------- Preferencias de notificaciones ----------
    // Cada tipo se puede desactivar; una clave ausente cuenta como activada.
    const TIPOS_AVISO = [
        { clave: 'aprobaciones', titulo: 'Aprobación de nuevos empleados', desc: 'Cuando alguien se registra y espera aprobación.', soloAdmin: true },
        { clave: 'tareas', titulo: 'Tareas asignadas a mí', desc: 'Cuando alguien me asigna una tarea en el Diario.' },
        { clave: 'material', titulo: 'Solicitudes de material', desc: 'Aún no se envían avisos de este tipo.' },
        { clave: 'generales', titulo: 'Notificaciones generales y personales', desc: 'Aún no se envían avisos de este tipo.' },
    ];

    function htmlPreferencias(p) {
        // Si la base de datos aún no tiene la columna, el perfil no la trae: se muestra bloqueado y se explica.
        const disponible = p.preferencias_notificaciones !== undefined;
        const prefs = (disponible && p.preferencias_notificaciones) || {};
        const filas = TIPOS_AVISO.filter((t) => !t.soloAdmin || esAdmin()).map((t) => `
            <label class="flex items-start justify-between gap-4 cursor-pointer">
                <span class="flex flex-col"><span class="text-sm font-medium">${esc(t.titulo)}</span><span class="text-xs text-slate-500">${esc(t.desc)}</span></span>
                <input type="checkbox" role="switch" data-clave="${t.clave}" ${prefs[t.clave] === false ? '' : 'checked'} ${disponible ? '' : 'disabled'} class="mt-1 w-5 h-5 shrink-0 accent-blue-600">
            </label>`).join('');
        return `
            <form id="form-notif" class="${tarjeta}" onsubmit="return false">
                <h3 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[20px] text-blue-600">notifications</span> Notificaciones que quiero recibir</h3>
                ${filas}
                ${disponible ? '' : '<p class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 rounded-xl p-3">Estas opciones necesitan una actualización de la base de datos que aún no se ha aplicado. Mientras tanto recibes todos los avisos.</p>'}
                <p id="notif-msg" class="hidden" role="status"></p>
            </form>`;
    }

    async function cambiarPreferencia(e) {
        const caja = e.target;
        const clave = caja.dataset && caja.dataset.clave;
        if (!clave) return;
        const p = yo();
        const form = document.getElementById('form-notif');
        const cajas = [...form.querySelectorAll('input[type=checkbox]')];
        const nuevo = { ...(p.preferencias_notificaciones || {}), [clave]: caja.checked };
        ocultar('notif-msg');
        cajas.forEach((c) => { c.disabled = true; });
        try {
            const { data, error } = await db().from('perfiles').update({ preferencias_notificaciones: nuevo }).eq('id', p.id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('No se pudo guardar tu preferencia.');
            p.preferencias_notificaciones = nuevo;
            mensaje('notif-msg', 'Preferencia guardada.', true);
        } catch (ex) {
            caja.checked = !caja.checked;   // vuelve a como estaba
            mensaje('notif-msg', ex.message || 'No se pudo guardar.', false);
        } finally {
            cajas.forEach((c) => { c.disabled = false; });
        }
    }

    // ---------- Mi Perfil ----------
    function abrirPerfil() {
        const p = yo();
        const vista = document.getElementById('view-perfil');
        if (!vista || !p) return;
        vista.innerHTML = `
            ${cabecera('person', 'Mi perfil')}
            <form id="form-perfil" class="${tarjeta}">
                ${campo('perfil-nombre', 'Nombre', p.nombre, 'type="text" required autocomplete="given-name"')}
                ${campo('perfil-apellido', 'Apellido', p.apellido, 'type="text" autocomplete="family-name"')}
                ${campo('perfil-telefono', 'Teléfono', p.telefono, 'type="tel" inputmode="tel" maxlength="15" autocomplete="tel"')}
                ${solo('Correo', p.email)}
                <p id="perfil-msg" class="hidden" role="status"></p>
                <button type="submit" id="perfil-guardar" class="${BTN}">Guardar</button>
            </form>
            ${htmlPreferencias(p)}
            <form id="form-password" class="${tarjeta}" autocomplete="off">
                <h3 class="font-semibold flex items-center gap-2"><span class="material-symbols-outlined text-[20px] text-blue-600">lock</span> Cambiar contraseña</h3>
                ${campo('pass-nueva', 'Nueva contraseña', '', 'type="password" required minlength="6" autocomplete="new-password"')}
                ${campo('pass-repite', 'Repite la nueva contraseña', '', 'type="password" required minlength="6" autocomplete="new-password"')}
                <p id="pass-msg" class="hidden" role="status"></p>
                <button type="submit" id="pass-guardar" class="${BTN}">Cambiar contraseña</button>
            </form>`;
        document.getElementById('form-perfil').addEventListener('submit', guardarPerfil);
        document.getElementById('form-password').addEventListener('submit', cambiarPassword);
        const fn = document.getElementById('form-notif');
        if (fn) fn.addEventListener('change', cambiarPreferencia);
    }

    async function guardarPerfil(e) {
        e.preventDefault();
        const p = yo();
        const btn = document.getElementById('perfil-guardar');
        const cambios = {
            nombre: document.getElementById('perfil-nombre').value.trim(),
            apellido: document.getElementById('perfil-apellido').value.trim(),
            telefono: document.getElementById('perfil-telefono').value.trim(),
        };
        ocultar('perfil-msg');
        if (!cambios.nombre) { mensaje('perfil-msg', 'El nombre es obligatorio.', false); return; }
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            const { data, error } = await db().from('perfiles').update(cambios).eq('id', p.id).select('id');
            if (error) throw error;
            if (!data || !data.length) throw new Error('No se pudo guardar tu perfil.');
            Object.assign(p, cambios);
            mensaje('perfil-msg', 'Cambios guardados.', true);
            window.dispatchEvent(new CustomEvent('perfilActualizado'));
        } catch (ex) {
            mensaje('perfil-msg', ex.message || 'No se pudo guardar.', false);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    function traducirErrorPassword(m) {
        const t = String(m || '').toLowerCase();
        if (t.includes('different from the old')) return 'La nueva contraseña debe ser distinta de la actual.';
        if (t.includes('at least') || t.includes('weak') || t.includes('too short')) return 'La contraseña es demasiado débil o corta. Usa al menos 6 caracteres.';
        if (t.includes('reauth') || t.includes('session') || t.includes('jwt')) return 'Tu sesión ha caducado. Cierra sesión, vuelve a entrar e inténtalo otra vez.';
        return m || 'No se pudo cambiar la contraseña.';
    }

    async function cambiarPassword(e) {
        e.preventDefault();
        const btn = document.getElementById('pass-guardar');
        const nueva = document.getElementById('pass-nueva').value;
        const repite = document.getElementById('pass-repite').value;
        ocultar('pass-msg');
        if (nueva.length < 6) { mensaje('pass-msg', 'La contraseña debe tener al menos 6 caracteres.', false); return; }
        if (nueva !== repite) { mensaje('pass-msg', 'Las contraseñas no coinciden.', false); return; }
        btn.disabled = true;
        btn.textContent = 'Cambiando...';
        try {
            const { error } = await db().auth.updateUser({ password: nueva });
            if (error) throw error;
            document.getElementById('form-password').reset();
            mensaje('pass-msg', 'Contraseña cambiada correctamente.', true);
        } catch (ex) {
            mensaje('pass-msg', traducirErrorPassword(ex.message), false);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Cambiar contraseña';
        }
    }

    // ---------- Logotipo y empresa ----------
    let empresaId = null;
    let logoUrl = '';
    let logoNuevo = null;

    const logoHtml = (url) => url
        ? `<img id="empresa-logo-img" src="${esc(url)}" alt="Logotipo de la empresa" class="max-h-28 max-w-full object-contain rounded-lg bg-white p-2 border border-slate-200 dark:border-zinc-700">`
        : '<p id="empresa-logo-vacio" class="text-sm text-slate-500">Todavía no hay logotipo.</p>';

    async function abrirEmpresa() {
        const vista = document.getElementById('view-empresa');
        if (!vista) return;
        if (!esAdmin()) { vista.innerHTML = `${cabecera('business', 'Logotipo y empresa')}<p class="text-slate-500">Solo un administrador puede ver esta sección.</p>`; return; }
        vista.innerHTML = '<div class="text-center p-4"><span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span></div>';
        const { data, error } = await db().from('configuracion_empresa').select('*').order('id', { ascending: true }).limit(1);
        if (error) { vista.innerHTML = `<p class="text-red-500 text-center">Error al cargar los datos: ${esc(error.message)}</p>`; return; }
        const c = (data && data[0]) || {};
        empresaId = c.id ?? null;
        logoUrl = c.logo_url || '';
        logoNuevo = null;
        vista.innerHTML = `
            ${cabecera('business', 'Logotipo y empresa')}
            <form id="form-empresa" class="${tarjeta}">
                <div class="flex flex-col gap-2">
                    <span class="text-xs font-medium">Logotipo</span>
                    <div id="empresa-logo" class="flex items-center">${logoHtml(logoUrl)}</div>
                    <input id="empresa-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Elegir logotipo" class="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 dark:file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium">
                    <p class="text-xs text-slate-500">PNG, JPG, WebP o SVG, máximo 2 MB.</p>
                </div>
                ${campo('empresa-nombre', 'Nombre de la empresa', c.nombre_fiscal, 'type="text" required')}
                ${campo('empresa-cif', 'CIF / NIF', c.cif, 'type="text"')}
                ${campo('empresa-direccion', 'Dirección', c.direccion, 'type="text"')}
                ${campo('empresa-telefono', 'Teléfono', c.telefono, 'type="text"')}
                ${campo('empresa-email', 'Correo', c.email, 'type="email"')}
                <p id="empresa-msg" class="hidden" role="status"></p>
                <button type="submit" id="empresa-guardar" class="${BTN}">Guardar</button>
            </form>`;
        document.getElementById('empresa-logo-file').addEventListener('change', elegirLogo);
        document.getElementById('form-empresa').addEventListener('submit', guardarEmpresa);
    }

    function elegirLogo(e) {
        const f = e.target.files && e.target.files[0];
        ocultar('empresa-msg');
        if (!f) { logoNuevo = null; return; }
        if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) { e.target.value = ''; logoNuevo = null; mensaje('empresa-msg', 'El logotipo debe ser una imagen PNG, JPG, WebP o SVG.', false); return; }
        if (f.size > MAX_LOGO) { e.target.value = ''; logoNuevo = null; mensaje('empresa-msg', 'El logotipo supera los 2 MB.', false); return; }
        logoNuevo = f;
        document.getElementById('empresa-logo').innerHTML = logoHtml(URL.createObjectURL(f));
    }

    async function subirLogo(f) {
        const ext = (f.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const ruta = `logo_${Date.now()}.${ext}`;
        const { error } = await db().storage.from('empresa').upload(ruta, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        return db().storage.from('empresa').getPublicUrl(ruta).data.publicUrl;
    }

    async function guardarEmpresa(e) {
        e.preventDefault();
        if (!esAdmin()) return;
        const btn = document.getElementById('empresa-guardar');
        const v = (id) => document.getElementById(id).value.trim();
        const nombre = v('empresa-nombre');
        ocultar('empresa-msg');
        if (!nombre) { mensaje('empresa-msg', 'El nombre de la empresa es obligatorio.', false); return; }
        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            let url = logoUrl;
            if (logoNuevo) url = await subirLogo(logoNuevo);
            const fila = { nombre_fiscal: nombre, cif: v('empresa-cif'), direccion: v('empresa-direccion'), telefono: v('empresa-telefono'), email: v('empresa-email'), logo_url: url || null };
            const consulta = empresaId == null
                ? db().from('configuracion_empresa').insert([fila]).select('id')
                : db().from('configuracion_empresa').update(fila).eq('id', empresaId).select('id');
            const { data, error } = await consulta;
            if (error) throw error;
            if (!data || !data.length) throw new Error('No se pudieron guardar los datos: no tienes permiso.');
            empresaId = data[0].id;
            logoUrl = url || '';
            logoNuevo = null;
            mensaje('empresa-msg', 'Cambios guardados.', true);
            window.dispatchEvent(new CustomEvent('empresaActualizada', { detail: { nombre, logo_url: logoUrl } }));
        } catch (ex) {
            mensaje('empresa-msg', ex.message || 'No se pudo guardar.', false);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    window.BomiCuenta = { abrirPerfil, abrirEmpresa };
})();
