-- Cuando alguien se registra (perfil con activo = false), avisa a todos los Admin/SuperAdmin activos.
-- SECURITY DEFINER: el usuario recién registrado no tiene permiso para escribir notificaciones ajenas.
create or replace function public.notificar_registro_pendiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.activo is distinct from true then
    insert into public.notificaciones (user_id, titulo, mensaje)
    select p.id,
           'Nuevo registro pendiente',
           coalesce(nullif(trim(coalesce(new.nombre,'') || ' ' || coalesce(new.apellido,'')), ''), new.email, 'Un usuario')
             || coalesce(' (' || new.email || ')', '')
             || ' solicita acceso y requiere aprobación.'
    from public.perfiles p
    where p.activo = true
      and p.rol in ('Admin', 'SuperAdmin')
      and p.id <> new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.notificar_registro_pendiente() from public, anon, authenticated;

drop trigger if exists trg_notificar_registro_pendiente on public.perfiles;
create trigger trg_notificar_registro_pendiente
  after insert on public.perfiles
  for each row execute function public.notificar_registro_pendiente();
