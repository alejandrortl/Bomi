// GET /api/icono?size=180|192|512 — devuelve el icono PNG del logotipo de la empresa
// (o el icono por defecto si todavía no hay logotipo o no se generaron sus iconos).
const fs = require('fs');
const path = require('path');
const { empresa, urlIcono } = require('./_empresa');

const TAMANOS = [180, 192, 512];

module.exports = async (req, res) => {
    const pedido = parseInt(new URL(req.url, 'http://x').searchParams.get('size'), 10);
    const size = TAMANOS.includes(pedido) ? pedido : 192;
    let bytes = null;
    const e = await empresa();
    const url = urlIcono(e.logo_url, size);
    if (url) {
        try {
            const r = await fetch(url);
            if (r.ok && /image\/png/.test(r.headers.get('content-type') || '')) bytes = Buffer.from(await r.arrayBuffer());
        } catch (x) { /* se usa el icono por defecto */ }
    }
    if (!bytes) {
        const f = size === 512 ? 'icon-512.png' : 'icon-192.png';
        bytes = fs.readFileSync(path.join(process.cwd(), 'icons', f));
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(bytes);
};
