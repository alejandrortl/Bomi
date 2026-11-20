-- Partes: unir cada línea de operario con su empleado (perfil) aunque el nombre no esté escrito igual.
-- Las horas de un operario se suman por su empleado. Si en el parte se escribió el nombre a mano y no coincide
-- con el perfil («JoseValdes», «Unai» en vez de «Unai Gómez»...), la línea se quedaba sin empleado y sus horas
-- no le salían. Esto rellena operario_id en esas líneas cuando el empleado se encuentra sin dudas:
--   1) el nombre es el mismo sin mayúsculas, acentos, espacios ni signos, y solo hay un empleado así; o
--   2) se escribió solo el nombre de pila y solo hay un empleado que empieza por ese nombre.
-- No cambia horas ni nombres. También se aplica a partes bloqueados (solo se enlaza el empleado, no se toca el parte).
-- Se puede ejecutar más de una vez sin problema.

-- PASO 1 (opcional, solo mirar): líneas de operario que no están unidas a ningún empleado.
select t.fecha, t.cliente, t.obra, o.operario_nombre, o.horas, t.bloqueado
from public.partes_operarios o
join public.partes_trabajo t on t.id = o.parte_id
where o.operario_id is null
order by t.fecha desc;

-- PASO 2: unirlas con su empleado.
with emp as (
  select p.id,
         regexp_replace(translate(lower(btrim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, ''))),
           'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '[^a-z0-9]', '', 'g') as pegado,
         regexp_replace(translate(lower(btrim(coalesce(p.nombre, '') || ' ' || coalesce(p.apellido, ''))),
           'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '\s+', ' ', 'g') as completo
  from public.perfiles p
  where coalesce(p.activo, false) and btrim(coalesce(p.nombre, '') || coalesce(p.apellido, '')) <> ''
),
lineas as (
  select o.id,
         regexp_replace(translate(lower(btrim(o.operario_nombre)), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '[^a-z0-9]', '', 'g') as pegado,
         regexp_replace(translate(lower(btrim(o.operario_nombre)), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '\s+', ' ', 'g') as completo
  from public.partes_operarios o
  where o.operario_id is null and btrim(coalesce(o.operario_nombre, '')) <> ''
),
candidatos as (
  select l.id as linea, e.id as empleado, 1 as prioridad from lineas l join emp e on e.pegado = l.pegado and l.pegado <> ''
  union all
  select l.id, e.id, 2 from lineas l join emp e on e.completo like l.completo || ' %'
),
elegidos as (
  select linea, min(empleado::text)::uuid as empleado
  from candidatos c
  where prioridad = (select min(prioridad) from candidatos c2 where c2.linea = c.linea)
  group by linea
  having count(distinct empleado) = 1
)
update public.partes_operarios o set operario_id = e.empleado
from elegidos e
where o.id = e.linea;

-- PASO 3 (opcional): las que siguen sin empleado (alguien de fuera o un nombre que no se ha podido adivinar).
select t.fecha, t.cliente, t.obra, o.operario_nombre, o.horas
from public.partes_operarios o
join public.partes_trabajo t on t.id = o.parte_id
where o.operario_id is null
order by t.fecha desc;
