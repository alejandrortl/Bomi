-- Materiales: proveedores (suministradores) al marcar una solicitud como pedida.
-- · Lista de proveedores (solo el nombre). Cualquier usuario aprobado puede añadir uno al pedir; solo Admin y SuperAdmin
--   los cambian de nombre o los borran.
-- · Cada solicitud puede tener varios "pedidos", uno por proveedor, cada uno con quién y cuándo se pidió y se recibió.
--   Cada línea de material apunta al pedido en el que se pidió; si no apunta a ninguno, está "sin pedir".
-- · El estado de la solicitud pasa a poder ser también «Parcialmente pedido» y «Parcialmente recibido».
-- Se puede ejecutar más de una vez sin problema.

-- 1) Proveedores
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists proveedores_nombre_unico on public.proveedores (lower(btrim(nombre)));
alter table public.proveedores enable row level security;
drop policy if exists "proveedores ver" on public.proveedores;
drop policy if exists "proveedores añadir" on public.proveedores;
drop policy if exists "proveedores editar solo admin" on public.proveedores;
drop policy if exists "proveedores eliminar solo admin" on public.proveedores;
create policy "proveedores ver" on public.proveedores for select to authenticated using ((select public.es_activo()));
create policy "proveedores añadir" on public.proveedores for insert to authenticated with check ((select public.es_activo()));
create policy "proveedores editar solo admin" on public.proveedores for update to authenticated using ((select public.es_activo()) and (select public.es_admin())) with check ((select public.es_activo()) and (select public.es_admin()));
create policy "proveedores eliminar solo admin" on public.proveedores for delete to authenticated using ((select public.es_activo()) and (select public.es_admin()));

-- 2) Pedidos por proveedor dentro de una solicitud (solicitud_id con el mismo tipo que materiales_solicitudes.id)
do $$
declare t text;
begin
  select format_type(atttypid, atttypmod) into t from pg_attribute
   where attrelid = 'public.materiales_solicitudes'::regclass and attname = 'id';
  execute format($f$
    create table if not exists public.materiales_pedidos (
      id uuid primary key default gen_random_uuid(),
      solicitud_id %s not null references public.materiales_solicitudes(id) on delete cascade,
      proveedor_id uuid references public.proveedores(id) on delete set null,
      proveedor text not null,
      pedido_por text,
      pedido_at timestamptz not null default now(),
      recibido_por text,
      recibido_at timestamptz,
      created_at timestamptz not null default now()
    )$f$, t);
end $$;
create index if not exists materiales_pedidos_solicitud on public.materiales_pedidos (solicitud_id);
create index if not exists materiales_pedidos_proveedor on public.materiales_pedidos (proveedor_id);
alter table public.materiales_pedidos enable row level security;
drop policy if exists "pedidos de material aprobados" on public.materiales_pedidos;
create policy "pedidos de material aprobados" on public.materiales_pedidos for all to authenticated
  using ((select public.es_activo())) with check ((select public.es_activo()));

-- 3) Cada línea de material sabe en qué pedido se pidió (vacío = sin pedir)
alter table public.materiales_solicitud_items
  add column if not exists pedido_id uuid references public.materiales_pedidos(id) on delete set null;
create index if not exists materiales_solicitud_items_pedido on public.materiales_solicitud_items (pedido_id);

-- 4) Estados nuevos: se quita cualquier restricción antigua que limitara los valores de "estado"
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.materiales_solicitudes'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table public.materiales_solicitudes drop constraint %I', c.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
