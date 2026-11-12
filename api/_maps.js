// Lee un enlace de Google Maps (o el texto que lo contiene, tal como llega por WhatsApp o desde "Compartir")
// y saca la dirección y la localidad para crear una obra. Lo usa /api/maps.
//  1. Busca el enlace dentro del texto.
//  2. Si es corto (maps.app.goo.gl), sigue las redirecciones, solo hacia dominios de Google.
//  3. Del enlace final saca el nombre/dirección escrita y las coordenadas.
//  4. Si la dirección escrita trae código postal ("Calle X, 5, 28001 Madrid"), se usa tal cual;
//     si no, se pregunta a OpenStreetMap (Nominatim) qué dirección hay en esas coordenadas.

const UA_NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const UA_NOMINATIM = 'BomiApp/1.0 (gestion de obras)';
const PAISES = /^(españa|spain|espanya|espainia)$/i;

function hostPermitido(host) {
    host = String(host || '').toLowerCase();
    return host === 'goo.gl' || host === 'maps.app.goo.gl' || host === 'g.co'
        || /(^|\.)google(\.com)?\.[a-z]{2,3}$/.test(host) || host === 'google.com' || host.endsWith('.google.com');
}

// Primer enlace de Google Maps que aparezca en el texto.
function extraerEnlace(texto) {
    const urls = String(texto || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const u of urls) {
        try {
            const url = new URL(u.replace(/[).,;]+$/, ''));
            if (hostPermitido(url.hostname)) return url.toString();
        } catch (e) { /* no es un enlace válido */ }
    }
    return null;
}

const dec = (s) => { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s).replace(/\+/g, ' '); } };
const limpiar = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function esCoordenada(t) {
    return /^\s*-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+\s*$/.test(t || '') || /°/.test(t || '');
}
function coordsDeTexto(t) {
    const m = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(t || '');
    return m ? { lat: +m[1], lng: +m[2] } : null;
}

// Del enlace largo de Google Maps: texto (nombre o dirección) y coordenadas.
function analizarUrl(href) {
    const out = { texto: '', lat: null, lng: null };
    let url;
    try { url = new URL(href); } catch (e) { return out; }
    // Aviso de cookies de Google en Europa: el enlace real va en "continue".
    if (/consent\.google/.test(url.hostname) && url.searchParams.get('continue')) return analizarUrl(url.searchParams.get('continue'));
    const p = url.pathname;
    // Coordenadas exactas del sitio (!3dLAT!4dLNG) mejor que las del centro del mapa (@LAT,LNG).
    const m3 = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(href);
    const mArroba = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(p);
    if (m3) { out.lat = +m3[1]; out.lng = +m3[2]; } else if (mArroba) { out.lat = +mArroba[1]; out.lng = +mArroba[2]; }
    const mPlace = /\/maps\/(?:place|search|dir\/[^/]*)\/([^/@]+)/.exec(p);
    let texto = mPlace ? dec(mPlace[1]) : '';
    const q = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('daddr') || url.searchParams.get('destination') || url.searchParams.get('ll');
    if (!texto && q) texto = dec(q);
    texto = limpiar(texto);
    if (texto && esCoordenada(texto)) {
        const c = coordsDeTexto(texto);
        if (c && out.lat == null) { out.lat = c.lat; out.lng = c.lng; }
        texto = '';
    }
    if (!texto && out.lat == null && q) {
        const c = coordsDeTexto(q);
        if (c) { out.lat = c.lat; out.lng = c.lng; }
    }
    out.texto = texto;
    return out;
}

