-- SEGURIDAD
-- 1) Solo los usuarios APROBADOS (activo, fuera de la papelera) pueden leer o escribir datos de la app.
-- 2) Los registros nuevos son siempre Operario y quedan pendientes de aprobación.
-- 3) Solo Admin/SuperAdmin cambian roles o aprueban usuarios; solo un SuperAdmin puede crear o tocar a otro SuperAdmin.
-- 4) Tablas antiguas sin uso: se bloquean. Las notificaciones ya no se pueden insertar sin sesión.

create or replace function public.es_activo() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo is true and coalesce(en_papelera, false) = false)
$$;
create or replace function public.es_superadmin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'SuperAdmin' and activo is true)
$$;

-- Registro nuevo: siempre Operario y pendiente
create or replace function public.forzar_perfil_nuevo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.es_admin() then
    new.rol := 'Operario'; new.activo := false; new.en_papelera := false; new.papelera_at := null; new.papelera_activo := null;
  end if;
  return new;
end $$;
create trigger trg_forzar_perfil_nuevo before insert on public.perfiles for each row execute function public.forzar_perfil_nuevo();

-- Cambios de rol / aprobación
create or replace function public.proteger_rol_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.id is distinct from old.id then raise exception 'No se puede cambiar el identificador' using errcode = '42501'; end if;
  if new.rol is distinct from old.rol or new.activo is distinct from old.activo then
    if not public.es_admin() then
      raise exception 'Solo un administrador puede cambiar roles o aprobar usuarios' using errcode = '42501';
    end if;
    if (old.rol = 'SuperAdmin' or new.rol = 'SuperAdmin') and not public.es_superadmin() then
      raise exception 'Solo un SuperAdmin puede cambiar el rol de un SuperAdmin o crear otro' using errcode = '42501';
    end if;
  end if;
  if old.rol = 'SuperAdmin' and old.id <> auth.uid() and not public.es_superadmin() then
    raise exception 'Solo un SuperAdmin puede modificar a otro SuperAdmin' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_proteger_rol_perfil before update on public.perfiles for each row execute function public.proteger_rol_perfil();

-- Solo usuarios aprobados (políticas RESTRICTIVAS: se suman a las que ya existen)
do $$ declare t text; begin
  foreach t in array array['bitacora','clientes','configuracion_empresa','contactos_clientes','contactos_obras','materiales_catalogo','materiales_solicitud_items','materiales_solicitudes','mensajes','obras','partes_materiales','partes_operarios','partes_trabajo','push_subscriptions','tareas'] loop
    execute format('create policy "solo usuarios aprobados" on public.%I as restrictive for all to authenticated using ((select public.es_activo())) with check ((select public.es_activo()))', t);
  end loop;
end $$;
create policy "solo usuarios aprobados" on public.notificaciones as restrictive for all to public using ((select public.es_activo())) with check ((select public.es_activo()));

-- perfiles: cada uno ve su propio perfil aunque esté pendiente (para mostrar el aviso); el resto, solo aprobados
create policy "perfiles ver aprobados o propio" on public.perfiles as restrictive for select to authenticated using ((select public.es_activo()) or id = (select auth.uid()));
create policy "perfiles editar propio o admin" on public.perfiles as restrictive for update to authenticated using ((select public.es_activo()) and (id = (select auth.uid()) or (select public.es_admin()))) with check (true);
create policy "perfiles registrar propio" on public.perfiles as restrictive for insert to authenticated with check (id = (select auth.uid()));
create policy "perfiles eliminar solo admin" on public.perfiles as restrictive for delete to public using ((select public.es_admin()));

-- Tablas antiguas sin uso: bloqueadas
alter table public.diario enable row level security;
alter table public.empleados enable row level security;
alter table public.lineas_material enable row level security;
alter table public.lineas_parte_material enable row level security;
alter table public.lineas_parte_operarios enable row level security;
alter table public.partes enable row level security;
alter table public.solicitudes_material enable row level security;

-- Subida de archivos: solo aprobados
create policy "subida solo aprobados" on storage.objects as restrictive for insert to authenticated with check ((select public.es_activo()));
