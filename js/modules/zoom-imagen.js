// js/modules/zoom-imagen.js
// Visor a pantalla completa para ver de cerca una pizarra (o cualquier imagen marcada con data-ampliar).
// Al tocar la imagen se abre; dentro se acerca con dos dedos (pellizco), doble toque, rueda del ratón o los botones + / −,
// y con la imagen ampliada se mueve arrastrando. Script clásico: expone window.BomiZoom.
// BomiZoom.controlador() da el mismo mecanismo para otros visores (p. ej. el de fotos de obra).
(function () {
    const MAX = 6, MIN = 1, PASO = 1.6, DOBLE = 2.5;
    const limitarA = (v, a, b) => Math.min(b, Math.max(a, v));
    const BTN = 'bg-white/15 hover:bg-white/25 text-white rounded-full w-11 h-11 flex items-center justify-center disabled:opacity-40';

    // Mecanismo de zoom reutilizable: pellizco, doble toque, rueda del ratón y arrastre con la imagen ampliada.
    // raiz: elemento fijo donde se escuchan los gestos. zona() y foto(): devuelven el recuadro y la <img> actuales
    // (pueden cambiar si se vuelve a pintar el contenido). alCambiar(s): se llama cada vez que cambia el zoom.
    function controlador({ raiz, zona, foto, alCambiar }) {
        let s = 1, x = 0, y = 0;
        const punteros = new Map();
        let gesto = null;            // estado al empezar un arrastre o pellizco
        let movido = false, ultimoToque = { t: 0, x: 0, y: 0 };

        // Punto del evento respecto al centro de la zona (el centro de la imagen sin mover).
        function relativo(e) {
            const r = zona().getBoundingClientRect();
            return { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) };
        }

        function aplicar() {
            s = limitarA(s, MIN, MAX);
            const z = zona(), f = foto();
            if (!z || !f) return;
            // No se deja sacar la imagen de la pantalla: como mucho se llega a su borde.
            const mx = Math.max(0, (f.offsetWidth * s - z.clientWidth) / 2);
            const my = Math.max(0, (f.offsetHeight * s - z.clientHeight) / 2);
            x = limitarA(x, -mx, mx); y = limitarA(y, -my, my);
            f.style.transformOrigin = 'center center';
            f.style.transform = s === 1 && x === 0 && y === 0 ? '' : `translate(${x}px, ${y}px) scale(${s})`;
            if (alCambiar) alCambiar(s);
        }

        // Cambia el zoom dejando quieto el punto (px, py) de la pantalla.
        function zoomEn(nuevo, px, py) {
            nuevo = limitarA(nuevo, MIN, MAX);
            const k = nuevo / s;
            x = px - (px - x) * k; y = py - (py - y) * k; s = nuevo;
            aplicar();
        }

        function empezarGesto() {
            const ps = [...punteros.values()];
            if (ps.length >= 2) {
                const [a, b] = ps;
                gesto = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s, x, y };
            } else if (ps.length === 1) {
                gesto = { p: { ...ps[0] }, x, y };
            } else gesto = null;
        }

        function abajo(e) {
            const z = zona();
            if (!z || !z.contains(e.target) || (e.target.closest && e.target.closest('button, a'))) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            try { z.setPointerCapture(e.pointerId); } catch (_) { /* sin captura también funciona */ }
            punteros.set(e.pointerId, relativo(e));
            if (punteros.size === 1) movido = false;
            empezarGesto();
            e.preventDefault();
        }

        function mover(e) {
            if (!punteros.has(e.pointerId) || !gesto) return;
            punteros.set(e.pointerId, relativo(e));
            const ps = [...punteros.values()];
            if (ps.length >= 2 && gesto.d) {
                const [a, b] = ps;
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const nuevo = limitarA(gesto.s * d / gesto.d, MIN, MAX);
                const k = nuevo / gesto.s;
                s = nuevo;
                x = m.x - (gesto.m.x - gesto.x) * k;
                y = m.y - (gesto.m.y - gesto.y) * k;
                movido = true;
                aplicar();
            } else if (ps.length === 1 && gesto.p) {
                const dx = ps[0].x - gesto.p.x, dy = ps[0].y - gesto.p.y;
                if (Math.abs(dx) + Math.abs(dy) > 6) movido = true;
                x = gesto.x + dx; y = gesto.y + dy;
                aplicar();
            }
        }

        function arriba(e) {
            if (!punteros.has(e.pointerId)) return;
            const p = punteros.get(e.pointerId);
            punteros.delete(e.pointerId);
            if (punteros.size === 0 && !movido && e.type === 'pointerup') {
                // Doble toque (o doble clic): acerca en ese punto, o vuelve al tamaño normal si ya estaba ampliada.
                const ahora = Date.now();
                if (ahora - ultimoToque.t < 320 && Math.hypot(p.x - ultimoToque.x, p.y - ultimoToque.y) < 40) {
                    if (s > MIN + 0.01) { s = MIN; x = 0; y = 0; aplicar(); }
                    else zoomEn(DOBLE, p.x, p.y);
                    ultimoToque = { t: 0, x: 0, y: 0 };
                    movido = true;      // el segundo toque no cuenta como toque suelto
                } else ultimoToque = { t: ahora, x: p.x, y: p.y };
            }
            if (punteros.size > 0) movido = true;   // al soltar un dedo del pellizco no cuenta como toque
            empezarGesto();
        }

        raiz.addEventListener('pointerdown', abajo);
        raiz.addEventListener('pointermove', mover);
        raiz.addEventListener('pointerup', arriba);
        raiz.addEventListener('pointercancel', arriba);
        raiz.addEventListener('wheel', (e) => {
            const z = zona();
            if (!z || !z.contains(e.target)) return;
            e.preventDefault();
            const p = relativo(e);
            zoomEn(s * Math.exp(-e.deltaY * 0.0025), p.x, p.y);
        }, { passive: false });

        return {
            aplicar,
            acercar() { zoomEn(s * PASO, 0, 0); },
            alejar() { zoomEn(s / PASO, 0, 0); },
            reiniciar() { s = 1; x = 0; y = 0; punteros.clear(); gesto = null; movido = false; ultimoToque = { t: 0, x: 0, y: 0 }; aplicar(); },
            soltar() { punteros.clear(); gesto = null; },
            escala: () => s,
            ampliada: () => s > MIN + 0.01,
            seMovio: () => movido,      // el último toque fue un arrastre, pellizco o doble toque
        };
    }

    // ---------- Visor a pantalla completa (pizarras y <img data-ampliar>) ----------
    let capa = null, zona = null, foto = null, zoom = null;

    function crear() {
        capa = document.createElement('div');
        capa.id = 'zoom-imagen';
        capa.className = 'fixed inset-0 z-[150] bg-black flex flex-col hidden';
        capa.setAttribute('role', 'dialog');
        capa.setAttribute('aria-modal', 'true');
        capa.setAttribute('aria-label', 'Imagen ampliada');
        capa.innerHTML = `
            <div class="relative z-10 bg-black flex items-center justify-between gap-2 p-3 text-white">
                <span id="zoom-imagen-nivel" class="text-sm font-medium min-w-[3rem]">100%</span>
                <div class="flex items-center gap-2">
                    <button type="button" data-zoom="menos" aria-label="Alejar" class="${BTN}"><span class="material-symbols-outlined">zoom_out</span></button>
                    <button type="button" data-zoom="mas" aria-label="Acercar" class="${BTN}"><span class="material-symbols-outlined">zoom_in</span></button>
                    <button type="button" data-zoom="cerrar" aria-label="Cerrar" class="${BTN}"><span class="material-symbols-outlined">close</span></button>
                </div>
            </div>
            <div id="zoom-imagen-zona" class="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center select-none" style="touch-action:none;overflow:hidden">
                <img id="zoom-imagen-foto" alt="" draggable="false" class="max-w-full max-h-full object-contain bg-white select-none" style="transform-origin:center center;will-change:transform">
            </div>
            <p class="relative z-10 bg-black text-center text-xs text-white/60 p-2">Pellizca o toca dos veces para acercar · arrastra para moverte</p>`;
        document.body.appendChild(capa);
        zona = capa.querySelector('#zoom-imagen-zona');
        foto = capa.querySelector('#zoom-imagen-foto');
        zoom = controlador({
            raiz: zona, zona: () => zona, foto: () => foto,
            alCambiar(s) {
                capa.querySelector('#zoom-imagen-nivel').textContent = Math.round(s * 100) + '%';
                capa.querySelector('[data-zoom="menos"]').disabled = s <= MIN + 0.001;
                capa.querySelector('[data-zoom="mas"]').disabled = s >= MAX - 0.001;
            },
        });

        capa.addEventListener('click', (e) => {
            const b = e.target.closest('[data-zoom]');
            if (!b) return;
            if (b.dataset.zoom === 'cerrar') cerrar();
            else if (b.dataset.zoom === 'mas') zoom.acercar();
            else zoom.alejar();
        });
        window.addEventListener('resize', () => { if (abierto()) zoom.aplicar(); });
        document.addEventListener('keydown', (e) => {
            if (!abierto()) return;
            if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
            else if (e.key === '+' || e.key === '=') zoom.acercar();
            else if (e.key === '-') zoom.alejar();
        }, true);
    }

    const abierto = () => !!capa && !capa.classList.contains('hidden');

    function abrir(src, alt) {
        if (!src) return;
        if (!capa) crear();
        foto.alt = alt || 'Imagen ampliada';
        foto.onload = () => zoom.aplicar();
        foto.src = src;
        capa.classList.remove('hidden');
        zoom.reiniciar();
        capa.querySelector('[data-zoom="cerrar"]').focus({ preventScroll: true });
    }

    function cerrar() {
        if (!capa) return;
        capa.classList.add('hidden');
        foto.removeAttribute('src');
        zoom.soltar();
    }

    // Cualquier <img data-ampliar> de la app se abre en el visor al tocarla (si ya tiene la imagen cargada).
    document.addEventListener('click', (e) => {
        const img = e.target.closest && e.target.closest('img[data-ampliar]');
        if (!img) return;
        const src = img.currentSrc || img.getAttribute('src');
        if (!src) return;
        e.preventDefault(); e.stopPropagation();
        abrir(src, img.alt);
    }, true);

    window.BomiZoom = { abrir, cerrar, abierto, controlador };
})();
