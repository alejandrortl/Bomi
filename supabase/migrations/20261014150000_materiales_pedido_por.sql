-- Registra quién marcó una solicitud de material como "Pedido" y cuándo.
-- La app funciona sin esto (usa "modificado por"), pero con estas columnas guarda el dato exacto.
alter table public.materiales_solicitudes
  add column if not exists pedido_por text,
  add column if not exists pedido_at timestamptz;
