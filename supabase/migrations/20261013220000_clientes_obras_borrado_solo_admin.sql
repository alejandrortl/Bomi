-- Clientes y obras: eliminar solo para Admin y SuperAdmin.
--
-- Hoy las tablas `clientes` y `obras` tienen dos políticas "ALL" duplicadas cada una
-- (cualquier usuario autenticado puede hacerlo todo, incluido borrar).
-- Esta migración las sustituye por políticas separadas:
--   ver / crear / editar -> cualquier usuario autenticado (igual que ahora)
--   eliminar             -> solo perfiles activos con rol Admin o SuperAdmin
--
-- Los contactos (contactos_clientes, contactos_obras) no se tocan: cualquier usuario
-- puede añadir y quitar contactos al editar. Al borrar un cliente u obra, sus contactos
-- se borran en cascada por la propia base de datos.
--
-- IMPORTANTE: esta regla solo es tan fuerte como la protección de la tabla `perfiles`.
-- Ahora mismo la política "Permitir actualizar perfiles" deja a cualquier usuario autenticado
-- cambiar cualquier perfil (incluido su propio rol). Conviene cerrarla cuando se trabaje Equipo.

begin;

-- clientes
drop policy if exists "Acceso autenticado clientes" on public.clientes;
drop policy if exists "Acceso clientes" on public.clientes;

create policy "clientes_ver" on public.clientes
    for select to authenticated using (true);

create policy "clientes_crear" on public.clientes
    for insert to authenticated with check (true);

create policy "clientes_editar" on public.clientes
    for update to authenticated using (true) with check (true);

create policy "clientes_eliminar_solo_admin" on public.clientes
    for delete to authenticated
    using (exists (
        select 1 from public.perfiles p
        where p.id = (select auth.uid())
          and p.activo
          and p.rol in ('Admin', 'SuperAdmin')
    ));

-- obras
drop policy if exists "Acceso obras" on public.obras;
drop policy if exists "Acceso total obras" on public.obras;

create policy "obras_ver" on public.obras
    for select to authenticated using (true);

create policy "obras_crear" on public.obras
    for insert to authenticated with check (true);

create policy "obras_editar" on public.obras
    for update to authenticated using (true) with check (true);

create policy "obras_eliminar_solo_admin" on public.obras
    for delete to authenticated
    using (exists (
        select 1 from public.perfiles p
        where p.id = (select auth.uid())
          and p.activo
          and p.rol in ('Admin', 'SuperAdmin')
    ));

commit;
