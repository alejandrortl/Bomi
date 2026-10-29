// js/modules/pizarra-nube.js
// Guardado de pizarras en Cloudflare R2 (privado) con copia en Google Drive, igual que las fotos de obra.
// Script clásico: expone window.BomiPizarraNube. Usa la Edge Function `fotos-obra` y la tabla `pizarras`.
//
// El registro (bitacora.imagen_pizarra / tareas.dibujo_url) guarda "r2:pizarras/AAAA/MM/<id>.jpg".
// Cada vez que se guarda se crea una versión nueva (fila en `pizarras`) con la imagen final, la foto de fondo sola
// y las líneas dibujadas, para poder seguir editando. Drive guarda todas las versiones (nunca se borra nada allí).
// Las pizarras antiguas (PNG en el almacenamiento de Supabase) se siguen viendo y, al editarlas, pasan a R2.
(function () {
    'use strict';
    const FUNCION = 'fotos-obra';
    const PREFIJO = 'r2:';
    const PATRON = /^r2:(pizarras\/\d{4}\/\d{2}\/([0-9a-f-]{36})\.jpg)$/;
    const enlaces = new Map();          // clave -> { url, hasta }
    let driveReintentado = false;

    const db = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
    const esNube = (v) => PATRON.test(v || '');
    const claveDe = (v) => { const m = PATRON.exec(v || ''); return m ? m[1] : ''; };
    const idDe = (v) => { const m = PATRON.exec(v || ''); return m ? m[2] : ''; };
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    async function errorDe(error) {
        let msg = error.message;
        try { const d = await error.context.json(); if (d && d.error) msg = d.error; } catch (e) { /* sin detalle */ }
        return new Error(error.name === 'FunctionsFetchError' ? 'Failed to fetch' : msg);
    }
    async function llamar(cuerpo) {
        const { data, error } = await db().functions.invoke(FUNCION, { body: cuerpo });
        if (error) throw await errorDe(error);
        if (data && data.error) throw new Error(data.error);
        return data || {};
    }

    // ---------- Ver ----------
    async function enlace(v) {
        const clave = claveDe(v);
        if (!clave) return '';
        const e = enlaces.get(clave);
        if (e && e.hasta > Date.now()) return e.url;
        const d = await llamar({ accion: 'enlaces', claves: [clave] });
        const url = d.enlaces && d.enlaces[clave];
        if (!/^https:\/\//.test(url || '')) return '';
        enlaces.set(clave, { url, hasta: Date.now() + Math.max(60, (d.caduca_en || 21600) - 600) * 1000 });
        return url;
    }
    // <img> de una pizarra: si está en R2 la imagen se pone después con rellenar().
    function img(v, clases, alt) {
        if (esNube(v)) return `<img data-pizarra="${esc(v)}" alt="${esc(alt || 'Pizarra')}" class="${esc(clases)}">`;
        return `<img src="${esc(v)}" alt="${esc(alt || 'Pizarra')}" class="${esc(clases)}">`;
    }
    async function rellenar(raiz) {
        const imgs = Array.from((raiz || document).querySelectorAll('img[data-pizarra]'));
        reintentarDrive();
        for (const i of imgs) {
            try { const u = await enlace(i.dataset.pizarra); if (u && i.getAttribute('src') !== u) i.src = u; } catch (e) { /* se queda vacía; se reintenta al volver a pintar */ }
        }
    }

    // La imagen en sí (pasa por la función: así el lienzo y el PDF no dependen de la configuración CORS de R2).
    async function blobDe(clave) {
        const { data, error } = await db().functions.invoke(FUNCION, { body: { accion: 'leer', clave } });
        if (error) throw await errorDe(error);
        if (!(data instanceof Blob)) throw new Error((data && data.error) || 'No se pudo leer la imagen.');
        return new Blob([data], { type: 'image/jpeg' });
    }
    const aDataUrl = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
    async function dataUrl(v) {
        const clave = claveDe(v);
        return clave ? aDataUrl(await blobDe(clave)) : '';
    }

    // ---------- Editar ----------
    // Lo necesario para reabrir una pizarra guardada: { fondo (URL local), trazos, claveFondo }.
    // Pizarras antiguas o sin datos de edición: la imagen guardada hace de fondo.
    async function paraEditar(v) {
        if (!esNube(v)) return { fondo: v || '', trazos: [], claveFondo: null };
        const { data, error } = await db().from('pizarras').select('trazos, clave_fondo').eq('id', idDe(v)).maybeSingle();
        if (error) throw error;
        if (!data) return { fondo: URL.createObjectURL(await blobDe(claveDe(v))), trazos: [], claveFondo: null };
        const fondo = data.clave_fondo ? URL.createObjectURL(await blobDe(data.clave_fondo)) : '';
        return { fondo, trazos: Array.isArray(data.trazos) ? data.trazos : [], claveFondo: data.clave_fondo || null };
    }

    // Une el resultado de la pizarra con lo que ya había (para reabrirla antes de guardar).
    // previo: { claveFondo, fondoCambiado } de lo cargado; res: lo que devuelve BomiPizarra.abrir().
    function pendiente(res, previo) {
        const p = previo || {};
        return {
            blob: res.blob, trazos: res.trazos || [], fondoBlob: res.fondoBlob || null,
            fondoCambiado: !!(p.fondoCambiado || res.fondoCambiado),
            claveFondo: p.claveFondo || null,
        };
    }

    // ---------- Guardar ----------
    // Pasos (para BomiOffline) que suben la pizarra y crean su versión. Devuelve { pasos, valor } con el valor
    // que hay que guardar en el registro. datos: { origen, registroId, cliente, obra, clienteId, obraId }.
    function plan(pend, datos) {
        const O = window.BomiOffline;
        const id = O.uuid();
        const ahora = new Date();
        const carpeta = `pizarras/${ahora.getFullYear()}/${String(ahora.getMonth() + 1).padStart(2, '0')}/`;
        const clave = carpeta + id + '.jpg';
        const subir = (k, blob) => ({ k: 'funcion', nombre: FUNCION, cuerpo: blob, cabeceras: { 'x-accion': 'subir', 'x-clave': k, 'Content-Type': 'image/jpeg' } });
        const pasos = [subir(clave, pend.blob)];
        // La foto de fondo se reutiliza si no se tocó; si es nueva (o viene de una pizarra antigua) se sube.
        let claveFondo = null;
        if (pend.fondoBlob) {
            if (!pend.fondoCambiado && pend.claveFondo) claveFondo = pend.claveFondo;
            else { claveFondo = carpeta + id + '-f.jpg'; pasos.push(subir(claveFondo, pend.fondoBlob)); }
        }
        const p = window.currentUserProfile || {};
        const quien = [p.nombre, p.apellido].filter((x) => x && String(x).trim()).join(' ').trim() || p.email || 'Usuario';
        pasos.push({ k: 'insert', tabla: 'pizarras', filas: [{
            id, origen: datos.origen, registro_id: datos.registroId || null, cliente_id: datos.clienteId || null, obra_id: datos.obraId || null,
            cliente: datos.cliente || null, obra: datos.obra || null, clave, clave_fondo: claveFondo, trazos: pend.trazos || [],
            bytes: pend.blob.size, creada_por: quien, creada_por_id: p.id || null,
        }] });
        pasos.push({ k: 'gancho', nombre: 'pizarrasDrive', datos: { ids: [id] } });
        return { pasos, valor: PREFIJO + clave };
    }

    // Copia a Drive justo después de guardar; las que quedaron pendientes (p. ej. sin señal) se reintentan una vez por sesión.
    function reintentarDrive() {
        if (driveReintentado || (typeof navigator !== 'undefined' && navigator.onLine === false) || !window.currentUserProfile) return;
        driveReintentado = true;
        llamar({ accion: 'drive', tipo: 'pizarras' }).catch(() => {});
    }
    if (window.BomiOffline) {
        window.BomiOffline.registrarGancho('pizarrasDrive', async (d) => {
            const ids = (d && d.ids) || [];
            if (ids.length) await llamar({ accion: 'drive', tipo: 'pizarras', ids });
        });
    }

    window.BomiPizarraNube = { esNube, img, rellenar, enlace, dataUrl, paraEditar, pendiente, plan };
})();
