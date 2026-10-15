-- Diario: Admin/SuperAdmin y quien creó la tarea pueden editarla y eliminarla.
-- El resto (p. ej. el operario asignado) solo puede marcarla como hecha/pendiente.
create or replace function public.proteger_tarea() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if public.es_admin() or old.user_id = auth.uid() then return new; end if;
  if (to_jsonb(new) - 'completada') is distinct from (to_jsonb(old) - 'completada') then
    raise exception 'Solo un administrador o quien creó la tarea puede modificarla' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_proteger_tarea before update on public.tareas for each row execute function public.proteger_tarea();
create policy "tareas eliminar admin o creador" on public.tareas for delete to authenticated using (public.es_admin() or user_id = auth.uid());
