// Edge Function `fotos-obra` (desplegar con verify_jwt = false: la propia función comprueba la sesión y el rol).
// Bitácora fotográfica. Las fotos llegan ya reducidas desde el móvil (1600 px y miniatura de 400 px, JPG) y se guardan
// en Cloudflare R2 (privado). Después se copia cada foto a Google Drive: Bomi - Fotos / <Cliente> / <Obra> / archivo.jpg
// En Drive NUNCA se borra nada desde la app: es el archivo de respaldo (que se sincroniza con el disco de la oficina).
//
// Acciones (todas exigen un usuario aprobado):
//  - subir  (cabeceras x-accion: subir, x-clave: ruta; cuerpo: la imagen JPG) → la guarda en R2.
//  - enlaces { claves[] }  → enlaces temporales (6 h) para ver las fotos.
//  - borrar  { id }        → borra la foto de R2 y su fila. Solo quien la subió o Admin/SuperAdmin.
//  - drive   { ids?, tipo? } → copia a Drive las fotos pendientes (las indicadas o, si no, las más antiguas).
//                            Con tipo 'pizarras', las pizarras: Bomi - Fotos / <Cliente> / <Obra> / Pizarras / archivo.jpg
//  - leer    { clave }     → devuelve la imagen (para editar una pizarra con su foto de fondo o meterla en un PDF).
//  - estado                → si R2 y Drive están configurados.
//
// Secretos: R2_ENDPOINT (la URL "S3 API" del bucket), R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY;
// y para Drive los mismos que `guardar-parte-nube`: GOOGLE_SCRIPT_URL y GOOGLE_SCRIPT_CLAVE.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const MAX_BYTES = 4 * 1024 * 1024;
// fotos/AAAA/MM/<id>.jpg (y -m, miniatura) · pizarras/AAAA/MM/<id>.jpg (y -f, la foto de fondo sola)
const CLAVE_OK = /^(fotos\/\d{4}\/\d{2}\/[0-9a-f-]{36}(-m)?|pizarras\/\d{4}\/\d{2}\/[0-9a-f-]{36}(-f)?)\.jpg$/;
const CARPETA_DRIVE = 'Bomi - Fotos';
const DRIVE_POR_LLAMADA = 5;
const DRIVE_MAX_INTENTOS = 5;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-retry-count, traceparent, tracestate, baggage, x-accion, x-clave',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- R2 ----------
const bucket = () => Deno.env.get('R2_BUCKET') ?? '';
function r2Configurado(): boolean {
  return /^https:\/\//.test(Deno.env.get('R2_ENDPOINT') ?? '') && !!bucket() && !!Deno.env.get('R2_ACCESS_KEY_ID') && !!Deno.env.get('R2_SECRET_ACCESS_KEY');
}
// Cloudflare enseña la URL "S3 API" con el nombre del bucket al final: se acepta con y sin él.
function urlR2(clave: string): string {
  let base = (Deno.env.get('R2_ENDPOINT') ?? '').replace(/\/+$/, '');
  if (base.endsWith('/' + bucket())) base = base.slice(0, -bucket().length - 1);
  return `${base}/${bucket()}/${clave.split('/').map(encodeURIComponent).join('/')}`;
}
let aws: AwsClient | null = null;
const r2 = () => aws ??= new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!, secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!, service: 's3', region: 'auto',
});
async function r2Pedir(metodo: string, clave: string, cuerpo?: Uint8Array<ArrayBuffer>): Promise<Response> {
  const r = await r2().fetch(urlR2(clave), { method: metodo, body: cuerpo, headers: cuerpo ? { 'Content-Type': 'image/jpeg' } : undefined });
  if (!r.ok && !(metodo === 'DELETE' && r.status === 404)) throw new Error(`Almacén de fotos (R2): error ${r.status} al ${metodo === 'PUT' ? 'guardar' : metodo === 'GET' ? 'leer' : 'borrar'} la foto.`);
  return r;
}
async function r2Enlace(clave: string): Promise<string> {
  const firmado = await r2().sign(new Request(urlR2(clave) + '?X-Amz-Expires=21600'), { aws: { signQuery: true } });
  return firmado.url;
}

