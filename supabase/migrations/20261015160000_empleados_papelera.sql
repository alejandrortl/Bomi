-- Papelera de contactos: empleados que no se pueden eliminar porque tienen registros asociados.
-- Solo la gestionan Admin/SuperAdmin (un Admin no puede mover a un SuperAdmin).
alter table public.perfiles
  add column if not exists en_papelera boolean not null default false,
  add column if not exists papelera_at timestamptz,
  add column if not exists papelera_activo boolean;

create or replace function public.proteger_papelera_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.en_papelera is distinct from old.en_papelera
     or new.papelera_at is distinct from old.papelera_at
     or new.papelera_activo is distinct from old.papelera_activo then
    if not public.es_admin() then
      raise exception 'Solo un administrador puede usar la papelera de empleados' using errcode = '42501';
    end if;
    if old.rol = 'SuperAdmin' and not exists (select 1 from public.perfiles where id = auth.uid() and rol = 'SuperAdmin') then
      raise exception 'Solo un SuperAdmin puede mover a un SuperAdmin' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger trg_proteger_papelera_perfil before update on public.perfiles for each row execute function public.proteger_papelera_perfil();
