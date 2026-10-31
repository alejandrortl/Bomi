-- Horas de los partes: solo números (8, 5,5 o 6,5; como mucho 24), para que siempre se puedan sumar por semana.
-- La app ya lo exige al guardar. Esta regla hace lo mismo en el servidor para los partes nuevos o editados.
-- NOT VALID: no revisa los partes que ya existen (los antiguos con texto siguen ahí hasta que se corrijan).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'partes_operarios' and column_name = 'horas'
               and data_type in ('text', 'character varying'))
     and not exists (select 1 from pg_constraint where conname = 'partes_operarios_horas_numero') then
    alter table public.partes_operarios add constraint partes_operarios_horas_numero check (
      horas is null or btrim(horas) = ''
      or (case when btrim(horas) ~ '^\d{1,2}([.,]\d{1,2})?$'
               then replace(btrim(horas), ',', '.')::numeric between 0 and 24
               else false end)
    ) not valid;
  end if;
end $$;
