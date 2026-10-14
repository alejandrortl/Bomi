// Generador común de PDF (Partes, Materiales, Diario).
// Script clásico: expone window.BomiPdf. Depende de `supabaseClient` y de pdf-lib (CDN).
// El PDF se DIBUJA directamente (texto, tablas e imágenes) en vez de capturar la pantalla: así no depende del
// CSS de la página (Tailwind/oklch), no puede salir en blanco y el texto queda seleccionable.
(function () {
    'use strict';
    const A4 = [595.28, 841.89];
    const MARGEN = 42;
    const GRIS = [0.28, 0.33, 0.41], NEGRO = [0.06, 0.09, 0.16], LINEA = [0.8, 0.84, 0.88], CABECERA = [0.89, 0.91, 0.94], VERDE = [0.02, 0.59, 0.41];
    let cacheEmpresa = null;

    // ---------- Empresa (logotipo y datos) ----------
    function aDataUrl(blob) {
        return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
    }
    async function imagenDataUrl(url) {
        if (!url) return '';
        if (/^data:/.test(url)) return url;
        try {
            const r = await fetch(url, { cache: 'force-cache' });
            if (!r.ok) return '';
            return await aDataUrl(await r.blob());
        } catch (e) { return ''; }
    }
    // pdf-lib solo incrusta PNG y JPG: cualquier imagen (WebP, SVG, GIF...) se pasa a PNG con un canvas.
    function aPng(dataUrl) {
        return new Promise((ok) => {
            const img = new Image();
            img.onload = () => {
                try {
                    let w = img.naturalWidth || img.width || 300, h = img.naturalHeight || img.height || 150;
                    const k = Math.min(1, 1600 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
                    const c = document.createElement('canvas'); c.width = w; c.height = h;
                    const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
                    ok(c.toDataURL('image/png'));
                } catch (e) { ok(''); }
            };
            img.onerror = () => ok('');
            img.src = dataUrl;
        });
    }
    async function prepararImagen(src) {
        const d = await imagenDataUrl(src);
        if (!d) return '';
        return /^data:image\/(png|jpe?g);base64,/i.test(d) ? d : await aPng(d);
    }

    async function cargarEmpresa() {
        let datos = {};
        try {
            const { data } = await supabaseClient.from('configuracion_empresa').select('*').order('id', { ascending: true }).limit(1);
            datos = (data && data[0]) || {};
        } catch (e) { /* sin datos: el PDF sale igualmente */ }
        return { datos, logo: await prepararImagen(datos.logo_url) };
    }
    function empresa() { if (!cacheEmpresa) cacheEmpresa = cargarEmpresa(); return cacheEmpresa; }
    function invalidar() { cacheEmpresa = null; }

    // ---------- Dibujo ----------
    function nombreSeguro(partes, max) {
        return partes.join('_').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, max || 90) + '.pdf';
    }
    function bytesDe(dataUrl) {
        const b = atob(dataUrl.split(',')[1]); const u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        return u;
    }

    async function construir(items, emp) {
        const L = window.PDFLib;
        if (!L) throw new Error('No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.');
        const { PDFDocument, StandardFonts, rgb } = L;
        const pdf = await PDFDocument.create();
        const fN = await pdf.embedFont(StandardFonts.Helvetica);
        const fB = await pdf.embedFont(StandardFonts.HelveticaBold);
        const soportados = new Set(fN.getCharacterSet());
        const limpio = (t) => Array.from(String(t ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/[\u00a0\u2009\u202f]/g, ' ')
            .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"'))
            .map((c) => (c === '\n' || soportados.has(c.codePointAt(0)) ? c : '?')).join('');
        const col = (c) => rgb(c[0], c[1], c[2]);
        let page = null, y = 0;
        const ANCHO = A4[0] - MARGEN * 2;
        const nueva = () => { page = pdf.addPage(A4); y = A4[1] - MARGEN; };
        const hay = (h) => { if (y - h < MARGEN + 18) nueva(); };
        nueva();

        // Parte un texto en líneas que caben en `ancho` (respeta saltos de línea y corta palabras muy largas).
        function lineas(texto, fuente, tam, ancho, anchoPrimera) {
            const out = [];
            limpio(texto).split('\n').forEach((parrafo, pi) => {
                const palabras = parrafo.split(' ');
                let actual = '';
                const lim = () => (out.length === 0 && anchoPrimera ? anchoPrimera : ancho);
                const w = (s) => fuente.widthOfTextAtSize(s, tam);
                palabras.forEach((p) => {
                    let palabra = p;
                    while (w(palabra) > lim()) { // palabra más ancha que la línea
                        if (actual) { out.push(actual); actual = ''; }
                        let n = palabra.length; while (n > 1 && w(palabra.slice(0, n)) > lim()) n--;
                        out.push(palabra.slice(0, n)); palabra = palabra.slice(n);
                    }
                    const prueba = actual ? actual + ' ' + palabra : palabra;
                    if (w(prueba) <= lim()) actual = prueba;
                    else { out.push(actual); actual = palabra; }
                });
                out.push(actual);
            });
            return out;
        }
        const texto = (s, x, yy, fuente, tam, color) => { if (s) page.drawText(s, { x, y: yy, size: tam, font: fuente, color: col(color || NEGRO) }); };

        async function imagen(src, maxW, maxH) {
            const d = await prepararImagen(src);
            if (!d) return null;
            const img = /^data:image\/png/i.test(d) ? await pdf.embedPng(bytesDe(d)) : await pdf.embedJpg(bytesDe(d));
            const k = Math.min(maxW / img.width, maxH / img.height, 1);
            return { img, w: img.width * k, h: img.height * k };
        }

        // Cabecera de empresa (logotipo + datos)
        {
            const d = emp.datos || {};
            const nombre = d.nombre_fiscal || (document.getElementById('header-app-title')?.textContent || '').trim();
            const datos = [d.cif ? 'CIF/NIF: ' + d.cif : '', d.direccion || '', d.telefono ? 'Tel.: ' + d.telefono : '', d.email || ''].filter(Boolean);
            let logo = null;
            if (emp.logo) { try { logo = await imagen(emp.logo, 64, 64); } catch (e) { logo = null; } }
            if (logo || nombre || datos.length) {
                const x0 = MARGEN + (logo ? logo.w + 14 : 0);
                const ancho = A4[0] - MARGEN - x0;
                const bloque = [];
                if (nombre) lineas(nombre, fB, 14, ancho).forEach((l) => bloque.push([l, fB, 14, NEGRO, 17]));
                datos.forEach((s) => lineas(s, fN, 9, ancho).forEach((l) => bloque.push([l, fN, 9, GRIS, 12])));
                const hTexto = bloque.reduce((a, b) => a + b[4], 0);
                const hCab = Math.max(logo ? logo.h : 0, hTexto);
                if (logo) page.drawImage(logo.img, { x: MARGEN, y: y - logo.h - (hCab - logo.h) / 2, width: logo.w, height: logo.h });
                let ty = y - (hCab - hTexto) / 2;
                bloque.forEach(([s, f, t, c, h]) => { ty -= h; texto(s, x0, ty + (h - t) * 0.5 + 1, f, t, c); });
                y -= hCab + 8;
                page.drawLine({ start: { x: MARGEN, y }, end: { x: A4[0] - MARGEN, y }, thickness: 1.5, color: col(NEGRO) });
                y -= 18;
            }
        }

        for (const it of items) {
            if (it.t === 'title') {
                hay(40);
                y -= 16; texto(limpio(it.text), MARGEN, y, fB, 17, NEGRO);
                if (it.badge) texto(limpio(it.badge), MARGEN + fB.widthOfTextAtSize(limpio(it.text), 17) + 10, y + 1, fB, 10, VERDE);
                y -= 6;
                if (it.sub) { lineas(it.sub, fN, 10, ANCHO).forEach((l) => { hay(14); y -= 13; texto(l, MARGEN, y, fN, 10, GRIS); }); }
                y -= 10;
            } else if (it.t === 'kv') {
                const etiqueta = limpio(it.label) + ': ';
                const wE = fB.widthOfTextAtSize(etiqueta, 10.5);
                const ls = lineas(it.value === undefined || it.value === null || it.value === '' ? '—' : it.value, fN, 10.5, ANCHO, ANCHO - wE);
                ls.forEach((l, i) => { hay(15); y -= 14; if (i === 0) { texto(etiqueta, MARGEN, y, fB, 10.5); texto(l, MARGEN + wE, y, fN, 10.5); } else texto(l, MARGEN, y, fN, 10.5); });
                y -= 2;
            } else if (it.t === 'h') {
                hay(34); y -= 22; texto(limpio(it.text), MARGEN, y, fB, 12, NEGRO); y -= 6;
            } else if (it.t === 'p') {
                lineas(it.text, fN, 10.5, ANCHO).forEach((l) => { hay(15); y -= 14; texto(l, MARGEN, y, fN, 10.5); });
                y -= 8;
            } else if (it.t === 'note') {
                lineas(it.text, fN, 8.5, ANCHO).forEach((l) => { hay(12); y -= 11; texto(l, MARGEN, y, fN, 8.5, GRIS); });
                y -= 4;
            } else if (it.t === 'space') {
                y -= it.h || 8;
            } else if (it.t === 'img') {
                let im = null;
                try { im = await imagen(it.src, it.maxW || 260, it.maxH || 140); } catch (e) { im = null; }
                if (im) { hay(im.h + 8); page.drawRectangle({ x: MARGEN - 1, y: y - im.h - 5, width: im.w + 2, height: im.h + 2, borderColor: col(LINEA), borderWidth: 0.7 }); page.drawImage(im.img, { x: MARGEN, y: y - im.h - 4, width: im.w, height: im.h }); y -= im.h + 14; }
            } else if (it.t === 'table') {
                const pad = 4, tam = 9.5, inter = 12;
                const suma = it.cols.reduce((a, c) => a + c.w, 0);
                const anchos = it.cols.map((c) => (c.w / suma) * ANCHO);
                const celdas = (fila, fuente) => fila.map((v, i) => lineas(v === undefined || v === null ? '' : v, fuente, tam, anchos[i] - pad * 2));
                const dibujaFila = (cel, fuente, fondo) => {
                    const alto = Math.max(...cel.map((c) => c.length)) * inter + pad * 2 - 2;
                    hay(alto);
                    let x = MARGEN;
                    cel.forEach((ls, i) => {
                        page.drawRectangle({ x, y: y - alto, width: anchos[i], height: alto, color: fondo ? col(fondo) : undefined, borderColor: col(LINEA), borderWidth: 0.7 });
                        ls.forEach((l, k) => {
                            const alin = it.cols[i].align === 'right' ? anchos[i] - pad - fuente.widthOfTextAtSize(l, tam) : pad;
                            texto(l, x + alin, y - pad - (k + 1) * inter + 3.5, fuente, tam, NEGRO);
                        });
                        x += anchos[i];
                    });
                    y -= alto;
                };
                dibujaFila(celdas(it.cols.map((c) => c.title), fB), fB, CABECERA);
                it.rows.forEach((fila) => dibujaFila(celdas(fila, fN), fN, null));
                y -= 14;
            }
        }

        // Pie con numeración
        const paginas = pdf.getPages();
        paginas.forEach((p, i) => {
            const s = `Página ${i + 1} de ${paginas.length}`;
            p.drawText(s, { x: A4[0] / 2 - fN.widthOfTextAtSize(s, 8) / 2, y: 24, size: 8, font: fN, color: col(GRIS) });
        });
        pdf.setTitle(items.find((i) => i.t === 'title')?.text || 'Documento');
        return await pdf.save();
    }

    function descargar(bytes, nombre) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nombre; a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
    }

    // Crea y descarga el PDF. `items` describe el contenido (ver tipos arriba). Lanza error si falla.
    async function generar(items, nombreArchivo) {
        const emp = await empresa();
        const bytes = await construir(items, emp);
        descargar(bytes, nombreArchivo);
        return bytes;
    }

    window.addEventListener('empresaActualizada', invalidar);
    window.BomiPdf = { generar, construir, imagenDataUrl, invalidar, nombreSeguro };
})();
