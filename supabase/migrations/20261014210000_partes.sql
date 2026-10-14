-- Partes de trabajo: columnas de autoría/bloqueo, preferencia de pantalla y seguridad (RLS).
-- Reglas: cualquiera ve los partes y crea los suyos; Admin/SuperAdmin, quien lo creó y los operarios que figuran
-- en el parte pueden editarlo o eliminarlo mientras no esté bloqueado; solo Admin/SuperAdmin pueden bloquearlo
-- y el bloqueo es DEFINITIVO (ni se edita, ni se elimina, ni se desbloquea).

alter table public.partes_trabajo
  add column if not exists created_by_id uuid,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists bloqueado_por text,
  add column if not exists bloqueado_at timestamptz;
alter table public.partes_operarios add column if not exists operario_id uuid;
alter table public.perfiles add column if not exists ui_preferencias jsonb not null default '{}'::jsonb;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('Admin', 'SuperAdmin'))
$$;

create or replace function public.puede_editar_parte(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partes_trabajo t
    where t.id = p and coalesce(t.bloqueado, false) = false
      and (public.es_admin()
           or t.created_by_id = auth.uid()
           or exists (select 1 from public.partes_operarios o
                      where o.parte_id = t.id
                        and (o.operario_id = auth.uid()
                             or lower(btrim(o.operario_nombre)) = (select lower(btrim(coalesce(nombre, '') || ' ' || coalesce(apellido, ''))) from public.perfiles where id = auth.uid()))))
  )
$$;

create or replace function public.proteger_bloqueo_parte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Desde el panel de Supabase / SQL Editor (sin usuario de la app) se puede corregir cualquier parte.
  if auth.uid() is null then
    return new;
  end if;
  if coalesce(old.bloqueado, false) then
    raise exception 'Un parte bloqueado ya no se puede modificar ni desbloquear' using errcode = '42501';
  end if;
  if coalesce(new.bloqueado, false) and not public.es_admin() then
    raise exception 'Solo un administrador puede bloquear un parte' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_bloqueo_parte on public.partes_trabajo;
create trigger trg_proteger_bloqueo_parte before update on public.partes_trabajo
  for each row execute function public.proteger_bloqueo_parte();

drop policy if exists "Acceso total partes_trabajo" on public.partes_trabajo;
drop policy if exists "Acceso total partes_operarios" on public.partes_operarios;
drop policy if exists "Acceso total partes_materiales" on public.partes_materiales;

drop policy if exists "partes ver" on public.partes_trabajo;
drop policy if exists "partes crear" on public.partes_trabajo;
drop policy if exists "partes editar" on public.partes_trabajo;
drop policy if exists "partes eliminar" on public.partes_trabajo;
drop policy if exists "partes_operarios ver" on public.partes_operarios;
drop policy if exists "partes_operarios escribir" on public.partes_operarios;
drop policy if exists "partes_materiales ver" on public.partes_materiales;
drop policy if exists "partes_materiales escribir" on public.partes_materiales;

create policy "partes ver" on public.partes_trabajo for select to authenticated using (true);
create policy "partes crear" on public.partes_trabajo for insert to authenticated with check (created_by_id = auth.uid());
create policy "partes editar" on public.partes_trabajo for update to authenticated
  using (public.puede_editar_parte(id)) with check (true);
create policy "partes eliminar" on public.partes_trabajo for delete to authenticated using (public.puede_editar_parte(id));

create policy "partes_operarios ver" on public.partes_operarios for select to authenticated using (true);
create policy "partes_operarios escribir" on public.partes_operarios for all to authenticated
  using (public.puede_editar_parte(parte_id)) with check (public.puede_editar_parte(parte_id));
create policy "partes_materiales ver" on public.partes_materiales for select to authenticated using (true);
create policy "partes_materiales escribir" on public.partes_materiales for all to authenticated
  using (public.puede_editar_parte(parte_id)) with check (public.puede_editar_parte(parte_id));
