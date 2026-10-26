-- Copia en la nube (Google Drive o disco de la oficina por WebDAV) del PDF de cada parte BLOQUEADO.
-- La rellena SOLO la Edge Function `guardar-parte-nube` (con la clave de servicio). La app solo la lee,
-- para mostrar "Guardado en la nube" o el botón de reintentar. Va en una tabla aparte porque un parte
-- bloqueado ya no admite ningún cambio (trigger proteger_bloqueo_parte).

create table if not exists public.partes_pdf_nube (
  parte_id uuid primary key references public.partes_trabajo(id) on delete cascade,
  destino text not null,                 -- 'drive' | 'webdav'
  archivo_id text,                       -- id del archivo en Drive o ruta en el disco
  enlace text,                           -- enlace para abrirlo (Drive)
  nombre text not null,
  guardado_por text,
  guardado_at timestamptz not null default now()
);

alter table public.partes_pdf_nube enable row level security;

drop policy if exists "partes_pdf_nube ver aprobados" on public.partes_pdf_nube;
create policy "partes_pdf_nube ver aprobados" on public.partes_pdf_nube
  for select to authenticated using ((select public.es_activo()));

-- Nadie escribe desde la app: no hay políticas de insert/update/delete (la Edge Function usa la clave de servicio).
revoke insert, update, delete on public.partes_pdf_nube from anon, authenticated;
