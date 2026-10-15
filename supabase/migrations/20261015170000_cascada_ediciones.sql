-- Si se edita un cliente, obra (nombre, dirección, localidad) o empleado (nombre, apellido),
-- todos los registros que tenían ese dato pasan al dato nuevo. Solo se salvan los partes BLOQUEADOS.
-- (Los registros guardan el texto, no el id, por eso se localizan por el valor anterior.)

create or replace function public.norm_txt(t text) returns text language sql immutable as $$ select lower(btrim(coalesce(t, ''))) $$;

create or replace function public.nombre_completo(n text, a text, e text) returns text language sql immutable as $$
  select coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(n), ''), nullif(btrim(a), ''))), ''), e, 'Usuario')
$$;

-- Las protecciones de "tareas" dejan pasar estos cambios automáticos.
create or replace function public.proteger_tarea() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if current_setting('bomi.cascada', true) = '1' then return new; end if;
  if public.es_admin() or old.user_id = auth.uid() then return new; end if;
  if (to_jsonb(new) - 'completada') is distinct from (to_jsonb(old) - 'completada') then
    raise exception 'Solo un administrador o quien creó la tarea puede modificarla' using errcode = '42501';
  end if;
  return new;
end $$;

-- CLIENTE: cambia el nombre
create or replace function public.cascada_cliente() returns trigger language plpgsql security definer set search_path = public as $$
declare v_old text := coalesce(nullif(btrim(old.nombre_cliente), ''), btrim(old.nombre));
        v_new text := coalesce(nullif(btrim(new.nombre_cliente), ''), btrim(new.nombre));
begin
  if v_old is null or v_new is null or v_old = v_new then return new; end if;
  perform set_config('bomi.cascada', '1', true);
  update public.bitacora set cliente = v_new where cliente_id = new.id or public.norm_txt(cliente) = public.norm_txt(v_old);
  update public.tareas set cliente = v_new where public.norm_txt(cliente) = public.norm_txt(v_old);
  update public.materiales_solicitudes set cliente = v_new where public.norm_txt(cliente) = public.norm_txt(v_old);
  update public.partes_trabajo set cliente = v_new where coalesce(bloqueado, false) = false and public.norm_txt(cliente) = public.norm_txt(v_old);
  return new;
end $$;
create trigger trg_cascada_cliente after update on public.clientes for each row execute function public.cascada_cliente();

-- OBRA: cambia el nombre, la dirección o la localidad
create or replace function public.cascada_obra() returns trigger language plpgsql security definer set search_path = public as $$
declare v_cli text;
begin
  if new.nombre is not distinct from old.nombre and new.direccion is not distinct from old.direccion and new.localidad is not distinct from old.localidad then return new; end if;
  select coalesce(nullif(btrim(nombre_cliente), ''), btrim(nombre)) into v_cli from public.clientes where id = new.cliente_id;
  if v_cli is null then return new; end if;
  perform set_config('bomi.cascada', '1', true);
  update public.bitacora set obra = new.nombre,
      direccion = case when public.norm_txt(direccion) = public.norm_txt(old.direccion) then new.direccion else direccion end,
      localidad = case when public.norm_txt(localidad) = public.norm_txt(old.localidad) then new.localidad else localidad end
    where obra_id = new.id or (public.norm_txt(cliente) = public.norm_txt(v_cli) and public.norm_txt(obra) = public.norm_txt(old.nombre));
  update public.tareas set obra = new.nombre,
      direccion = case when public.norm_txt(direccion) = public.norm_txt(old.direccion) then new.direccion else direccion end,
      localidad = case when public.norm_txt(localidad) = public.norm_txt(old.localidad) then new.localidad else localidad end
    where public.norm_txt(cliente) = public.norm_txt(v_cli) and public.norm_txt(obra) = public.norm_txt(old.nombre);
  update public.materiales_solicitudes set obra = new.nombre,
      direccion = case when public.norm_txt(direccion) = public.norm_txt(old.direccion) then new.direccion else direccion end,
      localidad = case when public.norm_txt(localidad) = public.norm_txt(old.localidad) then new.localidad else localidad end
    where public.norm_txt(cliente) = public.norm_txt(v_cli) and public.norm_txt(obra) = public.norm_txt(old.nombre);
  update public.partes_trabajo set obra = new.nombre,
      direccion = case when public.norm_txt(direccion) = public.norm_txt(old.direccion) then new.direccion else direccion end,
      localidad = case when public.norm_txt(localidad) = public.norm_txt(old.localidad) then new.localidad else localidad end
    where coalesce(bloqueado, false) = false and public.norm_txt(cliente) = public.norm_txt(v_cli) and public.norm_txt(obra) = public.norm_txt(old.nombre);
  return new;
end $$;
create trigger trg_cascada_obra after update on public.obras for each row execute function public.cascada_obra();

-- EMPLEADO: cambia el nombre o el apellido
create or replace function public.cascada_perfil() returns trigger language plpgsql security definer set search_path = public as $$
declare v_old text := public.nombre_completo(old.nombre, old.apellido, old.email);
        v_new text := public.nombre_completo(new.nombre, new.apellido, new.email);
        n_old text := public.norm_txt(public.nombre_completo(old.nombre, old.apellido, old.email));
begin
  if v_old = v_new then return new; end if;
  perform set_config('bomi.cascada', '1', true);
  update public.tareas set
      operario_asignado = case when operario_username = new.username or public.norm_txt(operario_asignado) = n_old then v_new else operario_asignado end,
      created_by = case when user_id = new.id or public.norm_txt(created_by) = n_old then v_new else created_by end,
      updated_by = case when public.norm_txt(updated_by) = n_old then v_new else updated_by end
    where operario_username = new.username or user_id = new.id or public.norm_txt(operario_asignado) = n_old or public.norm_txt(created_by) = n_old or public.norm_txt(updated_by) = n_old;
  update public.bitacora set
      created_by = case when public.norm_txt(created_by) = n_old then v_new else created_by end,
      updated_by = case when public.norm_txt(updated_by) = n_old then v_new else updated_by end
    where public.norm_txt(created_by) = n_old or public.norm_txt(updated_by) = n_old;
  update public.materiales_solicitudes set
      created_by = case when public.norm_txt(created_by) = n_old then v_new else created_by end,
      updated_by = case when public.norm_txt(updated_by) = n_old then v_new else updated_by end,
      pedido_por = case when public.norm_txt(pedido_por) = n_old then v_new else pedido_por end,
      recibido_por = case when public.norm_txt(recibido_por) = n_old then v_new else recibido_por end
    where public.norm_txt(created_by) = n_old or public.norm_txt(updated_by) = n_old or public.norm_txt(pedido_por) = n_old or public.norm_txt(recibido_por) = n_old;
  update public.partes_trabajo set
      created_by = case when created_by_id = new.id or public.norm_txt(created_by) = n_old then v_new else created_by end,
      updated_by = case when public.norm_txt(updated_by) = n_old then v_new else updated_by end
    where coalesce(bloqueado, false) = false and (created_by_id = new.id or public.norm_txt(created_by) = n_old or public.norm_txt(updated_by) = n_old);
  update public.partes_operarios o set operario_nombre = v_new
    where (o.operario_id = new.id or public.norm_txt(o.operario_nombre) = n_old)
      and exists (select 1 from public.partes_trabajo p where p.id = o.parte_id and coalesce(p.bloqueado, false) = false);
  update public.mensajes set remitente_nombre = v_new where remitente_id = new.id;
  return new;
end $$;
create trigger trg_cascada_perfil after update on public.perfiles for each row execute function public.cascada_perfil();
