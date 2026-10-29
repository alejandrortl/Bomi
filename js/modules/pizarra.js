// js/modules/pizarra.js
// Pizarra de dibujo a mano alzada. Script clásico: expone window.BomiPizarra.abrir(opciones).
// Herramientas: lápiz, línea recta, círculo, óvalo y borrador; 4 colores; 2 grosores; deshacer y borrar todo.
// Foto de fondo opcional (cámara o galería): se reduce a 1000×700 (JPG) y se dibuja encima.
// El dibujo va en una capa aparte: el borrador solo borra líneas, nunca la foto.
// abrir({ fondo, trazos }) — fondo: URL de la foto de fondo (o de un dibujo antiguo); trazos: líneas guardadas.
// Devuelve una promesa con:
//   null                        -> el usuario canceló
//   { vacia: false, blob, trazos, fondoBlob, fondoCambiado }
//        blob: imagen final JPG (foto + dibujo); trazos: las líneas (para poder editarlas después);
//        fondoBlob: la foto de fondo sola en JPG 1000×700 (null si no hay); fondoCambiado: si se puso, cambió o quitó la foto.
//   { blob: null, vacia: true } -> dejó la pizarra en blanco (equivale a quitar el dibujo)
(function () {
    'use strict';

    const W = 1000;
    const H = 700;
    const COLORES = [
        ['Negro', '#111827'],
        ['Azul', '#2563eb'],
        ['Rojo', '#dc2626'],
        ['Verde', '#16a34a'],
    ];
    const HERRAMIENTAS = [
        ['lapiz', 'edit', 'Lápiz'],
        ['linea', 'horizontal_rule', 'Línea recta'],
        ['circulo', 'circle', 'Círculo'],
        ['ovalo', 'egg', 'Óvalo'],
        ['borrador', 'ink_eraser', 'Borrador'],
    ];
    const FACTOR_BORRADOR = 4;   // el borrador es 4 veces más ancho que el lápiz
    const CALIDAD = 0.85;
    const ANCHOS = [['Fino', 3], ['Grueso', 8]];
    const BTN = 'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800';
    const ACTIVO = ['ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-950'];

    let modal = null;
    let canvas = null;
    let ctx = null;
    let capa = null;        // lienzo invisible con solo el dibujo (sobre fondo transparente)
    let cctx = null;
    let st = null;          // estado de la sesión de dibujo
    let resolver = null;

    function construir() {
        if (modal) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-pizarra-bit" class="hidden fixed inset-0 z-[70] flex-col bg-white dark:bg-zinc-900" role="dialog" aria-modal="true" aria-label="Pizarra">
                <div class="flex flex-wrap items-center gap-2 p-2 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                    <div class="flex gap-1" role="group" aria-label="Herramienta">
                        ${HERRAMIENTAS.map(([id, ic, et]) => `<button type="button" data-herramienta="${id}" aria-label="${et}" title="${et}" class="${BTN}"><span class="material-symbols-outlined">${ic}</span></button>`).join('')}
                    </div>
                    <div class="flex gap-1.5 items-center" role="group" aria-label="Color">
                        ${COLORES.map(([et, c]) => `<button type="button" data-color="${c}" aria-label="${et}" title="${et}" class="w-9 h-9 rounded-full border-2 border-white dark:border-zinc-900 shadow shrink-0" style="background:${c}"></button>`).join('')}
                    </div>
                    <div class="flex gap-1" role="group" aria-label="Grosor">
                        ${ANCHOS.map(([et, w]) => `<button type="button" data-ancho="${w}" aria-label="${et}" title="${et}" class="${BTN}"><span class="rounded-full bg-current" style="width:${w + 4}px;height:${w + 4}px"></span></button>`).join('')}
                    </div>
                    <div class="flex gap-1" role="group" aria-label="Foto de fondo">
                        <button type="button" id="piz-foto" aria-label="Foto de fondo" title="Foto de fondo" class="${BTN}"><span class="material-symbols-outlined">add_a_photo</span></button>
                        <button type="button" id="piz-quitar-foto" aria-label="Quitar foto de fondo" title="Quitar foto de fondo" class="${BTN}" style="display:none"><span class="material-symbols-outlined">close</span></button>
                        <input type="file" id="piz-foto-input" accept="image/*" class="hidden">
                    </div>
                    <div class="flex gap-1 ml-auto">
                        <button type="button" id="piz-deshacer" aria-label="Deshacer" title="Deshacer" class="${BTN}"><span class="material-symbols-outlined">undo</span></button>
                        <button type="button" id="piz-borrar" aria-label="Borrar todo" title="Borrar todo" class="${BTN} text-red-600"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
                <div id="piz-area" class="flex-1 min-h-0 flex items-center justify-center p-2 bg-slate-100 dark:bg-black">
                    <canvas id="piz-canvas" width="${W}" height="${H}" class="bg-white shadow rounded-lg cursor-crosshair" style="max-width:100%;max-height:100%;aspect-ratio:${W}/${H};touch-action:none"></canvas>
                </div>
                <div class="flex justify-end gap-3 p-3 border-t border-slate-200 dark:border-zinc-800 shrink-0">
                    <button type="button" id="piz-cancelar" class="px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300">Cancelar</button>
                    <button type="button" id="piz-listo" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">check</span> Listo</button>
                </div>
            </div>`);
        modal = document.getElementById('modal-pizarra-bit');
        canvas = document.getElementById('piz-canvas');
        ctx = canvas.getContext('2d');
        capa = document.createElement('canvas');
        capa.width = W; capa.height = H;
        cctx = capa.getContext('2d');
        document.getElementById('piz-foto-input').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (file && st) await ponerFoto(file);
        });

        modal.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.herramienta) { st.herramienta = b.dataset.herramienta; marcar(); }
            else if (b.dataset.color) { st.color = b.dataset.color; marcar(); }
            else if (b.dataset.ancho) { st.ancho = Number(b.dataset.ancho); marcar(); }
            else if (b.id === 'piz-deshacer') { st.formas.pop(); dibujar(); }
            else if (b.id === 'piz-borrar') {
                if ((st.formas.length || st.base) && !confirm('¿Borrar todo el dibujo' + (st.base ? ' y la foto de fondo' : '') + '?')) return;
                if (st.base) st.fondoCambiado = true;
                st.formas = []; quitarFondo(); dibujar();
            }
            else if (b.id === 'piz-foto') document.getElementById('piz-foto-input').click();
            else if (b.id === 'piz-quitar-foto') { if (confirm('¿Quitar la foto de fondo? El dibujo se mantiene.')) { quitarFondo(); st.fondoCambiado = true; dibujar(); } }
            else if (b.id === 'piz-cancelar') cerrar(null);
            else if (b.id === 'piz-listo') terminar();
        });
        canvas.addEventListener('pointerdown', empezar);
        canvas.addEventListener('pointermove', mover);
        canvas.addEventListener('pointerup', acabar);
        canvas.addEventListener('pointercancel', acabar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierta()) { e.stopPropagation(); cerrar(null); } }, true);
    }

    const abierta = () => !!modal && !modal.classList.contains('hidden');

    function marcar() {
        // style en vez de la clase hidden: el botón ya trae "flex" y ambas clases competirían.
        document.getElementById('piz-quitar-foto').style.display = st.base ? '' : 'none';
        modal.querySelectorAll('[data-herramienta]').forEach((b) => ACTIVO.forEach((c) => b.classList.toggle(c, b.dataset.herramienta === st.herramienta)));
        modal.querySelectorAll('[data-ancho]').forEach((b) => ACTIVO.forEach((c) => b.classList.toggle(c, Number(b.dataset.ancho) === st.ancho)));
        modal.querySelectorAll('[data-color]').forEach((b) => {
            const sel = b.dataset.color === st.color;
            b.classList.toggle('ring-2', sel);
            b.classList.toggle('ring-blue-500', sel);
            b.classList.toggle('scale-110', sel);
            b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
    }

    // ---------- Dibujo ----------
    function trazar(f) {
        const ctx = cctx;
        // El borrador quita lo dibujado en la capa (deja ver la foto o el blanco de debajo).
        ctx.globalCompositeOperation = f.tipo === 'borrador' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.lineWidth = f.ancho;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const [a, b] = [f.puntos[0], f.puntos[f.puntos.length - 1]];
        ctx.beginPath();
        if (f.tipo === 'lapiz' || f.tipo === 'borrador') {
            if (f.puntos.length === 1) { ctx.arc(a.x, a.y, f.ancho / 2, 0, Math.PI * 2); ctx.fill(); return; }
            ctx.moveTo(a.x, a.y);
            f.puntos.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        } else if (f.tipo === 'linea') {
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
        } else if (f.tipo === 'circulo') {
            ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
        } else if (f.tipo === 'ovalo') {
            const rx = Math.abs(b.x - a.x) / 2;
            const ry = Math.abs(b.y - a.y) / 2;
            ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2);
        }
        ctx.stroke();
    }

    // La foto (o un dibujo antiguo) se encaja entera en 1000×700, centrada, con blanco alrededor.
    function pintarFondo(c, img) {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, W, H);
        if (!img) return;
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const k = Math.min(W / iw, H / ih);
        c.imageSmoothingQuality = 'high';
        c.drawImage(img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
    }

    function dibujar() {
        cctx.globalCompositeOperation = 'source-over';
        cctx.clearRect(0, 0, W, H);
        st.formas.forEach(trazar);
        if (st.actual) trazar(st.actual);
        cctx.globalCompositeOperation = 'source-over';
        pintarFondo(ctx, st.base);
        ctx.drawImage(capa, 0, 0);
    }

    function quitarFondo() {
        if (st.base && st.base.close) st.base.close();
        st.base = null;
    }

    async function ponerFoto(file) {
        let img = null;
        try {
            if (window.createImageBitmap) {
                try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { img = null; }
            }
            if (!img) {
                const url = URL.createObjectURL(file);
                img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('formato')); i.src = url; });
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (e) { alert('No se pudo abrir esa foto. Prueba con otra (JPG o PNG).'); return; }
        if (!st) return;
        quitarFondo();
        st.base = img;
        st.fondoCambiado = true;
        marcar();
        dibujar();
    }

    function pos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
    }

    function empezar(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const borra = st.herramienta === 'borrador';
        // El borrador quita lo dibujado (no la foto de fondo); se puede deshacer.
        st.actual = { tipo: st.herramienta, color: borra ? '#ffffff' : st.color, ancho: borra ? st.ancho * FACTOR_BORRADOR : st.ancho, puntos: [pos(e)] };
        dibujar();
    }

    function mover(e) {
        if (!st || !st.actual) return;
        const p = pos(e);
        if (st.actual.tipo === 'lapiz' || st.actual.tipo === 'borrador') st.actual.puntos.push(p);
        else st.actual.puntos = [st.actual.puntos[0], p];
        dibujar();
    }

    function acabar() {
        if (!st || !st.actual) return;
        const f = st.actual;
        st.actual = null;
        const [a, b] = [f.puntos[0], f.puntos[f.puntos.length - 1]];
        // Una línea, círculo u óvalo sin recorrido (un simple toque) no se guarda.
        if (f.tipo === 'lapiz' || f.tipo === 'borrador' || Math.hypot(b.x - a.x, b.y - a.y) > 3) st.formas.push(f);
        dibujar();
    }

    // ---------- Apertura y cierre ----------
    function cargarImagen(url) {
        return new Promise((ok) => {
            if (!url) { ok(null); return; }
            const img = new Image();
            // Las imágenes del almacenamiento de Supabase admiten CORS; sin esto el lienzo no se podría exportar.
            if (!/^(data|blob):/.test(url)) img.crossOrigin = 'anonymous';
            img.onload = () => ok(img);
            img.onerror = () => ok(false);
            img.src = url;
        });
    }

    function cerrar(resultado) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const r = resolver;
        resolver = null;
        st = null;
        if (r) r(resultado);
    }

    const aJpg = (c) => new Promise((ok) => c.toBlob(ok, 'image/jpeg', CALIDAD));
    // Coordenadas con un decimal: el dibujo ocupa poco y se ve igual.
    const redondear = (formas) => formas.map((f) => ({ tipo: f.tipo, color: f.color, ancho: f.ancho, puntos: f.puntos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })) }));

    async function terminar() {
        if (st.terminando) return;
        const vacia = !st.base && st.formas.length === 0;
        // Si no se pudo cargar el dibujo anterior, "vacía" no significa que el usuario lo borrara: no se toca nada.
        if (vacia) { cerrar(st.falloBase ? null : { blob: null, vacia: true }); return; }
        st.terminando = true;
        dibujar();
        let fondoBlob = null;
        if (st.base) {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            pintarFondo(c.getContext('2d'), st.base);
            fondoBlob = await aJpg(c);
        }
        const blob = await aJpg(canvas);
        if (!st) return;
        st.terminando = false;
        if (!blob || (st.base && !fondoBlob)) { alert('No se pudo generar la imagen de la pizarra.'); return; }
        cerrar({ vacia: false, blob, trazos: redondear(st.formas), fondoBlob, fondoCambiado: st.fondoCambiado });
    }

    async function abrir(opciones = {}) {
        construir();
        if (resolver) return null;
        const base = await cargarImagen(opciones.fondo || opciones.imagen);
        const formas = Array.isArray(opciones.trazos) ? opciones.trazos.filter((f) => f && Array.isArray(f.puntos) && f.puntos.length) : [];
        st = { herramienta: 'lapiz', color: COLORES[0][1], ancho: ANCHOS[0][1], formas, base: base || null, falloBase: base === false, actual: null, fondoCambiado: false };
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        marcar();
        dibujar();
        if (base === false) alert('No se pudo cargar el dibujo anterior. Si guardas, se empezará con la pizarra en blanco.');
        return new Promise((ok) => { resolver = ok; });
    }

    window.BomiPizarra = { abrir, estaAbierta: abierta };
})();
