-- Unir partes del mismo día y la misma obra.
-- Al crear un parte, si ya hay otro NO bloqueado con la misma fecha, cliente y obra, el operario elige en la app si
-- añadirlo a ese parte (p_unir = true) o crear uno nuevo. Si lo añade:
--  - el trabajo realizado se añade al final, con el nombre de quien lo aporta y la hora;
--  - los operarios nuevos se suman a la lista (y así figuran y pueden editarlo);
--  - el material se suma, apuntando quién lo añadió (columna aportado_por);
--  - quien creó el parte recibe un aviso (si tiene activados los avisos generales).
-- Se crea un parte nuevo si el de ese día está bloqueado (bloqueo definitivo) o si los dos traen firma del cliente.
-- Lo hace la función crear_parte(), en el servidor, para que funcione igual con los partes guardados sin conexión
-- (se decide al enviarse) y aunque dos operarios guarden a la vez.

alter table public.partes_materiales add column if not exists aportado_por text;

-- Registro de cada unión: el id es el del parte que se creó en el móvil, para que reenviarlo no lo duplique.
create table if not exists public.partes_uniones (
  id uuid primary key,
  parte_id uuid not null references public.partes_trabajo(id) on delete cascade,
  unido_por text,
  unido_por_id uuid,
  created_at timestamptz not null default now()
);
alter table public.partes_uniones enable row level security;
drop policy if exists "partes_uniones ver aprobados" on public.partes_uniones;
create policy "partes_uniones ver aprobados" on public.partes_uniones
  for select to authenticated using ((select public.es_activo()));
revoke insert, update, delete on public.partes_uniones from anon, authenticated;

