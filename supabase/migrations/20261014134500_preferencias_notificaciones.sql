-- Preferencias de notificaciones de cada usuario: { "aprobaciones": bool, "tareas": bool, "material": bool, "generales": bool }.
-- Una clave ausente cuenta como activada.
alter table public.perfiles
  add column if not exists preferencias_notificaciones jsonb not null default '{}'::jsonb;

-- El aviso de registro pendiente (ver 20261014064500) solo llega a Admin/SuperAdmin que no lo hayan desactivado.
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
      and p.id <> new.id
      and coalesce(p.preferencias_notificaciones ->> 'aprobaciones', 'true') <> 'false';
  end if;
  return new;
end;
$$;

revoke all on function public.notificar_registro_pendiente() from public, anon, authenticated;

drop trigger if exists trg_notificar_registro_pendiente on public.perfiles;
create trigger trg_notificar_registro_pendiente
  after insert on public.perfiles
  for each row execute function public.notificar_registro_pendiente();
