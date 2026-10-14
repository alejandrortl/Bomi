-- Avisos push al móvil + mensajería. Ejecutar completo en Supabase → SQL Editor.

-- 1) Mensajería ---------------------------------------------------------------
create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  remitente_id uuid not null,
  remitente_nombre text not null,
  destinatarios uuid[] not null,
  para_todos boolean not null default false,
  texto text not null check (length(btrim(texto)) > 0),
  created_at timestamptz not null default now()
);
alter table public.mensajes enable row level security;
drop policy if exists "Ver mensajes propios" on public.mensajes;
drop policy if exists "Enviar mensajes" on public.mensajes;
drop policy if exists "Borrar mensajes enviados" on public.mensajes;
create policy "Ver mensajes propios" on public.mensajes for select to authenticated
  using (auth.uid() = remitente_id or auth.uid() = any(destinatarios));
create policy "Enviar mensajes" on public.mensajes for insert to authenticated
  with check (auth.uid() = remitente_id);
create policy "Borrar mensajes enviados" on public.mensajes for delete to authenticated
  using (auth.uid() = remitente_id);
create index if not exists mensajes_created_idx on public.mensajes (created_at desc);

-- 2) Dispositivos suscritos a avisos push ------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Gestionar mis dispositivos" on public.push_subscriptions;
create policy "Gestionar mis dispositivos" on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Cada notificación nueva dispara el envío push (Edge Function `enviar-push`) -----------
alter table public.notificaciones add column if not exists push_enviado_at timestamptz;
create extension if not exists pg_net with schema extensions;

create or replace function public.enviar_push_notificacion()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://dejoetyaiwqloqeinfze.supabase.co/functions/v1/enviar-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('id', new.id)
  );
  return new;
exception when others then
  return new;   -- un fallo del push nunca debe impedir crear la notificación
end $$;

drop trigger if exists trg_enviar_push on public.notificaciones;
create trigger trg_enviar_push after insert on public.notificaciones
  for each row execute function public.enviar_push_notificacion();
