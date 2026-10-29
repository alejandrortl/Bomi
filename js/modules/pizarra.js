// js/modules/pizarra.js
// Pizarra de dibujo a mano alzada. Script clásico: expone window.BomiPizarra.abrir(opciones).
// Herramientas: lápiz, línea recta, círculo, óvalo, borrador y cajas de texto; 5 colores; 2 grosores; deshacer y borrar todo.
// Foto de fondo opcional (hecha al momento o elegida de la galería): antes de usarla se puede acercar, girar y mover
// para encuadrar la parte que interesa; se guarda recortada a 1000×700 (JPG) y se dibuja encima.
// El dibujo va en una capa aparte: el borrador solo borra líneas, nunca la foto ni los textos.
// Los textos se mueven arrastrándolos con la herramienta de texto; al tocarlos se editan o eliminan.
// abrir({ fondo, trazos }) — fondo: URL de la foto de fondo (o de un dibujo antiguo); trazos: líneas y textos guardados.
// Devuelve una promesa con:
//   null                        -> el usuario canceló
//   { vacia: false, blob, trazos, fondoBlob, fondoCambiado }
//        blob: imagen final JPG (foto + dibujo); trazos: líneas y textos (para poder editarlos después);
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
        ['Amarillo', '#facc15'],
    ];
    const HERRAMIENTAS = [
        ['lapiz', 'edit', 'Lápiz'],
        ['linea', 'horizontal_rule', 'Línea recta'],
        ['circulo', 'circle', 'Círculo'],
        ['ovalo', 'egg', 'Óvalo'],
        ['texto', 'text_fields', 'Texto'],
        ['borrador', 'ink_eraser', 'Borrador'],
    ];
    const FACTOR_BORRADOR = 4;   // el borrador es 4 veces más ancho que el lápiz
    const CALIDAD = 0.85;
    const ANCHOS = [['Fino', 3], ['Grueso', 8]];
    const TAMANOS = [['Pequeño', 26], ['Mediano', 36], ['Grande', 52]];
    const ZOOM_MAX = 12;
    const BTN = 'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800';
    const MENU_ITEM = 'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-zinc-800';
    const ACTIVO = ['ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-950'];
    const PIE_BTN = 'px-4 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300';
    const PIE_OK = 'bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium flex items-center gap-1';

    let modal = null;
    let canvas = null;
    let ctx = null;
    let capa = null;        // lienzo invisible con solo las líneas (sobre fondo transparente)
    let cctx = null;
    let st = null;          // estado de la sesión de dibujo
    let resolver = null;

    const colorBtn = (c, et, attr) => `<button type="button" ${attr}="${c}" aria-label="${et}" title="${et}" class="w-9 h-9 rounded-full border-2 border-white dark:border-zinc-900 shadow shrink-0" style="background:${c}"></button>`;
    // style en vez de la clase hidden: los elementos ya traen "flex" y ambas clases competirían.
    const ver = (id, si) => { document.getElementById(id).style.display = si ? '' : 'none'; };

    function construir() {
        if (modal) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-pizarra-bit" class="hidden fixed inset-0 z-[70] flex-col bg-white dark:bg-zinc-900" role="dialog" aria-modal="true" aria-label="Pizarra">
                <div id="piz-barra" class="flex flex-wrap items-center gap-2 p-2 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                    <div class="flex gap-1" role="group" aria-label="Herramienta">
                        ${HERRAMIENTAS.map(([id, ic, et]) => `<button type="button" data-herramienta="${id}" aria-label="${et}" title="${et}" class="${BTN}"><span class="material-symbols-outlined">${ic}</span></button>`).join('')}
                    </div>
                    <div class="flex gap-1.5 items-center" role="group" aria-label="Color">
                        ${COLORES.map(([et, c]) => colorBtn(c, et, 'data-color')).join('')}
                    </div>
                    <div class="flex gap-1" role="group" aria-label="Grosor">
                        ${ANCHOS.map(([et, w]) => `<button type="button" data-ancho="${w}" aria-label="${et}" title="${et}" class="${BTN}"><span class="rounded-full bg-current" style="width:${w + 4}px;height:${w + 4}px"></span></button>`).join('')}
                    </div>
                    <div class="relative">
                        <button type="button" id="piz-foto" aria-label="Foto de fondo" title="Foto de fondo" aria-haspopup="menu" class="${BTN}"><span class="material-symbols-outlined">add_a_photo</span></button>
                        <div id="piz-menu-foto" class="absolute left-0 top-12 z-10 w-60 py-1 rounded-xl shadow-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900" role="menu" style="display:none">
                            <button type="button" id="piz-camara" role="menuitem" class="${MENU_ITEM}"><span class="material-symbols-outlined text-[20px]">photo_camera</span> Hacer foto</button>
                            <button type="button" id="piz-galeria" role="menuitem" class="${MENU_ITEM}"><span class="material-symbols-outlined text-[20px]">photo_library</span> Elegir de la galería</button>
                            <button type="button" id="piz-ajustar" role="menuitem" class="${MENU_ITEM}"><span class="material-symbols-outlined text-[20px]">crop</span> Ajustar foto (zoom, girar, mover)</button>
                            <button type="button" id="piz-quitar-foto" role="menuitem" class="${MENU_ITEM} text-red-600"><span class="material-symbols-outlined text-[20px]">close</span> Quitar foto</button>
                        </div>
                        <input type="file" id="piz-input-camara" accept="image/*" capture="environment" class="hidden">
                        <input type="file" id="piz-input-galeria" accept="image/*" class="hidden">
                    </div>
                    <div class="flex gap-1 ml-auto">
                        <button type="button" id="piz-deshacer" aria-label="Deshacer" title="Deshacer" class="${BTN}"><span class="material-symbols-outlined">undo</span></button>
                        <button type="button" id="piz-borrar" aria-label="Borrar todo" title="Borrar todo" class="${BTN} text-red-600"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
                <div id="piz-barra-ajuste" class="flex flex-wrap items-center gap-2 p-2 border-b border-slate-200 dark:border-zinc-800 shrink-0" style="display:none">
                    <button type="button" id="piz-zoom-menos" aria-label="Alejar" title="Alejar" class="${BTN}"><span class="material-symbols-outlined">zoom_out</span></button>
                    <button type="button" id="piz-zoom-mas" aria-label="Acercar" title="Acercar" class="${BTN}"><span class="material-symbols-outlined">zoom_in</span></button>
                    <button type="button" id="piz-girar" aria-label="Girar 90 grados" title="Girar 90°" class="${BTN}"><span class="material-symbols-outlined">rotate_right</span></button>
                    <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-1 min-w-[140px]">Girar
                        <input type="range" id="piz-giro-fino" min="-45" max="45" step="1" value="0" aria-label="Girar poco a poco" class="flex-1">
                    </label>
                    <p class="w-full text-xs text-slate-500">Arrastra para mover la foto. Con dos dedos: acercar, alejar y girar. Lo que queda dentro del recuadro es el fondo.</p>
                </div>
                <div id="piz-area" class="relative flex-1 min-h-0 flex items-center justify-center p-2 bg-slate-100 dark:bg-black">
                    <canvas id="piz-canvas" width="${W}" height="${H}" class="bg-white shadow rounded-lg cursor-crosshair" style="max-width:100%;max-height:100%;aspect-ratio:${W}/${H};touch-action:none"></canvas>
                    <div id="piz-editor-texto" class="absolute inset-0 z-10 items-center justify-center p-4 bg-black/40" style="display:none">
                        <div class="w-full max-w-sm flex flex-col gap-3 p-4 rounded-2xl shadow-2xl bg-white dark:bg-zinc-900">
                            <span class="text-sm font-semibold">Texto</span>
                            <textarea id="piz-texto" rows="3" maxlength="300" placeholder="Escribe aquí..." class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-sm"></textarea>
                            <div class="flex flex-wrap gap-1.5 items-center" role="group" aria-label="Color del texto">
                                ${COLORES.map(([et, c]) => colorBtn(c, et, 'data-color-texto')).join('')}
                            </div>
                            <div class="flex gap-1" role="group" aria-label="Tamaño del texto">
                                ${TAMANOS.map(([et, t]) => `<button type="button" data-tam="${t}" class="px-3 h-9 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm">${et}</button>`).join('')}
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" id="piz-texto-eliminar" class="px-3 py-2 rounded-full text-sm font-medium text-red-600 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">delete</span> Eliminar</button>
                                <button type="button" id="piz-texto-cancelar" class="ml-auto ${PIE_BTN}">Cancelar</button>
                                <button type="button" id="piz-texto-ok" class="${PIE_OK}">Aceptar</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex items-center justify-end gap-3 p-3 border-t border-slate-200 dark:border-zinc-800 shrink-0">
                    <span id="piz-ayuda" class="mr-auto text-xs text-slate-500"></span>
                    <button type="button" id="piz-cancelar" class="${PIE_BTN}">Cancelar</button>
                    <button type="button" id="piz-listo" class="${PIE_OK}"><span class="material-symbols-outlined text-[18px]">check</span> <span id="piz-listo-txt">Listo</span></button>
                </div>
            </div>`);
        modal = document.getElementById('modal-pizarra-bit');
        canvas = document.getElementById('piz-canvas');
        ctx = canvas.getContext('2d');
        capa = document.createElement('canvas');
        capa.width = W; capa.height = H;
        cctx = capa.getContext('2d');
        ['piz-input-camara', 'piz-input-galeria'].forEach((id) => document.getElementById(id).addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (file && st) await ponerFoto(file);
        }));

        modal.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (b && b.id !== 'piz-foto' && !b.closest('#piz-menu-foto')) menuFoto(false);
            if (!b || !st) return;
            if (b.dataset.herramienta) { st.herramienta = b.dataset.herramienta; marcar(); }
            else if (b.dataset.color) { st.color = b.dataset.color; marcar(); }
            else if (b.dataset.ancho) { st.ancho = Number(b.dataset.ancho); marcar(); }
            else if (b.dataset.colorTexto) { st.editor.color = b.dataset.colorTexto; marcarEditor(); }
            else if (b.dataset.tam) { st.editor.tam = Number(b.dataset.tam); marcarEditor(); }
            else if (b.id === 'piz-texto-ok') guardarTexto();
            else if (b.id === 'piz-texto-cancelar') cerrarEditor();
            else if (b.id === 'piz-texto-eliminar') { st.formas = st.formas.filter((f) => f !== st.editor.f); cerrarEditor(); dibujar(); }
            else if (b.id === 'piz-deshacer') { st.formas.pop(); dibujar(); }
            else if (b.id === 'piz-borrar') {
                if ((st.formas.length || st.base) && !confirm('¿Borrar todo el dibujo' + (st.base ? ' y la foto de fondo' : '') + '?')) return;
                if (st.base) st.fondoCambiado = true;
                st.formas = []; quitarFondo(); marcar(); dibujar();
            }
            else if (b.id === 'piz-foto') menuFoto(document.getElementById('piz-menu-foto').style.display === 'none');
            else if (b.id === 'piz-camara') { menuFoto(false); document.getElementById('piz-input-camara').click(); }
            else if (b.id === 'piz-galeria') { menuFoto(false); document.getElementById('piz-input-galeria').click(); }
            else if (b.id === 'piz-ajustar') { menuFoto(false); reajustar(); }
            else if (b.id === 'piz-quitar-foto') { menuFoto(false); if (confirm('¿Quitar la foto de fondo? El dibujo se mantiene.')) { quitarFondo(); st.fondoCambiado = true; marcar(); dibujar(); } }
            else if (b.id === 'piz-zoom-mas') zoomAjuste(1.25);
            else if (b.id === 'piz-zoom-menos') zoomAjuste(1 / 1.25);
            else if (b.id === 'piz-girar') { st.ajuste.rot += Math.PI / 2; dibujar(); }
            else if (b.id === 'piz-cancelar') { if (st.ajuste) salirAjuste(false); else cerrar(null); }
            else if (b.id === 'piz-listo') { if (st.ajuste) salirAjuste(true); else terminar(); }
        });
        document.getElementById('piz-giro-fino').addEventListener('input', (e) => {
            if (!st || !st.ajuste) return;
            const a = st.ajuste;
            const fino = (Number(e.target.value) * Math.PI) / 180;
            a.rot += fino - a.fino;
            a.fino = fino;
            dibujar();
        });
        canvas.addEventListener('pointerdown', empezar);
        canvas.addEventListener('pointermove', mover);
        canvas.addEventListener('pointerup', acabar);
        canvas.addEventListener('pointercancel', acabar);
        canvas.addEventListener('wheel', (e) => { if (st && st.ajuste) { e.preventDefault(); zoomAjuste(e.deltaY < 0 ? 1.1 : 1 / 1.1); } }, { passive: false });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !abierta()) return;
            e.stopPropagation();
            if (st && st.editor) cerrarEditor();
            else if (st && st.ajuste) salirAjuste(false);
            else cerrar(null);
        }, true);
    }

    const abierta = () => !!modal && !modal.classList.contains('hidden');

    function menuFoto(abrir) {
        if (abrir) { ver('piz-ajustar', !!st.base); ver('piz-quitar-foto', !!st.base); }
        ver('piz-menu-foto', !!abrir);
    }

    function marcar() {
        const aj = !!st.ajuste;
        ver('piz-barra', !aj);
        ver('piz-barra-ajuste', aj);
        document.getElementById('piz-listo-txt').textContent = aj ? 'Usar foto' : 'Listo';
        document.getElementById('piz-ayuda').textContent = aj ? '' : st.herramienta === 'texto' ? 'Toca para añadir un texto; arrastra un texto para moverlo o tócalo para cambiarlo.' : '';
        canvas.style.cursor = aj ? 'move' : 'crosshair';
        modal.querySelectorAll('[data-herramienta]').forEach((b) => ACTIVO.forEach((c) => b.classList.toggle(c, b.dataset.herramienta === st.herramienta)));
        modal.querySelectorAll('[data-ancho]').forEach((b) => ACTIVO.forEach((c) => b.classList.toggle(c, Number(b.dataset.ancho) === st.ancho)));
        marcarColores('[data-color]', 'color', st.color);
    }
    function marcarColores(sel, dato, valor) {
        modal.querySelectorAll(sel).forEach((b) => {
            const si = b.dataset[dato] === valor;
            b.classList.toggle('ring-2', si);
            b.classList.toggle('ring-blue-500', si);
            b.classList.toggle('scale-110', si);
            b.setAttribute('aria-pressed', si ? 'true' : 'false');
        });
    }

    // ---------- Dibujo ----------
    function trazar(f) {
        if (f.tipo === 'texto') return;
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

    // ---------- Cajas de texto ----------
    // Caja blanca semitransparente con borde y texto del color elegido; puntos[0] es la esquina superior izquierda.
    const fuenteTexto = (tam) => `600 ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    function medidas(f) {
        ctx.font = fuenteTexto(f.tam);
        const lineas = String(f.texto).split('\n');
        const pad = Math.round(f.tam * 0.35);
        const alto = Math.round(f.tam * 1.2);
        const w = Math.max(...lineas.map((l) => ctx.measureText(l).width)) + pad * 2;
        return { lineas, pad, alto, w, h: lineas.length * alto + pad * 2 };
    }
    function pintarTexto(f, marcado) {
        const m = medidas(f);
        const { x, y } = f.puntos[0];
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, m.w, m.h, 8); else ctx.rect(x, y, m.w, m.h);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = marcado ? 4 : 2;
        ctx.strokeStyle = f.color === '#facc15' ? '#a16207' : f.color;
        if (marcado) ctx.setLineDash([10, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        // El amarillo sobre blanco casi no se lee: se le da un contorno oscuro fino.
        ctx.font = fuenteTexto(f.tam);
        ctx.textBaseline = 'top';
        m.lineas.forEach((l, i) => {
            const ty = y + m.pad + i * m.alto + (m.alto - f.tam) / 2;
            if (f.color === '#facc15') { ctx.lineWidth = 3; ctx.strokeStyle = '#713f12'; ctx.strokeText(l, x + m.pad, ty); }
            ctx.fillStyle = f.color;
            ctx.fillText(l, x + m.pad, ty);
        });
        ctx.restore();
    }
    function textoEn(p) {
        for (let i = st.formas.length - 1; i >= 0; i--) {
            const f = st.formas[i];
            if (f.tipo !== 'texto') continue;
            const m = medidas(f);
            const a = f.puntos[0];
            if (p.x >= a.x - 6 && p.x <= a.x + m.w + 6 && p.y >= a.y - 6 && p.y <= a.y + m.h + 6) return f;
        }
        return null;
    }
    // Mantiene la caja dentro de la pizarra.
    function encajar(f) {
        const m = medidas(f);
        const a = f.puntos[0];
        a.x = Math.min(Math.max(0, a.x), Math.max(0, W - m.w));
        a.y = Math.min(Math.max(0, a.y), Math.max(0, H - m.h));
    }

    function abrirEditor(f, p) {
        st.editor = { f, p, color: f ? f.color : st.color, tam: f ? f.tam : TAMANOS[1][1] };
        const t = document.getElementById('piz-texto');
        t.value = f ? f.texto : '';
        ver('piz-texto-eliminar', !!f);
        document.getElementById('piz-editor-texto').style.display = 'flex';
        marcarEditor();
        t.focus();
    }
    function marcarEditor() {
        marcarColores('[data-color-texto]', 'colorTexto', st.editor.color);
        modal.querySelectorAll('[data-tam]').forEach((b) => ACTIVO.forEach((c) => b.classList.toggle(c, Number(b.dataset.tam) === st.editor.tam)));
    }
    function cerrarEditor() {
        st.editor = null;
        ver('piz-editor-texto', false);
    }
    function guardarTexto() {
        const ed = st.editor;
        const texto = document.getElementById('piz-texto').value.replace(/\s+$/, '');
        if (!texto.trim()) {
            if (ed.f) st.formas = st.formas.filter((f) => f !== ed.f);
        } else if (ed.f) {
            Object.assign(ed.f, { texto, color: ed.color, tam: ed.tam });
            encajar(ed.f);
        } else {
            const f = { tipo: 'texto', texto, color: ed.color, tam: ed.tam, ancho: 0, puntos: [{ x: ed.p.x, y: ed.p.y }] };
            encajar(f);
            st.formas.push(f);
        }
        cerrarEditor();
        dibujar();
    }

    // ---------- Fondo ----------
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
    // La foto con el encuadre elegido (zoom, giro y posición).
    function pintarAjuste(c, a) {
        const iw = a.img.naturalWidth || a.img.width, ih = a.img.naturalHeight || a.img.height;
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, W, H);
        c.save();
        c.translate(a.x, a.y);
        c.rotate(a.rot);
        c.scale(a.esc, a.esc);
        c.imageSmoothingQuality = 'high';
        c.drawImage(a.img, -iw / 2, -ih / 2, iw, ih);
        c.restore();
    }

    function dibujar() {
        cctx.globalCompositeOperation = 'source-over';
        cctx.clearRect(0, 0, W, H);
        st.formas.forEach(trazar);
        if (st.actual) trazar(st.actual);
        cctx.globalCompositeOperation = 'source-over';
        if (st.ajuste) {
            // Mientras se encuadra, el dibujo se ve en transparencia para poder alinear la foto con él.
            pintarAjuste(ctx, st.ajuste);
            ctx.globalAlpha = 0.45;
            ctx.drawImage(capa, 0, 0);
            ctx.globalAlpha = 1;
            return;
        }
        pintarFondo(ctx, st.base);
        ctx.drawImage(capa, 0, 0);
        st.formas.forEach((f) => { if (f.tipo === 'texto') pintarTexto(f, st.arrastre && st.arrastre.f === f); });
    }

    function quitarFondo() {
        st.base = null;
        st.fuente = null;
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
        if (st.editor) cerrarEditor();
        entrarAjuste(img, null);
    }

    // ---------- Encuadre de la foto ----------
    // previo: encuadre anterior de esa misma foto (para volver a ajustarla sin perder lo hecho).
    function entrarAjuste(img, previo) {
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const esc = Math.min(W / iw, H / ih);
        st.ajuste = previo ? { ...previo, img } : { img, esc, rot: 0, fino: 0, x: W / 2, y: H / 2 };
        st.ajuste.min = esc / 4;
        st.ajuste.punteros = new Map();
        document.getElementById('piz-giro-fino').value = String(Math.round((st.ajuste.fino * 180) / Math.PI));
        st.actual = null;
        marcar();
        dibujar();
    }
    function reajustar() {
        if (!st.base) return;
        // En esta sesión se conserva la foto original: se reajusta sin perder calidad. Si no, se parte del fondo guardado.
        if (st.fuente) entrarAjuste(st.fuente.img, st.fuente.encuadre);
        else entrarAjuste(st.base, null);
    }
    function salirAjuste(usar) {
        const a = st.ajuste;
        st.ajuste = null;
        if (usar) {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            pintarAjuste(c.getContext('2d'), a);
            st.base = c;
            st.fuente = { img: a.img, encuadre: { esc: a.esc, rot: a.rot, fino: a.fino, x: a.x, y: a.y } };
            st.fondoCambiado = true;
        }
        marcar();
        dibujar();
    }
    function zoomAjuste(k, cx, cy) {
        const a = st.ajuste;
        const nuevo = Math.min(Math.max(a.esc * k, a.min), ZOOM_MAX);
        const f = nuevo / a.esc;
        // Se acerca hacia el punto indicado (o el centro de la pizarra).
        const px = cx ?? W / 2, py = cy ?? H / 2;
        a.x = px + (a.x - px) * f;
        a.y = py + (a.y - py) * f;
        a.esc = nuevo;
        dibujar();
    }
    function gestoAjuste() {
        const a = st.ajuste;
        const ps = Array.from(a.punteros.values());
        if (ps.length >= 2) {
            const [p, q] = ps;
            a.gesto = { d: Math.hypot(q.x - p.x, q.y - p.y) || 1, ang: Math.atan2(q.y - p.y, q.x - p.x), mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, esc: a.esc, rot: a.rot, x: a.x, y: a.y };
        } else if (ps.length === 1) {
            a.gesto = { mx: ps[0].x, my: ps[0].y, x: a.x, y: a.y, esc: a.esc, rot: a.rot };
        } else a.gesto = null;
    }
    function moverAjuste() {
        const a = st.ajuste, g = a.gesto;
        if (!g) return;
        const ps = Array.from(a.punteros.values());
        if (ps.length >= 2 && g.d) {
            const [p, q] = ps;
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            const ang = Math.atan2(q.y - p.y, q.x - p.x);
            const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
            const esc = Math.min(Math.max(g.esc * (d / g.d), a.min), ZOOM_MAX);
            const giro = ang - g.ang;
            // La foto gira y escala alrededor del punto medio entre los dedos, y se desplaza con él.
            const f = esc / g.esc;
            const dx = g.x - g.mx, dy = g.y - g.my;
            const cos = Math.cos(giro), sin = Math.sin(giro);
            a.x = mx + f * (dx * cos - dy * sin);
            a.y = my + f * (dx * sin + dy * cos);
            a.esc = esc;
            a.rot = g.rot + giro;
        } else if (ps.length === 1) {
            a.x = g.x + ps[0].x - g.mx;
            a.y = g.y + ps[0].y - g.my;
        }
        dibujar();
    }

    // ---------- Puntero ----------
    function pos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
    }

    function empezar(e) {
        if (!st || st.editor) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (ex) { /* puntero ya liberado */ }
        menuFoto(false);
        if (st.ajuste) { st.ajuste.punteros.set(e.pointerId, pos(e)); gestoAjuste(); return; }
        const p = pos(e);
        if (st.herramienta === 'texto') {
            const f = textoEn(p);
            st.arrastre = { f, ox: f ? p.x - f.puntos[0].x : 0, oy: f ? p.y - f.puntos[0].y : 0, inicio: p, movido: false };
            dibujar();
            return;
        }
        const borra = st.herramienta === 'borrador';
        // El borrador quita lo dibujado (no la foto de fondo ni los textos); se puede deshacer.
        st.actual = { tipo: st.herramienta, color: borra ? '#ffffff' : st.color, ancho: borra ? st.ancho * FACTOR_BORRADOR : st.ancho, puntos: [p] };
        dibujar();
    }

    function mover(e) {
        if (!st) return;
        if (st.ajuste) {
            if (!st.ajuste.punteros.has(e.pointerId)) return;
            st.ajuste.punteros.set(e.pointerId, pos(e));
            moverAjuste();
            return;
        }
        const p = pos(e);
        if (st.arrastre) {
            const ar = st.arrastre;
            if (!ar.movido && Math.hypot(p.x - ar.inicio.x, p.y - ar.inicio.y) < 8) return;
            ar.movido = true;
            if (ar.f) { ar.f.puntos[0] = { x: p.x - ar.ox, y: p.y - ar.oy }; encajar(ar.f); dibujar(); }
            return;
        }
        if (!st.actual) return;
        if (st.actual.tipo === 'lapiz' || st.actual.tipo === 'borrador') st.actual.puntos.push(p);
        else st.actual.puntos = [st.actual.puntos[0], p];
        dibujar();
    }

    function acabar(e) {
        if (!st) return;
        if (st.ajuste) { st.ajuste.punteros.delete(e.pointerId); gestoAjuste(); return; }
        if (st.arrastre) {
            const ar = st.arrastre;
            st.arrastre = null;
            dibujar();
            // Un toque sin arrastrar: en un texto lo edita; en un hueco crea uno nuevo.
            if (!ar.movido && e.type === 'pointerup') abrirEditor(ar.f, ar.inicio);
            return;
        }
        if (!st.actual) return;
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
        ver('piz-editor-texto', false);
        menuFoto(false);
        const r = resolver;
        resolver = null;
        st = null;
        if (r) r(resultado);
    }

    const aJpg = (c) => new Promise((ok) => c.toBlob(ok, 'image/jpeg', CALIDAD));
    // Coordenadas con un decimal: el dibujo ocupa poco y se ve igual.
    const redondear = (formas) => formas.map((f) => {
        const r = { tipo: f.tipo, color: f.color, ancho: f.ancho, puntos: f.puntos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })) };
        if (f.tipo === 'texto') { r.texto = f.texto; r.tam = f.tam; }
        return r;
    });
    const valida = (f) => f && Array.isArray(f.puntos) && f.puntos.length && (f.tipo !== 'texto' || (typeof f.texto === 'string' && f.texto && Number(f.tam) > 0));

    async function terminar() {
        if (st.terminando) return;
        if (st.editor) cerrarEditor();
        const vacia = !st.base && st.formas.length === 0;
        // Si no se pudo cargar el dibujo anterior, "vacía" no significa que el usuario lo borrara: no se toca nada.
        if (vacia) { cerrar(st.falloBase ? null : { blob: null, vacia: true }); return; }
        st.terminando = true;
        st.arrastre = null;
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
        const formas = Array.isArray(opciones.trazos) ? opciones.trazos.filter(valida).map((f) => ({ ...f, puntos: f.puntos.map((p) => ({ ...p })) })) : [];
        st = { herramienta: 'lapiz', color: COLORES[0][1], ancho: ANCHOS[0][1], formas, base: base || null, fuente: null, falloBase: base === false,
            actual: null, fondoCambiado: false, ajuste: null, arrastre: null, editor: null };
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        ver('piz-editor-texto', false);
        marcar();
        dibujar();
        if (base === false) alert('No se pudo cargar el dibujo anterior. Si guardas, se empezará con la pizarra en blanco.');
        return new Promise((ok) => { resolver = ok; });
    }

    window.BomiPizarra = { abrir, estaAbierta: abierta };
})();