drop function if exists public.crear_parte(jsonb, jsonb, jsonb);
create or replace function public.crear_parte(p_parte jsonb, p_operarios jsonb, p_materiales jsonb, p_unir boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := (p_parte->>'id')::uuid;
  v_fecha date := (p_parte->>'fecha')::date;
  v_quien text := nullif(btrim(coalesce(p_parte->>'created_by', '')), '');
  v_existente public.partes_trabajo%rowtype;
  v_destino uuid;
  v_detalle text := nullif(btrim(coalesce(p_parte->>'detalle_trabajo', '')), '');
  v_firma text := nullif(p_parte->>'firma_digital', '');
  v_motivo text;
  o jsonb;
begin
  if auth.uid() is null or not public.es_activo() then
    raise exception 'No tienes permiso para crear partes' using errcode = '42501';
  end if;
  if v_id is null or v_fecha is null then
    raise exception 'Faltan datos del parte' using errcode = '22023';
  end if;

  -- Ya enviado antes (la respuesta se perdió): se devuelve lo mismo sin repetir nada.
  if exists (select 1 from public.partes_trabajo where id = v_id) then
    return jsonb_build_object('parte_id', v_id, 'unido', false);
  end if;
  select parte_id into v_destino from public.partes_uniones where id = v_id;
  if v_destino is not null then
    return jsonb_build_object('parte_id', v_destino, 'unido', true,
      'autor', (select created_by from public.partes_trabajo where id = v_destino));
  end if;

  -- Un solo guardado a la vez por día y obra, para que dos operarios a la vez no creen dos partes.
  perform pg_advisory_xact_lock(hashtext('parte|' || v_fecha::text || '|' || public.norm_txt(p_parte->>'cliente') || '|' || public.norm_txt(p_parte->>'obra')));

  if coalesce(p_unir, true) then
    select * into v_existente from public.partes_trabajo t
    where t.fecha = v_fecha
      and public.norm_txt(t.obra) = public.norm_txt(p_parte->>'obra')
      and public.norm_txt(t.cliente) = public.norm_txt(p_parte->>'cliente')
      and coalesce(t.bloqueado, false) = false
    order by t.created_at asc
    limit 1
    for update;
  end if;

  -- Los dos traen firma del cliente: no se pueden juntar en un parte, se crea uno nuevo.
  if v_existente.id is not null and v_existente.firma_digital is not null and v_firma is not null then
    v_motivo := 'firma';
    v_existente := null;
  end if;

  if v_existente.id is null then
    -- Parte nuevo (no había ninguno, se eligió crear uno nuevo, el del día está bloqueado o los dos traen firma)
    insert into public.partes_trabajo (id, cliente, obra, direccion, localidad, fecha, detalle_trabajo, firma_digital,
                                       bloqueado, created_by, created_by_id, updated_by)
    values (v_id, p_parte->>'cliente', p_parte->>'obra', p_parte->>'direccion', p_parte->>'localidad', v_fecha, v_detalle,
            v_firma, false, v_quien, auth.uid(), v_quien);
    insert into public.partes_operarios (parte_id, operario_nombre, operario_id, horas)
    select v_id, r.operario_nombre, r.operario_id, r.horas
    from jsonb_populate_recordset(null::public.partes_operarios, coalesce(p_operarios, '[]'::jsonb)) r;
    insert into public.partes_materiales (parte_id, unidades, material, referencia, aportado_por)
    select v_id, r.unidades, r.material, r.referencia, coalesce(r.aportado_por, v_quien)
    from jsonb_populate_recordset(null::public.partes_materiales, coalesce(p_materiales, '[]'::jsonb)) r;
    return jsonb_build_object('parte_id', v_id, 'unido', false, 'motivo', v_motivo);
  end if;

  -- Se añade al parte que ya existe
  update public.partes_trabajo set
    detalle_trabajo = case
      when v_detalle is null then detalle_trabajo
      when nullif(btrim(coalesce(detalle_trabajo, '')), '') is null and public.norm_txt(created_by) = public.norm_txt(v_quien) then v_detalle
      else concat_ws(E'\n\n', nullif(btrim(coalesce(detalle_trabajo, '')), ''),
             '— Añadido por ' || coalesce(v_quien, 'otro operario') || ' (' || to_char(now() at time zone 'Europe/Madrid', 'HH24:MI') || ') —' || E'\n' || v_detalle)
    end,
    firma_digital = coalesce(firma_digital, v_firma),
    updated_by = v_quien,
    updated_at = now()
  where id = v_existente.id;

  -- Operarios: solo los que aún no figuran; si ya figuraba sin horas, se le ponen las nuevas.
  for o in select * from jsonb_array_elements(coalesce(p_operarios, '[]'::jsonb)) loop
    if exists (select 1 from public.partes_operarios x where x.parte_id = v_existente.id
               and ((o->>'operario_id') is not null and x.operario_id = (o->>'operario_id')::uuid
                    or public.norm_txt(x.operario_nombre) = public.norm_txt(o->>'operario_nombre'))) then
      update public.partes_operarios x set horas = (jsonb_populate_record(null::public.partes_operarios, o)).horas
      where x.parte_id = v_existente.id
        and nullif(btrim(coalesce(x.horas::text, '')), '') is null
        and nullif(btrim(coalesce(o->>'horas', '')), '') is not null
        and ((o->>'operario_id') is not null and x.operario_id = (o->>'operario_id')::uuid
             or public.norm_txt(x.operario_nombre) = public.norm_txt(o->>'operario_nombre'));
    else
      insert into public.partes_operarios (parte_id, operario_nombre, operario_id, horas)
      select v_existente.id, r.operario_nombre, r.operario_id, r.horas
      from jsonb_populate_record(null::public.partes_operarios, o) r;
    end if;
  end loop;

  -- El material de antes de la unión queda a nombre de quien creó el parte.
  update public.partes_materiales set aportado_por = v_existente.created_by
  where parte_id = v_existente.id and aportado_por is null;
  insert into public.partes_materiales (parte_id, unidades, material, referencia, aportado_por)
  select v_existente.id, r.unidades, r.material, r.referencia, v_quien
  from jsonb_populate_recordset(null::public.partes_materiales, coalesce(p_materiales, '[]'::jsonb)) r;

  insert into public.partes_uniones (id, parte_id, unido_por, unido_por_id) values (v_id, v_existente.id, v_quien, auth.uid());

  -- Aviso (y push) a quien creó el parte, salvo que sea uno mismo o tenga apagados los avisos generales.
  insert into public.notificaciones (user_id, titulo, mensaje)
  select p.id, 'Se han añadido datos a tu parte',
         coalesce(v_quien, 'Otro operario') || ' ha añadido su trabajo a tu parte del ' || to_char(v_fecha, 'DD/MM') || ' en '
         || coalesce(nullif(v_existente.cliente, ''), 'sin cliente') || ' · ' || coalesce(nullif(v_existente.obra, ''), 'sin obra') || '.'
  from public.perfiles p
  where p.id = v_existente.created_by_id and p.id <> auth.uid() and p.activo is true
    and coalesce(p.preferencias_notificaciones ->> 'generales', 'true') <> 'false';

  return jsonb_build_object('parte_id', v_existente.id, 'unido', true, 'autor', v_existente.created_by);
end $$;

revoke all on function public.crear_parte(jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.crear_parte(jsonb, jsonb, jsonb, boolean) to authenticated;
