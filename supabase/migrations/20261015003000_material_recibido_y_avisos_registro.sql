-- 1) Material recibido: quién lo marcó como recibido y cuándo (estado = 'Recibido').
--    La app funciona sin estas columnas (guarda solo el estado), pero con ellas conserva el dato exacto.
alter table public.materiales_solicitudes
  add column if not exists recibido_por text,
  add column if not exists recibido_at timestamptz;

-- 2) Candado: el aviso "Nuevo registro pendiente" solo puede llegar a Admin/SuperAdmin activos,
--    se haya creado desde donde se haya creado.
create or replace function public.filtrar_aviso_registro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.titulo, '')) like 'nuevo registro pendiente%' then
    if not exists (
      select 1 from public.perfiles p
      where p.id = new.user_id and p.activo = true and p.rol in ('Admin', 'SuperAdmin')
    ) then
      return null;  -- no se crea la notificación
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_filtrar_aviso_registro on public.notificaciones;
create trigger trg_filtrar_aviso_registro
  before insert on public.notificaciones
  for each row execute function public.filtrar_aviso_registro();
