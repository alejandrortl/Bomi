-- Permite que la app (aunque nadie haya iniciado sesión) lea SOLO el nombre y el logotipo de la empresa,
-- para que el icono y el nombre al instalar la app / crear un acceso directo sean los de la empresa.
create or replace function public.empresa_publica()
returns table (nombre text, logo_url text)
language sql stable security definer set search_path = public as $$
  select nombre_fiscal, logo_url from public.configuracion_empresa order by id limit 1
$$;
revoke all on function public.empresa_publica() from public;
grant execute on function public.empresa_publica() to anon, authenticated;
