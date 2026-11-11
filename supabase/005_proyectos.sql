-- =====================================================================
-- Orvia · 005 Proyectos con hitos (Acción, bloque 3)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 004.
--
-- Usa las tablas proyectos y tareas del núcleo y añade:
--   hitos               las etapas de un proyecto (2–5 normalmente), con fecha opcional
--   tareas.hito_id      la tarea pertenece a un hito (y su proyecto_id, al proyecto)
--   proyectos.orden     orden en pantalla
-- =====================================================================

create table if not exists public.hitos (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id   uuid not null references public.proyectos(id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 1 and 200),
  fecha         date,                   -- fecha objetivo, si la tiene
  orden         integer not null default 0,
  completado_en timestamptz,            -- null = en marcha
  creado        timestamptz not null default now(),
  modificado    timestamptz not null default now(),
  archivado     boolean not null default false
);

create index if not exists hitos_propietario_idx on public.hitos (propietario);
create index if not exists hitos_proyecto_idx on public.hitos (proyecto_id);

alter table public.tareas
  add column if not exists hito_id uuid references public.hitos(id) on delete set null;
create index if not exists tareas_proyecto_idx on public.tareas (proyecto_id);
create index if not exists tareas_hito_idx on public.tareas (hito_id);

alter table public.proyectos
  add column if not exists orden integer not null default 0;

-- Seguridad y fecha de modificación, igual que el resto de tablas.
create trigger hitos_modificado before update on public.hitos
  for each row execute function public.tocar_modificado();
alter table public.hitos enable row level security;
create policy hitos_solo_propietario on public.hitos
  for all to authenticated
  using (propietario = auth.uid())
  with check (
    propietario = auth.uid()
    and exists (select 1 from public.proyectos p where p.id = proyecto_id and p.propietario = auth.uid())
  );
revoke all on public.hitos from anon;
grant select, insert, update, delete on public.hitos to authenticated;
