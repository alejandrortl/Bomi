// Utilidades compartidas por /api/manifest y /api/icono: leen el nombre y el logotipo de la empresa
// mediante la función pública `empresa_publica()` de Supabase (no expone nada más).
const SUPABASE_URL = 'https://dejoetyaiwqloqeinfze.supabase.co';
const ANON_KEY = 'sb_publishable_4LVqnwoHy428agwAYTcESQ_3r4HwgLM';

async function empresa() {
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/empresa_publica`, {
            method: 'POST',
            headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (!r.ok) return {};
        const d = await r.json();
        const fila = Array.isArray(d) ? d[0] : d;
        return fila && typeof fila === 'object' ? { nombre: fila.nombre || '', logo_url: fila.logo_url || '' } : {};
    } catch (e) {
        return {};
    }
}

// logo_<marca>.<ext>  ->  icon<tamaño>_<marca>.png  (los genera la app al guardar el logotipo)
function marcaDeLogo(url) {
    const m = /\/logo_(\d+)\.[a-z0-9]+(?:\?.*)?$/i.exec(url || '');
    return m ? m[1] : '';
}
function urlIcono(logoUrl, size) {
    const marca = marcaDeLogo(logoUrl);
    return marca ? logoUrl.replace(/\/logo_\d+\.[a-z0-9]+(?:\?.*)?$/i, `/icon${size}_${marca}.png`) : '';
}

module.exports = { empresa, marcaDeLogo, urlIcono };
