-- Materiales: dónde se entrega el material de cada solicitud y notas.
-- Al pedir material hay que elegir "Obra" (se entrega en la dirección de la obra) o "Nave" (en el almacén de la empresa),
-- y se pueden añadir notas con información extra (escritas o dictadas).
-- Las solicitudes antiguas se quedan sin indicar (vacío). Mientras no se ejecute esto, la app no muestra el selector ni las notas.
-- Se puede ejecutar más de una vez sin problema.

alter table public.materiales_solicitudes add column if not exists entrega text;
alter table public.materiales_solicitudes add column if not exists notas text;

alter table public.materiales_solicitudes drop constraint if exists materiales_solicitudes_entrega_check;
alter table public.materiales_solicitudes add constraint materiales_solicitudes_entrega_check
  check (entrega is null or entrega in ('obra', 'nave'));

comment on column public.materiales_solicitudes.entrega is 'Dónde se entrega el material: obra o nave.';
comment on column public.materiales_solicitudes.notas is 'Información extra de la solicitud.';

-- Para que la API vea las columnas nuevas al momento.
notify pgrst, 'reload schema';
