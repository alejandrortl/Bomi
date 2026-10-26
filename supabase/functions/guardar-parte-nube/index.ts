// Edge Function `guardar-parte-nube` (desplegar CON verify_jwt, la opción por defecto).
// La app la llama justo después de bloquear un parte, con el PDF ya dibujado (el mismo que se descarga),
// y la función lo guarda en la nube de la empresa. Solo Admin/SuperAdmin y solo partes bloqueados.
// Cada parte se guarda una sola vez: si ya está en la tabla `partes_pdf_nube`, devuelve lo guardado.
//
// Destino según el secreto NUBE_DESTINO:
//   'drive'  (por defecto) → GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//                            y opcional GOOGLE_DRIVE_CARPETA_ID (si falta, crea la carpeta "Bomi - Partes bloqueados").
//   'webdav' (NAS Synology, QNAP, Nextcloud...) → WEBDAV_URL (carpeta, con / final), WEBDAV_USUARIO, WEBDAV_CLAVE.
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

async function carpetaDrive(token: string): Promise<string> {
  const fija = Deno.env.get('GOOGLE_DRIVE_CARPETA_ID');
  if (fija) return fija;
  const auth = { Authorization: 'Bearer ' + token };
  const q = `name = '${CARPETA_POR_DEFECTO}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q), { headers: auth });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.files?.length) return d.files[0].id;
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: CARPETA_POR_DEFECTO, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const cd = await c.json().catch(() => ({}));
  if (!c.ok || !cd.id) throw new Error('No se pudo crear la carpeta en Google Drive (' + c.status + ').');
  return cd.id;
}

async function subirDrive(nombre: string, pdf: Uint8Array<ArrayBuffer>): Promise<Guardado> {
  const token = await tokenGoogle();
  const carpeta = await carpetaDrive(token);
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

// ---------- WebDAV (disco de la oficina) ----------
async function subirWebdav(nombre: string, pdf: Uint8Array<ArrayBuffer>): Promise<Guardado> {
  let base = Deno.env.get('WEBDAV_URL') ?? '';
  if (!/^https:\/\//.test(base)) throw new Error('WEBDAV_URL debe empezar por https://');
  if (!base.endsWith('/')) base += '/';
  const destino = base + encodeURIComponent(nombre);
  const r = await fetch(destino, {
    method: 'PUT',
    headers: {
      Authorization: 'Basic ' + btoa((Deno.env.get('WEBDAV_USUARIO') ?? '') + ':' + (Deno.env.get('WEBDAV_CLAVE') ?? '')),
      'Content-Type': 'application/pdf',
    },
    body: pdf,
  });
  if (!r.ok) throw new Error('El disco de la oficina no aceptó el archivo (' + r.status + ').');
  return { archivo_id: destino, enlace: null };
}

// ---------- Utilidades ----------
function configurado(destino: string): boolean {
  if (destino === 'webdav') return !!Deno.env.get('WEBDAV_URL');
  return !!(Deno.env.get('GOOGLE_CLIENT_ID') && Deno.env.get('GOOGLE_CLIENT_SECRET') && Deno.env.get('GOOGLE_REFRESH_TOKEN'));
}
function deBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
// Nombre legible y seguro para cualquier disco: "Parte 2026-10-26 S43 - Cliente - Obra.pdf"
function nombreArchivo(p: { fecha: string | null; semana?: number | null; cliente: string | null; obra: string | null; id: string }): string {
  const limpio = (s: string | null) => String(s ?? '').replace(/[\\/:*?"<>|#%\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const trozos = [limpio(p.cliente), limpio(p.obra)].filter(Boolean).join(' - ').slice(0, 120);
  const sem = p.semana ? ` S${p.semana}` : '';
  return `Parte ${p.fecha ?? 'sin fecha'}${sem}${trozos ? ' - ' + trozos : ''} (${p.id.slice(0, 8)}).pdf`;
}

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

    const { parte_id, pdf_base64 } = await req.json();
    if (typeof parte_id !== 'string' || typeof pdf_base64 !== 'string') return json({ error: 'Faltan datos' }, 400);

    const { data: hecho } = await sb.from('partes_pdf_nube').select('*').eq('parte_id', parte_id).maybeSingle();
    if (hecho) return json({ estado: 'guardado', ...hecho });

    const destino = (Deno.env.get('NUBE_DESTINO') ?? 'drive').trim().toLowerCase();
    if (!configurado(destino)) return json({ estado: 'sin_configurar' });

    const { data: parte } = await sb.from('partes_trabajo').select('id, fecha, semana, cliente, obra, bloqueado').eq('id', parte_id).maybeSingle();
    if (!parte) return json({ error: 'El parte no existe' }, 404);
    if (!parte.bloqueado) return json({ error: 'Solo se guardan en la nube los partes bloqueados' }, 409);

    const pdf = deBase64(pdf_base64);
    if (pdf.length > MAX_BYTES) return json({ error: 'El PDF es demasiado grande' }, 413);
    if (new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') return json({ error: 'El archivo no es un PDF' }, 400);

    const nombre = nombreArchivo(parte);
    const g = destino === 'webdav' ? await subirWebdav(nombre, pdf) : await subirDrive(nombre, pdf);
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