// "Calle de Alcalá, 45, 28014 Madrid, España" -> { direccion: "Calle de Alcalá, 45", localidad: "Madrid" }
// "Bar Pepe, Calle Mayor 3, 46001 València" -> { nombre: "Bar Pepe", direccion: "Calle Mayor 3", localidad: "València" }
function partirDireccion(texto) {
    const partes = limpiar(texto).split(/\s*,\s*/).filter(Boolean).filter((x) => !PAISES.test(x));
    const i = partes.findIndex((x) => /^\d{5}\b/.test(x));
    if (i < 1) return null;
    const localidad = limpiar(partes[i].replace(/^\d{5}\s*/, '')) || limpiar(partes[i + 1] || '');
    let antes = partes.slice(0, i);
    let nombre = '';
    // Si lo primero no parece una calle y hay más trozos, es el nombre del sitio (un negocio, una urbanización...).
    if (antes.length >= 2 && !/\d/.test(antes[0]) && !pareceVia(antes[0]) && pareceVia(antes[1])) { nombre = antes[0]; antes = antes.slice(1); }
    const direccion = antes.join(', ');
    if (!direccion || !localidad) return null;
    return { direccion, localidad, nombre };
}
function pareceVia(t) {
    return /^(c\/|c\.|calle|carrer|carretera|ctra|avda|av\.|avenida|avinguda|plaza|pl\.|plaça|paseo|pg\.|passeig|camino|camí|cami|ronda|travesía|travessera|urb|urbanización|polígono|pol\.|p\.i\.|partida|pda|glorieta|bulevar|costa|cuesta|rambla|vía|via|callejón|pasaje|passatge|sector|parcela|barrio|lugar|diseminado)\b/i.test(limpiar(t));
}

async function seguirRedirecciones(href, fetchFn) {
    let actual = href;
    for (let i = 0; i < 6; i++) {
        const u = new URL(actual);
        if (!hostPermitido(u.hostname)) throw new Error('El enlace no es de Google Maps.');
        // Si ya es un enlace largo con datos, no hace falta pedirlo.
        const a = analizarUrl(actual);
        if (!/goo\.gl$|^g\.co$/.test(u.hostname) && (a.texto || a.lat != null)) return actual;
        const r = await fetchFn(actual, { redirect: 'manual', headers: { 'User-Agent': UA_NAVEGADOR, 'Accept-Language': 'es-ES,es;q=0.9' } });
        const loc = r.headers.get('location');
        if (r.status >= 300 && r.status < 400 && loc) { actual = new URL(loc, actual).toString(); continue; }
        // Algunas respuestas traen el enlace largo dentro de la página en vez de redirigir.
        if (r.ok) {
            const html = await r.text();
            const m = /https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s<>\\]+/.exec(html);
            if (m) return m[0].replace(/&amp;/g, '&');
        }
        return actual;
    }
    return actual;
}

async function direccionDeCoordenadas(lat, lng, fetchFn) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=es&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const r = await fetchFn(url, { headers: { 'User-Agent': UA_NOMINATIM } });
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d && d.address) || {};
    const via = a.road || a.pedestrian || a.footway || a.path || a.residential || a.neighbourhood || a.hamlet || '';
    const direccion = [via, a.house_number].filter(Boolean).join(', ');
    const localidad = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || '';
    if (!direccion && !localidad) return null;
    return { direccion, localidad };
}

async function direccionDeTexto(texto, fetchFn) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=es&limit=1&countrycodes=es&q=${encodeURIComponent(texto)}`;
    const r = await fetchFn(url, { headers: { 'User-Agent': UA_NOMINATIM } });
    if (!r.ok) return null;
    const lista = await r.json();
    if (!Array.isArray(lista) || !lista[0]) return null;
    return direccionDeCoordenadas(lista[0].lat, lista[0].lon, fetchFn);
}

// Devuelve { direccion, localidad, nombre, aproximada, enlace }.
async function leerEnlaceMaps(texto, fetchFn = fetch) {
    const enlace = extraerEnlace(texto);
    if (!enlace) throw new Error('No encuentro ningún enlace de Google Maps en lo que has pegado.');
    const final = await seguirRedirecciones(enlace, fetchFn);
    const a = analizarUrl(final);
    const res = { direccion: '', localidad: '', nombre: '', aproximada: false, enlace };

    const partida = a.texto ? partirDireccion(a.texto) : null;
    if (partida) return Object.assign(res, partida);

    // El texto es solo el nombre de un sitio (o no hay texto): se busca la dirección por las coordenadas.
    if (a.texto && !esCoordenada(a.texto)) res.nombre = a.texto;
    let d = null;
    try {
        if (a.lat != null) d = await direccionDeCoordenadas(a.lat, a.lng, fetchFn);
        else if (a.texto) d = await direccionDeTexto(a.texto, fetchFn);
    } catch (e) { d = null; }
    if (d) return Object.assign(res, d, { aproximada: true });
    if (res.nombre) return Object.assign(res, { direccion: res.nombre, nombre: '', aproximada: true });
    throw new Error('No he podido sacar la dirección de ese enlace. Escríbela a mano.');
}

module.exports = { leerEnlaceMaps, extraerEnlace, analizarUrl, partirDireccion, hostPermitido };
