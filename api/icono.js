// GET /api/icono?size=180|192|512&tipo=any|mask — devuelve el icono PNG del logotipo de la empresa
// (si aún no existe ese tipo, el icono antiguo; y si tampoco, el icono por defecto).
const fs = require('fs');
const path = require('path');
const { empresa, urlIcono } = require('./_empresa');

const TAMANOS = [180, 192, 512];

module.exports = async (req, res) => {
    const params = new URL(req.url, 'http://x').searchParams;
    const pedido = parseInt(params.get('size'), 10);
    const size = TAMANOS.includes(pedido) ? pedido : 192;
    const tipo = params.get('tipo') === 'any' ? 'any' : 'mask';
    let bytes = null;
    const e = await empresa();
    for (const url of [urlIcono(e.logo_url, size, tipo), urlIcono(e.logo_url, size)]) {
        if (!url || bytes) continue;
        try {
            const r = await fetch(url);
            if (r.ok && /image\/png/.test(r.headers.get('content-type') || '')) bytes = Buffer.from(await r.arrayBuffer());
        } catch (x) { /* se prueba el siguiente o el icono por defecto */ }
    }
    if (!bytes) {
        const f = size === 512 ? 'icon-512.png' : 'icon-192.png';
        bytes = fs.readFileSync(path.join(process.cwd(), 'icons', f));
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(bytes);
};
