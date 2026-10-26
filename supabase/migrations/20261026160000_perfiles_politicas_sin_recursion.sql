-- PERFILES: arregla "infinite recursion detected in policy for relation perfiles" al eliminar usuarios.
-- Causa: alguna política antigua de `perfiles` (creada desde el panel, no está en las migraciones) consulta
-- la propia tabla `perfiles` directamente para saber si eres Admin. Al evaluarla, Postgres vuelve a aplicar
-- las políticas de `perfiles` y entra en bucle.
-- Solución: se borran TODAS las políticas de `perfiles` y se crean de nuevo usando solo funciones
-- SECURITY DEFINER (es_activo, es_admin, es_superadmin), que leen `perfiles` sin pasar por las políticas.

-- 1) Funciones de ayuda (por si en la base de datos quedaron versiones sin SECURITY DEFINER)
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('Admin', 'SuperAdmin'))
$$;
create or replace function public.es_activo() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo is true and coalesce(en_papelera, false) = false)
$$;
create or replace function public.es_superadmin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'SuperAdmin' and activo is true)
$$;

-- 2) Fuera todas las políticas actuales de perfiles (antiguas y nuevas)
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'perfiles' loop
    execute format('drop policy %I on public.perfiles', p.policyname);
  end loop;
end $$;

alter table public.perfiles enable row level security;

-- 3) Políticas permisivas (qué se permite)
create policy "perfiles ver" on public.perfiles for select to authenticated using (true);
create policy "perfiles registrar" on public.perfiles for insert to authenticated with check (id = (select auth.uid()));
create policy "perfiles editar" on public.perfiles for update to authenticated using (id = (select auth.uid()) or (select public.es_admin())) with check (true);
create policy "perfiles eliminar" on public.perfiles for delete to authenticated using ((select public.es_admin()));

-- 4) Políticas restrictivas (límites que siempre se cumplen; las mismas de la migración de seguridad)
create policy "perfiles ver aprobados o propio" on public.perfiles as restrictive for select to authenticated using ((select public.es_activo()) or id = (select auth.uid()));
create policy "perfiles editar propio o admin" on public.perfiles as restrictive for update to authenticated using ((select public.es_activo()) and (id = (select auth.uid()) or (select public.es_admin()))) with check (true);
create policy "perfiles registrar propio" on public.perfiles as restrictive for insert to authenticated with check (id = (select auth.uid()));
-- Eliminar: solo Admin/SuperAdmin aprobados, nunca a uno mismo, y a un SuperAdmin solo otro SuperAdmin
create policy "perfiles eliminar solo admin" on public.perfiles as restrictive for delete to authenticated using (
  (select public.es_activo()) and (select public.es_admin())
  and id <> (select auth.uid())
  and (rol is distinct from 'SuperAdmin' or (select public.es_superadmin()))
);

-- 5) Comprobación: políticas de OTRAS tablas que consultan `perfiles` directamente (sin función).
-- Si el error siguiera, este listado dice cuál es. Lo normal es que salga vacío o sin importancia.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename <> 'perfiles'
  and (coalesce(qual, '') ~* '\mperfiles\M' or coalesce(with_check, '') ~* '\mperfiles\M');
