-- Diario: las tareas que acaban el día sin completar pasan a "Pendiente" y se quedan SIN operario asignado,
-- para que un administrador se la asigne a quien vaya a ir a hacerla o acabarla.
-- * pendiente_desde: fecha original de la tarea (la del primer día que se quedó sin hacer). No cambia.
-- * operario_original: a quién estaba asignada antes de quedar pendiente (solo informativo).
-- * asignada_el: día en que se le asignó el operario actual. Si al acabar ese día sigue sin hacer, se vuelve a quitar.
alter table public.tareas add column if not exists pendiente_desde date;
alter table public.tareas add column if not exists operario_original text;
alter table public.tareas add column if not exists asignada_el date;

-- Al asignar (o cambiar) el operario a mano, se apunta el día de hoy (hora de España).
create or replace function public.tarea_asignada_el() returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('bomi.cascada', true) = '1' then return new; end if;
  if nullif(btrim(coalesce(new.operario_asignado, '')), '') is not null
     and (tg_op = 'INSERT' or public.norm_txt(new.operario_asignado) is distinct from public.norm_txt(old.operario_asignado)) then
    new.asignada_el := (now() at time zone 'Europe/Madrid')::date;
  end if;
  return new;
end $$;
drop trigger if exists trg_tarea_asignada_el on public.tareas;
create trigger trg_tarea_asignada_el before insert or update on public.tareas for each row execute function public.tarea_asignada_el();

-- La app la llama al abrir el Diario. Pasa a pendiente (sin operario) toda tarea sin completar
-- cuyo día ya acabó y cuyo operario no se asignó hoy.
create or replace function public.pasar_tareas_pendientes() returns integer language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'Europe/Madrid')::date; n integer;
begin
  if auth.uid() is not null and not public.es_activo() then return 0; end if;
  perform set_config('bomi.cascada', '1', true); -- deja pasar el cambio por las protecciones de "tareas"
  update public.tareas set
      pendiente_desde = coalesce(pendiente_desde, left(fecha::text, 10)::date),
      operario_original = operario_asignado,
      operario_asignado = null,
      operario_username = null
    where coalesce(completada, false) = false
      and fecha::text ~ '^\d{4}-\d{2}-\d{2}' and left(fecha::text, 10)::date < hoy
      and nullif(btrim(coalesce(operario_asignado, '')), '') is not null
      and coalesce(asignada_el, left(fecha::text, 10)::date) < hoy;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.pasar_tareas_pendientes() from public, anon;
grant execute on function public.pasar_tareas_pendientes() to authenticated;

-- Se aplica ya a las tareas atrasadas que haya ahora mismo.
select public.pasar_tareas_pendientes();
