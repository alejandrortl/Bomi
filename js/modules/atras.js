// js/modules/atras.js — Botón «atrás» del móvil (y gesto de volver).
// Antes, en Android, pulsar atrás cerraba la app. Ahora va deshaciendo pasos, de lo más reciente a lo más general:
//   1. Cierra lo que esté encima (ventana, visor de fotos, pizarra, menú, lista de sugerencias…), igual que la tecla Escape.
//   2. Si estás en una tarea (formulario o detalle), en Mensajes, Mi Perfil o Empresa, vuelve a la pantalla anterior.
//   3. Si estás en otra sección (Partes, Materiales…), vuelve al Diario.
//   4. En el Diario avisa «Pulsa otra vez atrás para salir» y, si se vuelve a pulsar, sale.
// Si hay un formulario a medio rellenar, pregunta antes de cerrarlo para no perder lo escrito.
(function () {
    const GUARDIA = { bomiAtras: 1 };
    let activo = false;
    let salirPendiente = false;
    let avisoSalir = null;

    const visible = (el) => !!el && !el.hidden && !el.classList.contains('hidden') && el.getClientRects().length > 0;
    const $ = (id) => document.getElementById(id);

    // ---------- Formularios con cambios sin guardar ----------
    // Se apunta el formulario (o la ventana) donde la persona ha escrito, dibujado o elegido algo.
    const tocados = new Set();
    function contenedor(el) {
        if (!el || !el.closest) return null;
        return el.closest('form') || el.closest('[id^="modal-"]') || null;
    }
    function apuntar(e) { if (e.isTrusted) { const c = contenedor(e.target); if (c) tocados.add(c); } }
    document.addEventListener('input', apuntar, true);
    document.addEventListener('change', apuntar, true);
    document.addEventListener('pointerdown', (e) => { if (e.target && e.target.tagName === 'CANVAS') apuntar(e); }, true);
    document.addEventListener('submit', (e) => { tocados.delete(e.target); }, true);
    // Lo que ya se cerró (con Guardar, Cancelar o la X) deja de contar como «a medio rellenar».
    function limpiarTocados() { tocados.forEach((c) => { if (!c.isConnected || !visible(c)) tocados.delete(c); }); }
    document.addEventListener('click', () => setTimeout(limpiarTocados, 0), true);

    const hayCambiosEn = (zona) => { limpiarTocados(); for (const c of tocados) if (zona === c || zona.contains(c) || c.contains(zona)) return true; return false; };
    async function puedeCerrar(zona) {
        if (!zona || !hayCambiosEn(zona)) return true;
        poner();   // mientras se pregunta, otro «atrás» solo cierra la pregunta (no sale de la app)
        if (!(await BomiDialogo.confirmar('¿Salir sin guardar? Se perderá lo que has escrito.', { aceptar: 'Salir sin guardar', cancelar: 'Seguir editando', peligro: true }))) return false;
        tocados.forEach((c) => { if (zona === c || zona.contains(c) || c.contains(zona)) tocados.delete(c); });
        return true;
    }

    // ---------- Lo que está abierto encima ----------
    // Foto de lo que se ve: ventanas a pantalla completa, menús y listas desplegables.
    function capas() {
        return Array.from(document.querySelectorAll('.fixed, .absolute, [role="listbox"], [role="dialog"], #dropdown-menu-perfil'))
            .filter((el) => el.id !== 'bottom-nav' && !el.closest('#bottom-nav') && visible(el));
    }
    function capaSuperior() {
        const llenas = capas().filter((el) => el.classList.contains('inset-0'));
        let mejor = null, zMejor = -Infinity;
        llenas.forEach((el) => { const z = parseInt(getComputedStyle(el).zIndex, 10) || 0; if (z >= zMejor) { zMejor = z; mejor = el; } });
        return mejor;
    }
    async function cerrarCapa() {
        const antes = capas();
        if (antes.length === 0) return false;
        const arriba = capaSuperior();
        if (arriba && !(await puedeCerrar(arriba))) return true;   // ha dicho que no: se queda todo como estaba
        const destino = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : document.body;
        destino.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
        const despues = capas();
        return despues.length !== antes.length || despues.some((el, i) => el !== antes[i]);
    }

    // ---------- Pantallas ----------
    async function volverPantalla() {
        if (visible($('view-form-tarea'))) {
            if (await puedeCerrar($('form-tarea'))) $('btn-cancel-tarea').click();
            return true;
        }
        if (visible($('view-detalle-tarea'))) { $('btn-back-tarea-list').click(); return true; }
        if (!visible($('view-task-list'))) {
            const abierta = ['view-perfil', 'view-empresa', 'view-mensajes'].map($).find(visible);
            if (abierta && !(await puedeCerrar(abierta))) return true;
            const home = $('nav-home');
            if (home) { home.click(); return true; }
        }
        return false;
    }

    // ---------- Aviso «Pulsa otra vez atrás para salir» ----------
    function mostrarAvisoSalir() {
        if (!avisoSalir) {
            avisoSalir = document.createElement('div');
            avisoSalir.setAttribute('role', 'status');
            avisoSalir.className = 'fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none transition-opacity';
            avisoSalir.textContent = 'Pulsa otra vez atrás para salir';
            document.body.appendChild(avisoSalir);
        }
        avisoSalir.style.opacity = '1';
        avisoSalir.hidden = false;
        clearTimeout(mostrarAvisoSalir.t);
        mostrarAvisoSalir.t = setTimeout(() => { avisoSalir.hidden = true; poner(); }, 2500);
    }

    // ---------- Historial del navegador ----------
    const puesta = () => !!(history.state && history.state.bomiAtras);
    function poner() {
        if (!activo || puesta()) return;
        salirPendiente = false;
        if (avisoSalir) avisoSalir.hidden = true;
        try { history.pushState(GUARDIA, ''); } catch (e) { /* sin historial */ }
    }

    window.addEventListener('popstate', async () => {
        if (!activo) return;
        let hecho = false;
        try { hecho = (await cerrarCapa()) || (await volverPantalla()); } catch (e) { console.warn('Atrás:', e); hecho = true; }
        if (hecho) { poner(); return; }
        // Ya estamos en el Diario sin nada abierto: el siguiente «atrás» sale de la app.
        salirPendiente = true;
        mostrarAvisoSalir();
    });
    // Chrome se salta las entradas del historial creadas sin que la persona toque la pantalla,
    // así que la «guardia» se vuelve a poner al tocar (salvo justo después del aviso de salir).
    document.addEventListener('pointerdown', () => { if (!salirPendiente) poner(); }, true);
    window.addEventListener('userLoggedIn', () => { activo = true; poner(); });
})();
