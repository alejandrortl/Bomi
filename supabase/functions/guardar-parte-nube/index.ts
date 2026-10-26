// Edge Function `guardar-parte-nube` (desplegar CON verify_jwt, la opción por defecto).
// La app la llama justo después de bloquear un parte, con el PDF ya dibujado (el mismo que se descarga),
// y la función lo guarda en la nube de la empresa. Solo Admin/SuperAdmin y solo partes bloqueados.
// Cada parte se guarda una sola vez: si ya está en la tabla `partes_pdf_nube`, devuelve lo guardado.
//
// Se guarda en Google Drive: Bomi - Partes bloqueados / <año de la fecha del parte> / <primer operario> / S44-10-26-2026-Cliente-Obra.pdf
// Las carpetas que no existan se crean. El nombre del archivo y el operario los manda la app (los mismos que al descargar).
// Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// y opcional GOOGLE_DRIVE_CARPETA_ID (carpeta principal; si falta, usa o crea "Bomi - Partes bloqueados").
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const MAX_BYTES = 15 * 1024 * 1024;
const CARPETA_POR_DEFECTO = 'Bomi - Partes bloqueados';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Guardado = { archivo_id: string; enlace: string | null };

// ---------- Google Drive ----------
async function tokenGoogle(): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '',
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('Google no acepta las credenciales (' + (d.error ?? r.status) + '). Revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.');
  return d.access_token;
}

// Busca la carpeta `nombre` (dentro de `padre`, o en la raíz si no hay padre) y la crea si no existe.
async function carpetaDrive(token: string, nombre: string, padre: string | null): Promise<string> {
  const auth = { Authorization: 'Bearer ' + token };
  const literal = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name = '${literal}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` + (padre ? ` and '${padre}' in parents` : '');
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true&q=' + encodeURIComponent(q), { headers: auth });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.files?.length) return d.files[0].id;
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', ...(padre ? { parents: [padre] } : {}) }),
  });
  const cd = await c.json().catch(() => ({}));
  if (!c.ok || !cd.id) throw new Error('No se pudo crear la carpeta «' + nombre + '» en Google Drive (' + c.status + ').');
  return cd.id;
}

async function subirDrive(ruta: string[], nombre: string, pdf: Uint8Array<ArrayBuffer>): Promise<Guardado> {
  const token = await tokenGoogle();
  let carpeta = Deno.env.get('GOOGLE_DRIVE_CARPETA_ID') || await carpetaDrive(token, CARPETA_POR_DEFECTO, null);
  for (const sub of ruta) carpeta = await carpetaDrive(token, sub, carpeta);
  const limite = 'bomi' + crypto.randomUUID().replace(/-/g, '');
  const cabecera = new TextEncoder().encode(
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: nombre, parents: [carpeta], mimeType: 'application/pdf' }) +
    `\r\n--${limite}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  const pie = new TextEncoder().encode(`\r\n--${limite}--`);
  const cuerpo = new Uint8Array(cabecera.length + pdf.length + pie.length);
  cuerpo.set(cabecera, 0); cuerpo.set(pdf, cabecera.length); cuerpo.set(pie, cabecera.length + pdf.length);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw new Error('Google Drive no aceptó el archivo (' + (d.error?.message ?? r.status) + ').');
  return { archivo_id: d.id, enlace: d.webViewLink ?? null };
}

// ---------- Utilidades ----------
function configurado(): boolean {
  return !!(Deno.env.get('GOOGLE_CLIENT_ID') && Deno.env.get('GOOGLE_CLIENT_SECRET') && Deno.env.get('GOOGLE_REFRESH_TOKEN'));
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
    const g = await subirDrive([anio, limpio(operario, 80) || 'Sin operario'], nombre, pdf);
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
