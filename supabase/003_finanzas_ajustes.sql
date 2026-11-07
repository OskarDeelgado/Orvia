-- =====================================================================
-- Orvia · 003 Ajustes de Finanzas (bloque 6)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 002_finanzas.sql.
-- Añade:
--   - fin_sobres.sugerencia_ignorada: mes en que pulsaste "Ignorar este mes"
--     en una sugerencia de reajuste de porcentaje (como en Sobrea).
--   - fin_borrar_movimientos(): "Borrar todos los movimientos" de Ajustes.
--     Borra movimientos, inversiones y aportaciones a objetivos, y deja los
--     objetivos sin meses revisados. No toca la configuración ni los recurrentes.
-- =====================================================================

alter table public.fin_sobres
  add column if not exists sugerencia_ignorada date;

create or replace function public.fin_borrar_movimientos()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión';
  end if;
  delete from fin_aportaciones where propietario = auth.uid();
  delete from fin_movimientos  where propietario = auth.uid();
  delete from fin_inversiones  where propietario = auth.uid();
  update objetivos set revisado_hasta = null
   where propietario = auth.uid() and metrica = 'dinero';
end;
$$;

grant execute on function public.fin_borrar_movimientos() to authenticated;
