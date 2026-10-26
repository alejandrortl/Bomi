// Edge Function `guardar-parte-nube` (desplegar con verify_jwt = false: la propia función comprueba la sesión y el rol;
// con las claves nuevas de Supabase la verificación del gateway rechaza la llamada antes de llegar aquí).
// La app la llama justo después de bloquear un parte, con el PDF ya dibujado (el mismo que se descarga),
// y la función lo guarda en la nube de la empresa. Solo Admin/SuperAdmin y solo partes bloqueados.
// Cada parte se guarda una sola vez: si ya está en la tabla `partes_pdf_nube`, devuelve lo guardado.
//
// Se guarda en Google Drive: Bomi - Partes bloqueados / <año de la fecha del parte> / <primer operario> / S44-10-26-2026-Cliente-Obra.pdf
// Las carpetas que no existan se crean. El nombre del archivo y el operario los manda la app (los mismos que al descargar).
// Quien escribe en Drive es un Apps Script del propio Drive de la empresa (tools/google-drive-apps-script.gs),
// así no hace falta Google Cloud. Secretos: GOOGLE_SCRIPT_URL (URL de la aplicación web) y GOOGLE_SCRIPT_CLAVE.
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const MAX_BYTES = 15 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Guardado = { archivo_id: string; enlace: string | null };

// ---------- Google Drive (a través del Apps Script) ----------
async function subirDrive(ruta: string[], nombre: string, pdfBase64: string): Promise<Guardado> {
  const r = await fetch(Deno.env.get('GOOGLE_SCRIPT_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clave: Deno.env.get('GOOGLE_SCRIPT_CLAVE'), ruta, nombre, pdf_base64: pdfBase64 }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) throw new Error('Google Drive no responde (' + r.status + '). Revisa GOOGLE_SCRIPT_URL y que el script esté implementado como aplicación web para «Cualquier usuario».');
  if (d.error || !d.id) throw new Error('Google Drive: ' + (d.error ?? 'respuesta inesperada'));
  return { archivo_id: d.id, enlace: d.enlace ?? null };
}

// ---------- Utilidades ----------
function configurado(): boolean {
  return /^https:\/\//.test(Deno.env.get('GOOGLE_SCRIPT_URL') ?? '') && !!Deno.env.get('GOOGLE_SCRIPT_CLAVE');
}
function deBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
// Solo se quitan los caracteres que no admiten los discos (el nombre lo arma la app).
const limpio = (s: unknown, max: number) => String(s ?? '').replace(/[\\/:*?"<>|#%\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+/, '').trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    // Quién llama: tiene que ser un Admin/SuperAdmin aprobado.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'Sesión no válida' }, 401);
    const { data: perfil } = await sb.from('perfiles').select('nombre, apellido, email, rol, activo, en_papelera').eq('id', u.user.id).maybeSingle();
    if (!perfil || perfil.activo !== true || perfil.en_papelera === true || !['Admin', 'SuperAdmin'].includes(perfil.rol)) {
      return json({ error: 'Solo un administrador puede guardar partes en la nube' }, 403);
    }

    const { parte_id, pdf_base64, nombre: nombrePedido, operario } = await req.json();
    if (typeof parte_id !== 'string' || typeof pdf_base64 !== 'string') return json({ error: 'Faltan datos' }, 400);

    const { data: hecho } = await sb.from('partes_pdf_nube').select('*').eq('parte_id', parte_id).maybeSingle();
    if (hecho) return json({ estado: 'guardado', ...hecho });

    const destino = 'drive';
    if (!configurado()) return json({ estado: 'sin_configurar' });

    const { data: parte } = await sb.from('partes_trabajo').select('id, fecha, cliente, obra, bloqueado').eq('id', parte_id).maybeSingle();
    if (!parte) return json({ error: 'El parte no existe' }, 404);
    if (!parte.bloqueado) return json({ error: 'Solo se guardan en la nube los partes bloqueados' }, 409);

    const pdf = deBase64(pdf_base64);
    if (pdf.length > MAX_BYTES) return json({ error: 'El PDF es demasiado grande' }, 413);
    if (new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') return json({ error: 'El archivo no es un PDF' }, 400);

    let nombre = limpio(nombrePedido, 180).replace(/\.pdf$/i, '');
    if (!nombre) nombre = limpio(`Parte ${parte.fecha ?? ''} ${parte.cliente ?? ''} ${parte.obra ?? ''}`, 180);
    nombre += '.pdf';
    const anio = /^\d{4}/.exec(String(parte.fecha ?? ''))?.[0] ?? 'Sin fecha';
    const g = await subirDrive([anio, limpio(operario, 80) || 'Sin operario'], nombre, pdf_base64);
    const fila = {
      parte_id, destino, nombre, archivo_id: g.archivo_id, enlace: g.enlace,
      guardado_por: [perfil.nombre, perfil.apellido].filter(Boolean).join(' ').trim() || perfil.email,
    };
    // Si dos administradores lo mandan a la vez, gana el primero (el segundo archivo queda como copia en la nube).
    await sb.from('partes_pdf_nube').upsert(fila, { onConflict: 'parte_id', ignoreDuplicates: true });
    const { data: final } = await sb.from('partes_pdf_nube').select('*').eq('parte_id', parte_id).maybeSingle();
    return json({ estado: 'guardado', ...(final ?? fila) });
  } catch (e) {
    return json({ error: (e as Error).message || 'Error inesperado' }, 502);
  }
});
