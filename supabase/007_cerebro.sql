-- =====================================================================
-- Orvia · 007 Segundo cerebro (bloque 1: biblioteca y notas)
-- Ejecutar UNA vez en Supabase → SQL Editor, después de 006.
--
-- Usa la tabla notas del núcleo y la adapta:
--   tipo        idea · aprendizaje · sobre_mi
--   estado      solo ideas: bruto → madurando → lanzada (o descartada)
--   seccion     solo «Sobre ti»: perfil · valores · metas · reflexiones
--   grupo_id    solo aprendizajes: el curso, libro o tema al que pertenece
--   fijada      aparece arriba en la biblioteca
--   proyecto_id proyecto de Acción enlazado (una idea lanzada, por ejemplo)
-- y añade notas_grupos: los grupos de aprendizajes (un curso, un libro, un tema),
-- que pueden enlazarse a un proyecto de formación de Acción.
-- =====================================================================

create table if not exists public.notas_grupos (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 120),
  tipo        text not null default 'tema' check (tipo in ('curso', 'libro', 'tema', 'otro')),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  orden       integer not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);
create index if not exists notas_grupos_propietario_idx on public.notas_grupos (propietario);

create trigger notas_grupos_modificado before update on public.notas_grupos
  for each row execute function public.tocar_modificado();
alter table public.notas_grupos enable row level security;
create policy notas_grupos_solo_propietario on public.notas_grupos
  for all to authenticated
  using (propietario = auth.uid())
  with check (propietario = auth.uid());
revoke all on public.notas_grupos from anon;
grant select, insert, update, delete on public.notas_grupos to authenticated;

-- Tipos nuevos (los antiguos «referencia» y «diario» pasan a su equivalente).
alter table public.notas drop constraint if exists notas_tipo_check;
update public.notas set tipo = 'aprendizaje' where tipo = 'referencia';
update public.notas set tipo = 'sobre_mi' where tipo = 'diario';
alter table public.notas
  add constraint notas_tipo_check check (tipo in ('idea', 'aprendizaje', 'sobre_mi'));

alter table public.notas
  add column if not exists estado text check (estado in ('bruto', 'madurando', 'lanzada', 'descartada')),
  add column if not exists seccion text check (seccion in ('perfil', 'valores', 'metas', 'reflexiones')),
  add column if not exists grupo_id uuid references public.notas_grupos(id) on delete set null,
  add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null,
  add column if not exists fijada boolean not null default false;
alter table public.notas add constraint notas_contenido_largo check (char_length(contenido) <= 50000);
create index if not exists notas_grupo_idx on public.notas (grupo_id);
