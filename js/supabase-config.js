// js/supabase-config.js

// 1. URL base estricta (SIN /rest/v1/ al final)
const supabaseUrl = 'https://dejoetyaiwqloqeinfze.supabase.co'; 

// 2. Tu clave pública (Anon Key)
const supabaseAnonKey = 'sb_publishable_4LVqnwoHy428agwAYTcESQ_3r4HwgLM';

// Inicialización
// Toda petición tiene un tiempo máximo: con la señal muy débil no se queda "Guardando..." para siempre.
function fetchConTiempo(url, opciones) {
    const o = opciones || {};
    const ms = /\/storage\/v1\/|\/functions\/v1\/fotos-obra/.test(String(url)) ? 90000 : 30000;
    const ctl = new AbortController();
    const reloj = setTimeout(() => ctl.abort(), ms);
    if (o.signal) { if (o.signal.aborted) ctl.abort(); else o.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    return fetch(url, { ...o, signal: ctl.signal }).finally(() => clearTimeout(reloj));
}
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchConTiempo } });

console.log("Supabase inicializado correctamente.");
