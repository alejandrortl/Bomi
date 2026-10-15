-- Semana del año (ISO 8601) de la fecha del parte. Se calcula sola y siempre coincide con la fecha,
-- incluso si se corrige la fecha directamente en Supabase.
alter table public.partes_trabajo
  add column if not exists semana smallint generated always as (extract(week from fecha)::smallint) stored;
