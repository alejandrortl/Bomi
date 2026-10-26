// GET /api/manifest — manifiesto de la app con el nombre y el icono (logotipo) de la empresa.
const { empresa, marcaDeLogo } = require('./_empresa');

module.exports = async (req, res) => {
    const e = await empresa();
    const marca = marcaDeLogo(e.logo_url);
    const nombre = (e.nombre || '').trim() || 'Diario de Obra';
    const v = marca ? `&v=${marca}` : '';
    const manifiesto = {
        name: nombre,
        short_name: nombre.length > 14 ? nombre.slice(0, 14).trim() : nombre,
        description: 'Gestión de Diario, Partes, Bitácora, Materiales, Clientes y Equipo',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
            // "any": logo grande, lo usa la pantalla de carga · "maskable": con margen, para el icono adaptable de Android
            { src: `/api/icono?size=192&tipo=any${v}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `/api/icono?size=512&tipo=any${v}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `/api/icono?size=192&tipo=mask${v}`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: `/api/icono?size=512&tipo=mask${v}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(JSON.stringify(manifiesto));
};
