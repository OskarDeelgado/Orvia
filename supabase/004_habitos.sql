-- =====================================================================
-- Orvia · 004 Hábitos con niveles (Acción, bloque 2)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 003.
--
-- Usa las tablas habitos y habitos_registros del núcleo y añade:
--   habitos.dificultad   1 fácil (10 XP) · 2 media (20 XP) · 3 difícil (30 XP)
--   habitos.orden        orden en pantalla
--   habitos.desde        semana desde la que cuenta (rachas y logros)
--   habitos_registros.valor   cantidad del día (pasos); null en hábitos de marcar
--   habitos_comodines    semanas salvadas con el comodín (1 al mes)
--
-- habitos.frecuencia (jsonb):
--   {"tipo":"semanal","veces":4}                         al menos 4 días por semana
--   {"tipo":"cantidad","meta":49000,"unidad":"pasos"}    una cifra a sumar en la semana
-- =====================================================================

alter table public.habitos
  add column if not exists dificultad smallint not null default 2 check (dificultad between 1 and 3),
  add column if not exists orden      integer  not null default 0,
  add column if not exists desde      date     not null default current_date;

alter table public.habitos_registros
  add column if not exists valor numeric(12, 2) check (valor is null or valor >= 0);

create table if not exists public.habitos_comodines (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habito_id   uuid not null references public.habitos(id) on delete cascade,
  semana      date not null,              -- lunes de la semana salvada
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (habito_id, semana)
);

create index if not exists habitos_comodines_propietario_idx on public.habitos_comodines (propietario);

-- Seguridad y fecha de modificación, igual que el resto de tablas.
create trigger habitos_comodines_modificado before update on public.habitos_comodines
  for each row execute function public.tocar_modificado();
alter table public.habitos_comodines enable row level security;
create policy habitos_comodines_solo_propietario on public.habitos_comodines
  for all to authenticated
  using (propietario = auth.uid())
  with check (propietario = auth.uid());
revoke all on public.habitos_comodines from anon;
grant select, insert, update, delete on public.habitos_comodines to authenticated;
