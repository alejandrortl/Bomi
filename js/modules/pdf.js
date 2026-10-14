// Utilidades comunes para todos los PDF de la app (Partes, Materiales, Diario).
// Script clásico: expone window.BomiPdf. Depende de `supabaseClient` y html2pdf.
// Cada PDF se construye con HTML propio (estilos en línea, colores hex) y lleva arriba el logotipo y los
// datos de la empresa (Logotipo y empresa).
(function () {
    'use strict';
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TIEMPO_MAX = 45000;
    let cacheEmpresa = null; // Promise con { datos, logo }

    function aDataUrl(blob) {
        return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
    }
    // El logotipo se incrusta como dataURL: así html2canvas no depende de CORS ni de que la imagen termine de cargar.
    async function imagenDataUrl(url) {
        if (!url) return '';
        try {
            const r = await fetch(url, { cache: 'force-cache' });
            if (!r.ok) return '';
            return await aDataUrl(await r.blob());
        } catch (e) { return ''; }
    }

    async function cargarEmpresa() {
        let datos = {};
        try {
            const { data } = await supabaseClient.from('configuracion_empresa').select('*').order('id', { ascending: true }).limit(1);
            datos = (data && data[0]) || {};
        } catch (e) { /* sin datos: el PDF sale igualmente */ }
        return { datos, logo: await imagenDataUrl(datos.logo_url) };
    }
    function empresa() {
        if (!cacheEmpresa) cacheEmpresa = cargarEmpresa();
        return cacheEmpresa;
    }
    function invalidar() { cacheEmpresa = null; }

    async function cabecera() {
        const { datos, logo } = await empresa();
        const nombre = datos.nombre_fiscal || (document.getElementById('header-app-title')?.textContent || '').trim();
        const lineas = [
            datos.cif ? 'CIF/NIF: ' + datos.cif : '',
            datos.direccion || '',
            datos.telefono ? 'Tel.: ' + datos.telefono : '',
            datos.email || '',
        ].filter(Boolean);
        if (!logo && !nombre && !lineas.length) return '';
        return `<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #0f172a;margin-bottom:14px"><tr>
            ${logo ? `<td style="width:90px;padding:0 12px 8px 0;vertical-align:middle"><img src="${logo}" alt="" style="max-width:80px;max-height:80px;display:block"></td>` : ''}
            <td style="padding:0 0 8px;vertical-align:middle">
                ${nombre ? `<div style="font-size:16px;font-weight:bold;color:#0f172a">${esc(nombre)}</div>` : ''}
                ${lineas.map((l) => `<div style="font-size:11px;color:#475569;margin-top:1px">${esc(l)}</div>`).join('')}
            </td></tr></table>`;
    }

    // html2canvas no entiende los colores oklch() de Tailwind v4 (<html>/<body>): en la copia se quitan las clases.
    function limpiarClon(doc) {
        doc.documentElement.className = '';
        doc.documentElement.style.cssText = 'background:#ffffff;color:#0f172a';
        doc.body.className = '';
        doc.body.style.cssText = 'background:#ffffff;color:#0f172a';
    }

    function conTiempoMaximo(promesa) {
        let t;
        const limite = new Promise((_, ko) => { t = setTimeout(() => ko(new Error('Se ha agotado el tiempo al crear el PDF.')), TIEMPO_MAX); });
        return Promise.race([promesa, limite]).finally(() => clearTimeout(t));
    }

    // Crea y descarga el PDF. `contenido` es el HTML del cuerpo (sin cabecera de empresa). Lanza error si falla.
    async function generar(contenido, nombreArchivo) {
        if (typeof html2pdf === 'undefined') throw new Error('No se pudo cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.');
        const cab = await cabecera();
        const tmp = document.createElement('div');
        tmp.innerHTML = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff;padding:8px;width:700px;font-size:13px">${cab}${contenido}</div>`;
        const nodo = tmp.firstElementChild; // se entrega sin envoltorio fixed/z-index (dejaba la página en blanco)
        await conTiempoMaximo(html2pdf().from(nodo).set({
            margin: 10, filename: nombreArchivo, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, onclone: limpiarClon },
            jsPDF: { unit: 'mm', format: 'a4' },
        }).save());
    }

    function nombreSeguro(partes, max) {
        return partes.join('_').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, max || 90) + '.pdf';
    }

    window.addEventListener('empresaActualizada', invalidar);
    window.BomiPdf = { generar, cabecera, imagenDataUrl, invalidar, nombreSeguro };
})();
