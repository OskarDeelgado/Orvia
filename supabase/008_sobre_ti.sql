-- =====================================================================
-- Orvia · 008 Sobre ti (Segundo cerebro, bloque 4)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 007.
--
-- Añade a las notas el plazo de una meta a largo plazo, en años (1, 3, 5, 10…).
-- =====================================================================

alter table public.notas
  add column if not exists horizonte smallint check (horizonte between 1 and 50);
