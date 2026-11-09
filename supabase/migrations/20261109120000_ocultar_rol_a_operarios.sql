-- EMPLEADOS: los Operarios no pueden ver el rol (Operario / Admin / SuperAdmin) de los demás.
-- Solo Admin y SuperAdmin aprobados ven el rol de todos. Cada usuario sigue viendo el suyo.
--
-- Cómo se consigue:
-- 1) La columna `perfiles.rol` deja de poderse leer directamente desde la app (permiso por columnas).
--    El resto de columnas se siguen leyendo igual que antes.
-- 2) El rol se lee con dos funciones SECURITY DEFINER:
--      mi_perfil()       -> mi propio perfil completo (con mi rol), aunque esté pendiente de aprobar.
--      roles_perfiles()  -> (id, rol) de todos si soy Admin/SuperAdmin aprobado; si no, solo el mío.
-- 3) Las políticas que leían `perfiles.rol` directamente pasan a usar funciones SECURITY DEFINER,
--    porque si no fallarían al quitar el permiso de la columna.
--
-- IMPORTANTE para el futuro: si se añade una columna nueva a `perfiles`, hay que darle permiso de lectura:
--   grant select (nueva_columna) on public.perfiles to authenticated;
-- (o volver a ejecutar el bloque 4 de este archivo, que da permiso a todas menos a `rol`).

-- 1) Funciones de lectura del rol
create or replace function public.mi_perfil() returns setof public.perfiles
language sql stable security definer set search_path = public as $$
  select * from public.perfiles where id = auth.uid()
$$;

create or replace function public.roles_perfiles() returns table (id uuid, rol text)
language sql stable security definer set search_path = public as $$
  select p.id, p.rol::text
  from public.perfiles p
  where p.id = auth.uid() or (public.es_admin() and public.es_activo())
$$;

-- ¿Ese perfil es SuperAdmin? (para la política de eliminar, sin leer la columna directamente)
create or replace function public.perfil_es_superadmin(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = p_id and rol = 'SuperAdmin')
$$;

revoke all on function public.mi_perfil() from public, anon;
revoke all on function public.roles_perfiles() from public, anon;
revoke all on function public.perfil_es_superadmin(uuid) from public, anon;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.roles_perfiles() to authenticated;
grant execute on function public.perfil_es_superadmin(uuid) to authenticated;

-- 2) Políticas que leían `rol` directamente
drop policy if exists "perfiles eliminar solo admin" on public.perfiles;
create policy "perfiles eliminar solo admin" on public.perfiles as restrictive for delete to authenticated using (
  (select public.es_activo()) and (select public.es_admin())
  and id <> (select auth.uid())
  and (not public.perfil_es_superadmin(id) or (select public.es_superadmin()))
);

drop policy if exists "clientes_eliminar_solo_admin" on public.clientes;
create policy "clientes_eliminar_solo_admin" on public.clientes for delete to authenticated
  using ((select public.es_activo()) and (select public.es_admin()));

drop policy if exists "obras_eliminar_solo_admin" on public.obras;
create policy "obras_eliminar_solo_admin" on public.obras for delete to authenticated
  using ((select public.es_activo()) and (select public.es_admin()));

-- 3) Quitar el permiso de lectura de la tabla entera...
revoke select on public.perfiles from anon, authenticated;

-- 4) ...y devolverlo columna a columna, todas menos `rol`.
do $$ declare cols text; begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'perfiles' and column_name <> 'rol';
  execute format('grant select (%s) on public.perfiles to authenticated', cols);
end $$;

-- 5) Comprobación: políticas de OTRAS tablas y vistas que todavía leen `perfiles` directamente.
-- Lo normal es que salga vacío. Si sale algo que use `rol`, avisar: hay que pasarlo a es_admin().
select 'politica' as tipo, tablename::text as objeto, policyname::text as nombre
from pg_policies
where schemaname = 'public' and tablename <> 'perfiles'
  and (coalesce(qual, '') ~* '\mperfiles\M' or coalesce(with_check, '') ~* '\mperfiles\M')
union all
select 'vista', view_name::text, '' from information_schema.view_table_usage
where table_schema = 'public' and table_name = 'perfiles';
