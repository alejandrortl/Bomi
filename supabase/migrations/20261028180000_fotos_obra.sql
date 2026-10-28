-- BITÁCORA FOTOGRÁFICA: fotos de obra.
-- Las fotos NO se guardan aquí: van reducidas (1600 px, JPG) a Cloudflare R2 y el servidor hace una copia en
-- Google Drive (Bomi - Fotos / Cliente / Obra). Esta tabla solo guarda dónde está cada foto y sus datos.
-- La sube y la borra la Edge Function `fotos-obra`; la app solo inserta la fila (con su propio usuario) y la lee.

create table if not exists public.fotos_obra (
  id uuid primary key default gen_random_uuid(),
  lote uuid,                               -- fotos subidas a la vez
  cliente_id uuid,
  obra_id uuid,
  cliente text not null,
  obra text not null,
  direccion text,
  localidad text,
  nota text,
  clave text not null unique,              -- ruta de la foto en R2
  clave_miniatura text,                    -- ruta de la miniatura (400 px) en R2
  ancho integer,
  alto integer,
  bytes integer,
  tomada_at timestamptz,                   -- fecha del archivo en el móvil
  subida_por text,
  subida_por_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  drive_estado text not null default 'pendiente' check (drive_estado in ('pendiente', 'guardada', 'error')),
  drive_id text,
  drive_enlace text,
  drive_error text,
  drive_intentos integer not null default 0,
  drive_intento_at timestamptz            -- último intento (tras 5 fallos se vuelve a probar una vez al día)
);

create index if not exists fotos_obra_obra_idx on public.fotos_obra (obra_id, created_at desc);
create index if not exists fotos_obra_creada_idx on public.fotos_obra (created_at desc);
create index if not exists fotos_obra_drive_idx on public.fotos_obra (drive_estado) where drive_estado <> 'guardada';

alter table public.fotos_obra enable row level security;

drop policy if exists "solo usuarios aprobados" on public.fotos_obra;
create policy "solo usuarios aprobados" on public.fotos_obra as restrictive for all to authenticated
  using ((select public.es_activo())) with check ((select public.es_activo()));

drop policy if exists "fotos_obra ver" on public.fotos_obra;
create policy "fotos_obra ver" on public.fotos_obra for select to authenticated using (true);

-- Cada uno inserta solo a su nombre y sin tocar el estado de la copia en Drive.
drop policy if exists "fotos_obra subir" on public.fotos_obra;
create policy "fotos_obra subir" on public.fotos_obra for insert to authenticated
  with check (subida_por_id = (select auth.uid()) and drive_estado = 'pendiente' and drive_id is null and drive_intentos = 0);

-- Sin políticas de update/delete: borrar lo hace la Edge Function (comprueba que sea quien la subió o Admin/SuperAdmin)
-- y los cambios de nombre llegan por los disparadores de abajo.
revoke update, delete on public.fotos_obra from anon, authenticated;

-- Ediciones en cascada (como en el resto de registros): cliente, obra y nombre de quien subió la foto.
create or replace function public.cascada_cliente_fotos() returns trigger language plpgsql security definer set search_path = public as $$
declare v_new text := coalesce(nullif(btrim(new.nombre_cliente), ''), btrim(new.nombre));
begin
  if v_new is null then return new; end if;
  update public.fotos_obra set cliente = v_new where cliente_id = new.id and cliente is distinct from v_new;
  return new;
end $$;
drop trigger if exists trg_cascada_cliente_fotos on public.clientes;
create trigger trg_cascada_cliente_fotos after update on public.clientes for each row execute function public.cascada_cliente_fotos();

create or replace function public.cascada_obra_fotos() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nombre is not distinct from old.nombre and new.direccion is not distinct from old.direccion and new.localidad is not distinct from old.localidad then return new; end if;
  update public.fotos_obra set obra = new.nombre, direccion = new.direccion, localidad = new.localidad where obra_id = new.id;
  return new;
end $$;
drop trigger if exists trg_cascada_obra_fotos on public.obras;
create trigger trg_cascada_obra_fotos after update on public.obras for each row execute function public.cascada_obra_fotos();

create or replace function public.cascada_perfil_fotos() returns trigger language plpgsql security definer set search_path = public as $$
declare v_new text := public.nombre_completo(new.nombre, new.apellido, new.email);
begin
  if v_new = public.nombre_completo(old.nombre, old.apellido, old.email) then return new; end if;
  update public.fotos_obra set subida_por = v_new where subida_por_id = new.id;
  return new;
end $$;
drop trigger if exists trg_cascada_perfil_fotos on public.perfiles;
create trigger trg_cascada_perfil_fotos after update on public.perfiles for each row execute function public.cascada_perfil_fotos();
