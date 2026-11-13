-- Diario: cada tarea puede llevar una lista de trabajos con casilla.
-- * subtareas: [{ "id", "texto", "hecha", "hecha_el" (fecha), "hecha_por" }]
-- * subtareas_hechas_antes: trabajos hechos en días anteriores. Cuando una tarea pasa al día siguiente sin terminar,
--   los trabajos ya hechos salen de la lista (se guardan aquí) y en la tarea quedan solo los que faltan.
alter table public.tareas add column if not exists subtareas jsonb not null default '[]'::jsonb;
alter table public.tareas add column if not exists subtareas_hechas_antes jsonb not null default '[]'::jsonb;

-- La lista sin las marcas de hecho: sirve para comprobar que quien no puede editar solo marca o desmarca.
create or replace function public.subtareas_sin_marcas(j jsonb) returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(e - 'hecha' - 'hecha_el' - 'hecha_por' order by n), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) with ordinality as x(e, n)
$$;

-- Admin/SuperAdmin y quien creó la tarea la editan. El resto (p. ej. el operario asignado) solo puede
-- marcarla hecha/pendiente y marcar o desmarcar los trabajos de la lista (sin cambiar sus textos).
create or replace function public.proteger_tarea() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if current_setting('bomi.cascada', true) = '1' then return new; end if;
  if public.es_admin() or old.user_id = auth.uid() then return new; end if;
  if (to_jsonb(new) - 'completada' - 'subtareas') is distinct from (to_jsonb(old) - 'completada' - 'subtareas')
     or public.subtareas_sin_marcas(new.subtareas) is distinct from public.subtareas_sin_marcas(old.subtareas) then
    raise exception 'Solo un administrador o quien creó la tarea puede modificarla' using errcode = '42501';
  end if;
  return new;
end $$;

-- Igual que antes (tareas sin terminar de días pasados quedan sin operario) y, además, los trabajos
-- marcados como hechos en días anteriores salen de la lista de las tareas sin terminar.
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

  -- Un trabajo hecho "de antes" es el que tiene fecha de hecho anterior a hoy (o no la tiene).
  update public.tareas t set
      subtareas_hechas_antes = coalesce(t.subtareas_hechas_antes, '[]'::jsonb) || (
        select coalesce(jsonb_agg(e order by k), '[]'::jsonb) from jsonb_array_elements(t.subtareas) with ordinality as x(e, k)
        where (e->>'hecha')::boolean is true and coalesce(nullif(e->>'hecha_el', '')::date, hoy - 1) < hoy),
      subtareas = (
        select coalesce(jsonb_agg(e order by k), '[]'::jsonb) from jsonb_array_elements(t.subtareas) with ordinality as x(e, k)
        where not ((e->>'hecha')::boolean is true and coalesce(nullif(e->>'hecha_el', '')::date, hoy - 1) < hoy))
    where coalesce(t.completada, false) = false
      and jsonb_typeof(t.subtareas) = 'array'
      and exists (select 1 from jsonb_array_elements(t.subtareas) e
                  where (e->>'hecha')::boolean is true and coalesce(nullif(e->>'hecha_el', '')::date, hoy - 1) < hoy);
  return n;
end $$;
revoke all on function public.pasar_tareas_pendientes() from public, anon;
grant execute on function public.pasar_tareas_pendientes() to authenticated;
