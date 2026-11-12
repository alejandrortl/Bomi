// GET /api/maps?texto=<enlace de Google Maps o texto que lo contiene>
// Devuelve { direccion, localidad, nombre, aproximada } para rellenar una obra nueva. Ver api/_maps.js.
const { leerEnlaceMaps } = require('./_maps');

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const texto = String((req.query && (req.query.texto || req.query.url)) || '').slice(0, 2000);
    if (!texto.trim()) { res.status(400).send(JSON.stringify({ error: 'Falta el enlace.' })); return; }
    try {
        const d = await leerEnlaceMaps(texto);
        res.status(200).send(JSON.stringify(d));
    } catch (e) {
        res.status(422).send(JSON.stringify({ error: (e && e.message) || 'No se pudo leer el enlace.' }));
    }
};
