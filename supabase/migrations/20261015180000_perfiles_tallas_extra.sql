-- Más tallas de ropa de trabajo: sudadera, bermudas y polo.
alter table public.perfiles
  add column if not exists talla_sudadera text,
  add column if not exists talla_bermudas text,
  add column if not exists talla_polo text;
