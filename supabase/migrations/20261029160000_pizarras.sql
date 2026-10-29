-- PIZARRAS en Cloudflare R2 + copia en Google Drive (como las fotos de obra).
-- Cada vez que se guarda una pizarra (Bitácora o Diario) se crea una fila nueva (una versión):
--   clave        -> imagen final (foto de fondo + dibujo) en JPG 1000×700, en R2.
--   clave_fondo  -> solo la foto de fondo (JPG 1000×700), para poder seguir editando sin perderla.
--   trazos       -> las líneas dibujadas (lápiz, rectas, círculos, borrador), para poder editarlas después.
-- El registro (bitacora.imagen_pizarra / tareas.dibujo_url) guarda "r2:<clave>" de la versión actual.
-- La Edge Function `fotos-obra` copia la imagen final a Drive: Bomi - Fotos / <Cliente> / <Obra> / Pizarras /
-- En Drive NUNCA se borra nada desde la app (queda el historial de versiones).

create table if not exists public.pizarras (
  id uuid primary key default gen_random_uuid(),
  origen text not null check (origen in ('bitacora', 'tarea')),
  registro_id uuid,                        -- id del registro de bitácora o de la tarea
  cliente_id uuid,
  obra_id uuid,
  cliente text,
  obra text,
  clave text not null unique,              -- pizarras/AAAA/MM/<id>.jpg
  clave_fondo text,                        -- pizarras/AAAA/MM/<id>-f.jpg (o la de una versión anterior)
  trazos jsonb not null default '[]'::jsonb,
  bytes integer,
  creada_por text,
  creada_por_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  drive_estado text not null default 'pendiente' check (drive_estado in ('pendiente', 'guardada', 'error')),
  drive_id text,
  drive_enlace text,
  drive_error text,
  drive_intentos integer not null default 0,
  drive_intento_at timestamptz
);

create index if not exists pizarras_registro_idx on public.pizarras (registro_id, created_at desc);
create index if not exists pizarras_drive_idx on public.pizarras (drive_estado) where drive_estado <> 'guardada';

alter table public.pizarras enable row level security;

drop policy if exists "solo usuarios aprobados" on public.pizarras;
create policy "solo usuarios aprobados" on public.pizarras as restrictive for all to authenticated
  using ((select public.es_activo())) with check ((select public.es_activo()));

drop policy if exists "pizarras ver" on public.pizarras;
create policy "pizarras ver" on public.pizarras for select to authenticated using (true);

-- Cada uno inserta solo a su nombre y sin tocar el estado de la copia en Drive.
drop policy if exists "pizarras crear" on public.pizarras;
create policy "pizarras crear" on public.pizarras for insert to authenticated
  with check (creada_por_id = (select auth.uid()) and drive_estado = 'pendiente' and drive_id is null and drive_intentos = 0);

-- Sin update/delete desde la app: cada edición es una versión nueva; el estado de Drive lo cambia la Edge Function.
revoke update, delete on public.pizarras from anon, authenticated;
