-- =====================================================================
-- Orvia · 006 Calendarios (Acción, bloque 4)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 005.
--
-- Guarda los enlaces de «Calendario público» de iCloud que Orvia lee (solo lectura).
-- El enlace es privado tuyo: solo tu sesión puede verlo (RLS). La función «calendario»
-- (supabase/functions/calendario) lo usa para traer los eventos.
-- =====================================================================

create table if not exists public.calendarios (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  url         text not null check (url ~* '^(webcal|https)://' and char_length(url) <= 600),
  color       text not null default '#7aa2f7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  activo      boolean not null default true,
  orden       integer not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);

create index if not exists calendarios_propietario_idx on public.calendarios (propietario);

create trigger calendarios_modificado before update on public.calendarios
  for each row execute function public.tocar_modificado();
alter table public.calendarios enable row level security;
create policy calendarios_solo_propietario on public.calendarios
  for all to authenticated
  using (propietario = auth.uid())
  with check (propietario = auth.uid());
revoke all on public.calendarios from anon;
grant select, insert, update, delete on public.calendarios to authenticated;
