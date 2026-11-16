-- =====================================================================
-- Orvia · 009 Listas (Acción)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 008.
--
-- Listas de casillas con lo mínimo: un nombre y sus elementos (solo texto).
--   listas            «Comprar después de Navidad», «Regalos»…
--   listas_elementos  cada cosa de la lista; al marcarla queda tachada (hecho_en)
-- Igual que el resto de Orvia: nada se borra desde la app, se archiva.
-- =====================================================================

create table if not exists public.listas (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  orden       integer not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);
create index if not exists listas_propietario_idx on public.listas (propietario);

create trigger listas_modificado before update on public.listas
  for each row execute function public.tocar_modificado();
alter table public.listas enable row level security;
create policy listas_solo_propietario on public.listas
  for all to authenticated
  using (propietario = auth.uid())
  with check (propietario = auth.uid());
revoke all on public.listas from anon;
grant select, insert, update, delete on public.listas to authenticated;

create table if not exists public.listas_elementos (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lista_id    uuid not null references public.listas(id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 300),
  hecho       boolean not null default false,
  hecho_en    timestamptz,
  orden       integer not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);
create index if not exists listas_elementos_propietario_idx on public.listas_elementos (propietario);
create index if not exists listas_elementos_lista_idx on public.listas_elementos (lista_id);

create trigger listas_elementos_modificado before update on public.listas_elementos
  for each row execute function public.tocar_modificado();
alter table public.listas_elementos enable row level security;
create policy listas_elementos_solo_propietario on public.listas_elementos
  for all to authenticated
  using (propietario = auth.uid())
  with check (propietario = auth.uid());
revoke all on public.listas_elementos from anon;
grant select, insert, update, delete on public.listas_elementos to authenticated;
