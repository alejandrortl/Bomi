// Búsqueda por voz: añade un botón de micrófono a todos los buscadores (barras de búsqueda y campos Cliente/Obra
// de los formularios) y transcribe lo dictado. Si el navegador no sabe dictar (p. ej. la app instalada en iPhone),
// el micrófono abre el teclado y explica cómo usar el dictado del propio teclado.
(function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    const esBuscador = (el) => el && el.tagName === 'INPUT' && (
        /^(search-|cat-buscar$|msg-buscar$)/.test(el.id || '') ||
        /^(tarea|par|m|b)-(cliente|obra)$/.test(el.id || ''));
    const toast = (txt, tipo) => { if (window.BomiOffline && window.BomiOffline.toast) window.BomiOffline.toast(txt, tipo); };
    const AVISO_TECLADO = 'Para dictar, pulsa el micrófono del teclado del móvil.';
    let activo = null; // { rec, input, btn }

    function pintar(btn, escuchando) {
        btn.classList.toggle('text-red-500', escuchando);
        btn.classList.toggle('animate-pulse', escuchando);
        btn.classList.toggle('text-slate-400', !escuchando);
        btn.setAttribute('aria-pressed', escuchando ? 'true' : 'false');
        btn.setAttribute('aria-label', escuchando ? 'Detener dictado' : 'Buscar por voz');
        btn.firstElementChild.textContent = escuchando ? 'mic_off' : 'mic';
    }

    function parar() {
        if (!activo) return;
        const a = activo; activo = null;
        try { a.rec.stop(); } catch (_) { /* ya parado */ }
        pintar(a.btn, false);
    }

    function escribir(input, texto) {
        input.value = texto;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function dictar(input, btn) {
        if (activo && activo.input === input) return parar();
        parar();
        const rec = new SR();
        rec.lang = 'es-ES';
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        activo = { rec, input, btn };
        pintar(btn, true);
        rec.onresult = (ev) => {
            let t = '';
            for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
            escribir(input, t.replace(/[.。]+$/, '').trim());
        };
        rec.onerror = (ev) => {
            if (ev.error === 'not-allowed') toast('Permite el micrófono en los ajustes del navegador para buscar por voz.', 'error');
            else if (ev.error === 'service-not-allowed') toast(AVISO_TECLADO);
            else if (ev.error === 'no-speech') toast('No se oyó nada. Pulsa el micrófono y vuelve a hablar.');
            else if (ev.error === 'network') toast('El dictado necesita conexión a internet.', 'error');
        };
        rec.onend = () => { if (activo && activo.rec === rec) { activo = null; pintar(btn, false); } };
        try { rec.start(); } catch (_) { activo = null; pintar(btn, false); toast(AVISO_TECLADO); }
    }

    // Sin reconocimiento de voz en el navegador: se abre el teclado en el buscador para usar su dictado
    function sinDictado(input) {
        input.focus();
        const tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        toast(tactil ? AVISO_TECLADO : 'Este navegador no permite dictar por voz. Prueba con Chrome, Edge o Safari.');
    }

    function adjuntar(input) {
        if (input.dataset.voz) return;
        input.dataset.voz = '1';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-voz-btn', '1');
        btn.title = 'Buscar por voz';
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">mic</span>';
        const enPildora = input.parentElement && input.parentElement.classList.contains('rounded-full');
        if (enPildora) {
            btn.className = 'ml-2 shrink-0 flex items-center justify-center text-slate-400';
            input.insertAdjacentElement('afterend', btn);
        } else {
            const wrap = document.createElement('div');
            wrap.className = 'relative';
            input.parentElement.insertBefore(wrap, input);
            wrap.appendChild(input);
            input.style.paddingRight = '2.75rem';
            input.style.width = '100%';
            btn.className = 'absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400';
            wrap.appendChild(btn);
        }
        pintar(btn, false);
        btn.addEventListener('click', (e) => { e.preventDefault(); if (SR) dictar(input, btn); else sinDictado(input); });
    }

    function barrer(raiz) {
        if (!raiz || !raiz.querySelectorAll) return;
        if (esBuscador(raiz)) adjuntar(raiz);
        raiz.querySelectorAll('input').forEach((i) => { if (esBuscador(i)) adjuntar(i); });
    }

    function iniciar() {
        barrer(document.body);
        new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) barrer(n); }))).observe(document.body, { childList: true, subtree: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); });
    }
    if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