// ---------- Google Drive (Apps Script de tools/google-drive-apps-script.gs) ----------
function driveConfigurado(): boolean {
  return /^https:\/\//.test(Deno.env.get('GOOGLE_SCRIPT_URL') ?? '') && !!Deno.env.get('GOOGLE_SCRIPT_CLAVE');
}
async function subirDrive(ruta: string[], nombre: string, base64: string): Promise<{ id: string; enlace: string | null }> {
  const r = await fetch(Deno.env.get('GOOGLE_SCRIPT_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clave: Deno.env.get('GOOGLE_SCRIPT_CLAVE'), carpeta: CARPETA_DRIVE, ruta, nombre, tipo: 'image/jpeg', base64 }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d) throw new Error('Google Drive no responde (' + r.status + ').');
  if (d.error || !d.id) throw new Error('Google Drive: ' + (d.error ?? 'respuesta inesperada'));
  return { id: d.id, enlace: d.enlace ?? null };
}
function aBase64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
const limpio = (s: unknown, max: number) => String(s ?? '').replace(/[\\/:*?"<>|#%\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+/, '').trim().slice(0, max);

type Foto = { id: string; cliente: string; obra: string; clave: string; subida_por: string | null; tomada_at: string | null; created_at: string; drive_intentos: number };

// Fotos y pizarras se copian igual; cambia la tabla, las columnas y la carpeta final.
const TIPOS = {
  fotos: { tabla: 'fotos_obra', columnas: 'id, cliente, obra, clave, subida_por, tomada_at, created_at, drive_intentos', sub: [] as string[], extra: '' },
  pizarras: { tabla: 'pizarras', columnas: 'id, cliente, obra, clave, subida_por:creada_por, created_at, drive_intentos', sub: ['Pizarras'], extra: ' · Pizarra' },
};
type Tipo = keyof typeof TIPOS;

// 2026-10-28 17.20 · Alejandro Ruiz · 1a2b3c.jpg (hora de Madrid; el final del id evita nombres repetidos)
function nombreDrive(f: Foto, extra = ''): string {
  const d = new Date(f.tomada_at ?? f.created_at);
  const p = Object.fromEntries(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return limpio(`${p.year}-${p.month}-${p.day} ${p.hour}.${p.minute} · ${f.subida_por || 'Sin nombre'}${extra} · ${f.id.slice(0, 6)}`, 150) + '.jpg';
}

async function copiarADrive(ids: string[] | null, tipo: Tipo = 'fotos'): Promise<{ guardadas: number; errores: number }> {
  const T = TIPOS[tipo];
  let q = sb.from(T.tabla).select(T.columnas)
    .neq('drive_estado', 'guardada')
    // Tras varios fallos seguidos (p. ej. el script de Drive sin actualizar) solo se vuelve a probar una vez al día.
    .or(`drive_intentos.lt.${DRIVE_MAX_INTENTOS},drive_intento_at.lt.${new Date(Date.now() - 86400000).toISOString()}`)
    .order('created_at').limit(DRIVE_POR_LLAMADA);
  if (ids && ids.length) q = q.in('id', ids.slice(0, DRIVE_POR_LLAMADA));
  const { data, error } = await q;
  if (error) throw error;
  let guardadas = 0, errores = 0;
  for (const f of (data ?? []) as unknown as Foto[]) {
    // Se marca el intento antes de empezar: si dos llamadas coinciden, solo una se queda con la foto.
    const { data: mia } = await sb.from(T.tabla).update({ drive_intentos: f.drive_intentos + 1, drive_intento_at: new Date().toISOString() })
      .eq('id', f.id).eq('drive_intentos', f.drive_intentos).neq('drive_estado', 'guardada').select('id');
    if (!mia || !mia.length) continue;
    try {
      const img = new Uint8Array(await (await r2Pedir('GET', f.clave)).arrayBuffer());
      const g = await subirDrive([limpio(f.cliente, 80) || 'Sin cliente', limpio(f.obra, 80) || 'Sin obra', ...T.sub], nombreDrive(f, T.extra), aBase64(img));
      await sb.from(T.tabla).update({ drive_estado: 'guardada', drive_id: g.id, drive_enlace: g.enlace, drive_error: null }).eq('id', f.id);
      guardadas++;
    } catch (e) {
      await sb.from(T.tabla).update({ drive_estado: 'error', drive_error: String((e as Error).message ?? e).slice(0, 300) }).eq('id', f.id);
      errores++;
    }
  }
  return { guardadas, errores };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: 'Sesión no válida' }, 401);
    const { data: perfil } = await sb.from('perfiles').select('id, rol, activo, en_papelera').eq('id', u.user.id).maybeSingle();
    if (!perfil || perfil.activo !== true || perfil.en_papelera === true) return json({ error: 'Tu usuario no está aprobado' }, 403);
    const esAdmin = ['Admin', 'SuperAdmin'].includes(perfil.rol);

    // Subida: el cuerpo es la imagen, los datos van en cabeceras.
    if (req.headers.get('x-accion') === 'subir') {
      if (!r2Configurado()) return json({ error: 'El almacén de fotos (R2) aún no está configurado.', codigo: 'sin_configurar' }, 503);
      const clave = req.headers.get('x-clave') ?? '';
      if (!CLAVE_OK.test(clave)) return json({ error: 'Nombre de foto no válido' }, 400);
      const img = new Uint8Array(await req.arrayBuffer());
      if (img.length > MAX_BYTES) return json({ error: 'La foto es demasiado grande' }, 413);
      if (img.length < 4 || img[0] !== 0xff || img[1] !== 0xd8 || img[2] !== 0xff) return json({ error: 'El archivo no es una foto JPG' }, 400);
      await r2Pedir('PUT', clave, img);
      return json({ ok: true, clave });
    }

    const cuerpo = await req.json().catch(() => ({}));
    const accion = cuerpo?.accion;

    if (accion === 'estado') return json({ r2: r2Configurado(), drive: driveConfigurado(), admin: esAdmin });

    if (accion === 'enlaces') {
      if (!r2Configurado()) return json({ error: 'El almacén de fotos (R2) aún no está configurado.', codigo: 'sin_configurar' }, 503);
      const claves = (Array.isArray(cuerpo.claves) ? cuerpo.claves : []).filter((c: unknown) => typeof c === 'string' && CLAVE_OK.test(c)).slice(0, 300) as string[];
      const enlaces: Record<string, string> = {};
      for (const c of claves) enlaces[c] = await r2Enlace(c);
      return json({ enlaces, caduca_en: 21600 });
    }

    if (accion === 'borrar') {
      if (typeof cuerpo.id !== 'string') return json({ error: 'Faltan datos' }, 400);
      const { data: f } = await sb.from('fotos_obra').select('id, clave, clave_miniatura, subida_por_id').eq('id', cuerpo.id).maybeSingle();
      if (!f) return json({ ok: true });
      if (!esAdmin && f.subida_por_id !== perfil.id) return json({ error: 'Solo quien subió la foto o un administrador puede eliminarla' }, 403);
      if (r2Configurado()) {
        await r2Pedir('DELETE', f.clave);
        if (f.clave_miniatura) await r2Pedir('DELETE', f.clave_miniatura);
      }
      const { error } = await sb.from('fotos_obra').delete().eq('id', f.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (accion === 'drive') {
      if (!driveConfigurado() || !r2Configurado()) return json({ estado: 'sin_configurar' });
      const ids = Array.isArray(cuerpo.ids) ? cuerpo.ids.filter((x: unknown) => typeof x === 'string') : null;
      return json({ estado: 'hecho', ...(await copiarADrive(ids, cuerpo.tipo === 'pizarras' ? 'pizarras' : 'fotos')) });
    }

    if (accion === 'leer') {
      if (!r2Configurado()) return json({ error: 'El almacén de fotos (R2) aún no está configurado.', codigo: 'sin_configurar' }, 503);
      if (typeof cuerpo.clave !== 'string' || !CLAVE_OK.test(cuerpo.clave)) return json({ error: 'Nombre de imagen no válido' }, 400);
      const r = await r2Pedir('GET', cuerpo.clave);
      // octet-stream: así supabase-js lo entrega como Blob (con image/jpeg lo convertiría en texto).
      return new Response(r.body, { headers: { ...CORS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' } });
    }

    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Error inesperado' }, 502);
  }
});
