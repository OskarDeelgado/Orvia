-- =====================================================================
-- Orvia · Migración 001 · Núcleo común
-- Tablas: areas, objetivos, proyectos, tareas, habitos, habitos_registros,
--         notas, enlaces
-- Las tablas de Finanzas llegan en la migración 002 (fase 1a).
--
-- Cómo aplicarla: Supabase → SQL Editor → New query → pegar todo → Run.
-- Es segura de ejecutar una sola vez sobre un proyecto vacío.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Función común: actualiza la columna "modificado" en cada cambio
-- ---------------------------------------------------------------------
create or replace function public.tocar_modificado()
returns trigger
language plpgsql
as $$
begin
  new.modificado := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Áreas de vida
-- ---------------------------------------------------------------------
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  color       text not null default 'azul',
  orden       smallint not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (propietario, nombre)
);

-- ---------------------------------------------------------------------
-- Objetivos
-- ---------------------------------------------------------------------
create table public.objetivos (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 1 and 200),
  descripcion  text,
  area_id      uuid references public.areas(id) on delete set null,
  horizonte    text not null default 'trimestre'
               check (horizonte in ('mes', 'trimestre', 'anio', 'largo_plazo')),
  fecha_limite date,
  metrica      text not null default 'si_no'
               check (metrica in ('si_no', 'numero', 'dinero')),
  valor_meta   numeric(14, 2),
  valor_actual numeric(14, 2),          -- solo para métrica "numero" registrada a mano
  unidad       text,                    -- ej. "km", "libros"
  estado       text not null default 'activo'
               check (estado in ('activo', 'pausado', 'conseguido', 'abandonado')),
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Proyectos (viajes, formaciones, laborales… son tipos de proyecto)
-- ---------------------------------------------------------------------
create table public.proyectos (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 1 and 200),
  descripcion  text,
  tipo         text not null default 'general'
               check (tipo in ('general', 'viaje', 'formacion', 'laboral', 'emprendimiento')),
  area_id      uuid references public.areas(id) on delete set null,
  objetivo_id  uuid references public.objetivos(id) on delete set null,
  fecha_inicio date,
  fecha_fin    date,
  estado       text not null default 'activo'
               check (estado in ('idea', 'activo', 'pausado', 'terminado', 'cancelado')),
  presupuesto  numeric(14, 2),
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false,
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

-- ---------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------
create table public.tareas (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 1 and 300),
  notas         text,
  proyecto_id   uuid references public.proyectos(id) on delete set null,
  objetivo_id   uuid references public.objetivos(id) on delete set null,
  area_id       uuid references public.areas(id) on delete set null,
  fecha         date,                   -- día concreto, si lo tiene
  semana        date,                   -- lunes de la semana en la que se planifica
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'en_curso', 'hecha', 'cancelada')),
  prioridad     smallint not null default 2 check (prioridad between 1 and 3),
  recurrencia   jsonb,                  -- regla de repetición; se define en la fase 1b
  completada_en timestamptz,
  creado        timestamptz not null default now(),
  modificado    timestamptz not null default now(),
  archivado     boolean not null default false
);

-- ---------------------------------------------------------------------
-- Hábitos y sus registros diarios
-- ---------------------------------------------------------------------
create table public.habitos (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 200),
  objetivo_id uuid references public.objetivos(id) on delete set null,
  area_id     uuid references public.areas(id) on delete set null,
  frecuencia  jsonb not null default '{"tipo": "diaria"}'::jsonb,
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);

create table public.habitos_registros (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habito_id   uuid not null references public.habitos(id) on delete cascade,
  fecha       date not null,
  hecho       boolean not null default true,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (habito_id, fecha)
);

-- ---------------------------------------------------------------------
-- Notas (Second Brain)
-- ---------------------------------------------------------------------
create table public.notas (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 200),
  contenido   text not null default '',
  tipo        text not null default 'idea'
              check (tipo in ('idea', 'aprendizaje', 'referencia', 'diario')),
  area_id     uuid references public.areas(id) on delete set null,
  etiquetas   text[] not null default '{}',
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);

-- ---------------------------------------------------------------------
-- Enlaces: relaciones libres entre dos elementos cualesquiera
-- ---------------------------------------------------------------------
create table public.enlaces (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  origen_tipo  text not null,
  origen_id    uuid not null,
  destino_tipo text not null,
  destino_id   uuid not null,
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false,
  check (not (origen_tipo = destino_tipo and origen_id = destino_id)),
  unique (propietario, origen_tipo, origen_id, destino_tipo, destino_id)
);

-- ---------------------------------------------------------------------
-- Índices para las consultas habituales
-- ---------------------------------------------------------------------
create index areas_propietario_idx       on public.areas (propietario);
create index objetivos_propietario_idx   on public.objetivos (propietario, estado);
create index proyectos_propietario_idx   on public.proyectos (propietario, estado);
create index proyectos_objetivo_idx      on public.proyectos (objetivo_id);
create index tareas_propietario_idx      on public.tareas (propietario, estado);
create index tareas_semana_idx           on public.tareas (propietario, semana);
create index tareas_proyecto_idx         on public.tareas (proyecto_id);
create index habitos_propietario_idx     on public.habitos (propietario);
create index habitos_registros_fecha_idx on public.habitos_registros (propietario, fecha);
create index notas_propietario_idx       on public.notas (propietario, tipo);
create index enlaces_origen_idx          on public.enlaces (propietario, origen_tipo, origen_id);
create index enlaces_destino_idx         on public.enlaces (propietario, destino_tipo, destino_id);

-- ---------------------------------------------------------------------
-- Disparadores de "modificado", permisos y seguridad por fila
-- Cada usuario solo puede ver y cambiar sus propias filas.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'objetivos', 'proyectos', 'tareas',
    'habitos', 'habitos_registros', 'notas', 'enlaces'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.tocar_modificado()',
      t || '_modificado', t);

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I
         for all to authenticated
         using (propietario = auth.uid())
         with check (propietario = auth.uid())',
      t || '_solo_propietario', t);

    execute format('revoke all on public.%I from anon', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
