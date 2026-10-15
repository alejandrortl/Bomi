-- Tallas de ropa de trabajo de cada empleado (las rellena cada usuario en "Mi perfil").
alter table public.perfiles
  add column if not exists talla_camiseta text,
  add column if not exists talla_pantalon text,
  add column if not exists talla_zapatos text,
  add column if not exists talla_chaqueta text,
  add column if not exists talla_chaleco text;
