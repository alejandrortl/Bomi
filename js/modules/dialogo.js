// js/modules/dialogo.js — Avisos y preguntas con el aspecto de la app, en vez de las ventanas del navegador
// («Esta página dice…»).
//   BomiDialogo.aviso(texto)            → muestra un aviso con botón «Entendido». Devuelve una promesa.
//   BomiDialogo.confirmar(texto, opc)   → pregunta Sí/No. Devuelve una promesa con true (acepta) o false.
// Además, window.alert queda sustituido por BomiDialogo.aviso, así que todos los alert() de la app usan este aspecto.
// Escape, tocar fuera o el botón «atrás» del móvil equivalen a «Cancelar».
(function () {
    const alertNativo = window.alert ? window.alert.bind(window) : null;
    const cola = [];
    let actual = null;   // { el, resolver, tipo }

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PELIGRO = /^(eliminar|borrar|descartar|rechazar|bloquear|quitar)$/i;

    // El primer verbo de la pregunta («¿Eliminar esta foto?» → «Eliminar») da nombre al botón.
    function verbo(texto) {
        const m = String(texto).match(/^\s*¿\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/);
        if (!m) return null;
        const v = m[1];
        if (!/(ar|er|ir)$/i.test(v)) return null;   // «¿Quieres…?» no es un verbo en infinitivo
        return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    }
    function icono(texto, tipo, peligro) {
        if (tipo === 'confirmar') return peligro ? ['warning', 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'] : ['help', 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'];
        if (/^\s*(no se pudo|no se ha podido|error|no tienes permiso|no puedes)/i.test(texto)) return ['error', 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'];
        return ['info', 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'];
    }

    function construir(p) {
        const texto = String(p.texto ?? '');
        const v = verbo(texto);
        const okTxt = p.opc.aceptar || (p.tipo === 'confirmar' ? (v || 'Aceptar') : 'Entendido');
        const peligro = p.opc.peligro ?? (p.tipo === 'confirmar' && PELIGRO.test(v || ''));
        const [ic, icCl] = icono(texto, p.tipo, peligro);
        const el = document.createElement('div');
        el.className = 'bomi-dialogo fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/50';
        el.setAttribute('role', p.tipo === 'confirmar' ? 'alertdialog' : 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.innerHTML = `
            <div class="bomi-dialogo-caja bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 w-full max-w-sm rounded-3xl shadow-2xl p-5 flex flex-col gap-4">
                <div class="flex gap-3 items-start">
                    <span class="material-symbols-outlined shrink-0 rounded-full p-2 ${icCl}">${ic}</span>
                    <p class="bomi-dialogo-texto text-sm leading-relaxed whitespace-pre-line break-words pt-1.5 min-w-0">${esc(texto.trim())}</p>
                </div>
                <div class="flex gap-2 justify-end">
                    ${p.tipo === 'confirmar' ? `<button type="button" data-dlg="no" class="flex-1 sm:flex-none px-5 py-3 rounded-full font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700">${esc(p.opc.cancelar || 'Cancelar')}</button>` : ''}
                    <button type="button" data-dlg="si" class="flex-1 sm:flex-none px-5 py-3 rounded-full font-medium text-white ${peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}">${esc(okTxt)}</button>
                </div>
            </div>`;
        el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-dlg]');
            if (b) cerrar(b.dataset.dlg === 'si');
            else if (!e.target.closest('.bomi-dialogo-caja')) cerrar(false);   // tocar fuera = cancelar
        });
        return el;
    }

    function siguiente() {
        if (actual || cola.length === 0) return;
        if (!document.body) { document.addEventListener('DOMContentLoaded', siguiente, { once: true }); return; }
        const p = cola.shift();
        const previo = document.activeElement;
        const el = construir(p);
        document.body.appendChild(el);
        actual = { el, resolver: p.resolver, tipo: p.tipo, previo };
        const foco = el.querySelector('[data-dlg="si"]');
        if (foco) try { foco.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    }
    function cerrar(valor) {
        if (!actual) return;
        const { el, resolver, tipo, previo } = actual;
        actual = null;
        el.remove();
        if (previo && previo.isConnected && previo.focus) try { previo.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
        resolver(tipo === 'confirmar' ? !!valor : undefined);
        siguiente();
    }
    function abrir(tipo, texto, opc) {
        return new Promise((resolver) => { cola.push({ tipo, texto, opc: opc || {}, resolver }); siguiente(); });
    }

    // Escape: se registra en fase de captura y antes que el resto de módulos, para que solo cierre el diálogo
    // (y no también la ventana que haya debajo).
    document.addEventListener('keydown', (e) => {
        if (!actual) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cerrar(false); }
        else if (e.key === 'Enter' && e.target && e.target.closest && e.target.closest('.bomi-dialogo')) { e.preventDefault(); e.stopImmediatePropagation(); const b = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-dlg]'); cerrar(b ? b.dataset.dlg === 'si' : true); }
        else if (e.key === 'Tab') {   // el foco no se escapa del diálogo
            const bs = Array.from(actual.el.querySelectorAll('button'));
            if (!bs.length) return;
            const i = bs.indexOf(document.activeElement);
            e.preventDefault();
            bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
        }
    }, true);

    window.BomiDialogo = {
        aviso: (texto, opc) => abrir('aviso', texto, opc),
        confirmar: (texto, opc) => abrir('confirmar', texto, opc),
        abierto: () => !!actual,
        alertNativo,
    };
    window.alert = (texto) => { window.BomiDialogo.aviso(texto); };
})();
