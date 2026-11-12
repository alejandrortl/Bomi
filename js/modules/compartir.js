// js/modules/compartir.js — Botón «Compartir» de Diario, Partes, Bitácora (registros y fotos) y Materiales.
// Abre una hoja con tres opciones y usa el menú de compartir del móvil (WhatsApp, correo, Telegram…):
//   · PDF      → compartirlo o descargarlo (con logotipo y datos de la empresa). Sustituye al antiguo botón «PDF».
//   · Texto    → un mensaje con los datos del registro, listo para pegar en un chat.
//   · Imágenes → las fotos o el dibujo de la pizarra del registro (si los tiene).
// Todo se prepara al abrir la hoja, para que al tocar una opción el menú del móvil salga al momento.
// Si el navegador no sabe compartir (ordenador), el PDF y las imágenes se descargan y el texto se copia.
//
// Uso: BomiCompartir.abrir({ titulo: 'Parte 12/11', nombre: 'parte-cliente-obra.pdf', items })
//      `items` es la misma lista que se pasa a BomiPdf (puede ser una promesa o una función async).
(function () {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const aviso = (t) => (window.BomiDialogo ? window.BomiDialogo.aviso(t) : alert(t));
    let hoja = null;

    // ---------- Texto a partir de la lista del PDF ----------
    function texto(items) {
        const l = [];
        const limpio = (v) => String(v ?? '').trim();
        const vacio = (v) => !v || /^[-—–?]+$/.test(v) || /^(n\/a|sin notas\.?)$/i.test(v);
        let titulo = null;   // un apartado solo se escribe si debajo hay algo de texto (no solo una imagen)
        const push = (...x) => { if (titulo !== null) { l.push('', '*' + titulo + '*'); titulo = null; } l.push(...x); };
        (items || []).forEach((it) => {
            if (!it) return;
            if (it.t === 'title') {
                l.push('*' + limpio(it.text) + '*' + (it.badge ? ' (' + limpio(it.badge) + ')' : ''));
                if (it.sub) l.push(limpio(it.sub));
            } else if (it.t === 'kv') {
                const v = limpio(it.value);
                if (!vacio(v)) push(limpio(it.label) + ': ' + (v.includes('\n') ? '\n' + v : v));
            } else if (it.t === 'h') {
                titulo = limpio(it.text);
            } else if (it.t === 'p') {
                if (!vacio(limpio(it.text))) push(limpio(it.text));
            } else if (it.t === 'table') {
                const titulos = (it.cols || []).map((c) => limpio(c.title));
                (it.rows || []).forEach((fila) => {
                    const celdas = fila.map(limpio);
                    // «4 · Codo cobre 22 · Ref. ABC»: la cantidad delante y el resto separado por puntos
                    const partes = celdas.map((c, i) => (c && /^ref/i.test(titulos[i] || '') ? 'Ref. ' + c : c)).filter(Boolean);
                    if (partes.length) push('• ' + partes.join(' · '));
                });
            } else if (it.t === 'note') {
                titulo = null;
                if (limpio(it.text)) l.push('', '_' + limpio(it.text).replace(/\n/g, '_\n_') + '_');
            }
        });
        return l.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    // ---------- Archivos ----------
    function dataUrlABlob(d) {
        const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(d || '');
        if (!m) return null;
        const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new Blob([u], { type: m[1] });
    }
    const extension = (tipo) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[tipo] || 'jpg');
    const base = (nombre) => String(nombre || 'bomi').replace(/\.pdf$/i, '');

    async function imagenes(items, nombre) {
        const srcs = (items || []).filter((it) => it && it.t === 'img' && it.src).map((it) => it.src);
        const files = [];
        for (let i = 0; i < srcs.length; i++) {
            let d = '';
            try { d = await window.BomiPdf.imagenDataUrl(srcs[i]); } catch (e) { d = ''; }
            const b = dataUrlABlob(d);
            if (b) files.push(new File([b], `${base(nombre)}-${i + 1}.${extension(b.type)}`, { type: b.type || 'image/jpeg' }));
        }
        return { total: srcs.length, files };
    }

    function descargar(blob, nombre) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nombre; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    }
    const puedeArchivos = (files) => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };
    const cancelado = (ex) => ex && (ex.name === 'AbortError' || /abort|cancel/i.test(ex.message || ''));

    async function compartirArchivos(files, titulo) {
        if (puedeArchivos(files)) {
            try { await navigator.share({ files, title: titulo }); return true; }
            catch (ex) { if (cancelado(ex)) return true; /* si falla, se descargan */ }
        }
        files.forEach((f, i) => setTimeout(() => descargar(f, f.name), i * 400));
        aviso(files.length > 1 ? 'Este dispositivo no permite compartir archivos directamente: se han descargado.' : 'Este dispositivo no permite compartir archivos directamente: se ha descargado.');
        return true;
    }
    async function compartirTexto(t, titulo) {
        if (navigator.share) {
            try { await navigator.share({ text: t, title: titulo }); return; }
            catch (ex) { if (cancelado(ex)) return; }
        }
        try { await navigator.clipboard.writeText(t); aviso('Texto copiado. Pégalo en WhatsApp, en un correo o donde quieras.'); }
        catch (e) { aviso('No se pudo compartir el texto en este dispositivo.'); }
    }

    // ---------- Hoja de opciones ----------
    function cerrar() { if (hoja) { hoja.remove(); hoja = null; } }

    function boton(k, icono, titulo, sub) {
        return `<button type="button" data-compartir="${k}" disabled class="w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-60">
            <span class="material-symbols-outlined shrink-0 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded-full p-2">${icono}</span>
            <span class="flex flex-col min-w-0"><span class="font-medium">${titulo}</span><span data-sub class="text-xs text-slate-500 dark:text-slate-400">${sub}</span></span>
        </button>`;
    }

    async function abrir(o) {
        cerrar();
        const titulo = o.titulo || 'Bomi';
        const nombre = /\.pdf$/i.test(o.nombre || '') ? o.nombre : (o.nombre || 'bomi') + '.pdf';
        const el = document.createElement('div');
        el.className = 'fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 sm:p-4';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Compartir');
        el.innerHTML = `
            <div class="compartir-caja bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3">
                <div class="flex justify-between items-center">
                    <h3 class="font-semibold text-lg flex items-center gap-2"><span class="material-symbols-outlined text-blue-600 dark:text-blue-400">share</span> Compartir</h3>
                    <button type="button" data-compartir="cerrar" aria-label="Cerrar" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 flex"><span class="material-symbols-outlined">close</span></button>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 -mt-1 break-words">${esc(titulo)}</p>
                ${boton('pdf', 'picture_as_pdf', 'Compartir PDF', 'Preparando…')}
                ${boton('descargar', 'download', 'Descargar PDF', 'Preparando…')}
                ${boton('texto', 'notes', 'Texto', 'Preparando…')}
                ${boton('imagenes', 'photo_library', 'Imágenes', 'Preparando…')}
            </div>`;
        document.body.appendChild(el);
        hoja = el;
        const b = (k) => el.querySelector(`[data-compartir="${k}"]`);
        const sub = (k, t) => { const s = b(k) && b(k).querySelector('[data-sub]'); if (s) s.textContent = t; };
        const listo = { pdf: null, texto: null, imagenes: null };

        el.addEventListener('click', async (e) => {
            const x = e.target.closest('[data-compartir]');
            if (!x) { if (!e.target.closest('.compartir-caja')) cerrar(); return; }
            const k = x.dataset.compartir;
            if (k === 'cerrar') { cerrar(); return; }
            if (x.disabled) return;
            if (k === 'pdf' && listo.pdf) await compartirArchivos([listo.pdf], titulo);
            else if (k === 'descargar' && listo.pdf) descargar(listo.pdf, listo.pdf.name);
            else if (k === 'texto' && listo.texto) await compartirTexto(listo.texto, titulo);
            else if (k === 'imagenes' && listo.imagenes && listo.imagenes.length) await compartirArchivos(listo.imagenes, titulo);
        });

        // Preparación (los tres a la vez)
        let items;
        try { items = await (typeof o.items === 'function' ? o.items() : o.items); }
        catch (ex) { if (hoja === el) { sub('pdf', 'No se pudieron leer los datos'); sub('descargar', 'No se pudieron leer los datos'); sub('texto', 'No se pudieron leer los datos'); sub('imagenes', 'No se pudieron leer los datos'); } return; }
        if (hoja !== el) return;

        listo.texto = o.texto || texto(items);
        sub('texto', 'Mensaje con los datos, para WhatsApp o correo'); b('texto').disabled = !listo.texto;

        const nImg = (items || []).filter((it) => it && it.t === 'img' && it.src).length;
        if (!nImg) { b('imagenes').remove(); }
        else {
            imagenes(items, nombre).then((r) => {
                if (hoja !== el || !b('imagenes')) return;
                listo.imagenes = r.files;
                if (!r.files.length) sub('imagenes', 'No se pudieron cargar (¿sin conexión?)');
                else { sub('imagenes', r.files.length === 1 ? '1 imagen' : r.files.length + ' imágenes'); b('imagenes').disabled = false; }
            });
        }

        try {
            const bytes = await window.BomiPdf.crear(items);
            if (hoja !== el) return;
            listo.pdf = new File([bytes], nombre, { type: 'application/pdf' });
            sub('pdf', 'Por WhatsApp, correo… con logotipo y datos de la empresa'); b('pdf').disabled = false;
            sub('descargar', 'Guardarlo en este dispositivo'); b('descargar').disabled = false;
        } catch (ex) {
            if (hoja === el) { const m = 'No se pudo crear: ' + ((ex && ex.message) || 'error'); sub('pdf', m); sub('descargar', m); }
        }
    }

    // Escape (y el botón «atrás», que envía un Escape) cierra la hoja sin tocar lo que haya debajo.
    document.addEventListener('keydown', (e) => {
        if (!hoja || e.key !== 'Escape') return;
        if (window.BomiDialogo && window.BomiDialogo.abierto()) return;
        e.stopImmediatePropagation(); cerrar();
    }, true);

    window.BomiCompartir = { abrir, cerrar, texto };
})();
