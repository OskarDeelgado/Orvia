-- =====================================================================
-- Orvia · Migración 002 · Finanzas
-- Diez tablas fin_* con la lógica de Sobrea, más dos funciones:
--   fin_importar(datos)  importa una configuración completa de una vez
--   fin_reiniciar()      borra todos tus datos de Finanzas
-- Requisito: haber ejecutado antes 001_nucleo.sql.
--
-- Cómo aplicarla: Supabase → SQL Editor → New query → pegar todo → Run.
-- Las fechas "mes" son siempre el día 1 de ese mes (2027-01-01 = enero de 2027).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Objetivos: dos campos más, que usan los objetivos de ahorro
-- ---------------------------------------------------------------------
alter table public.objetivos
  add column fecha_inicio date,
  add column revisado_hasta date;  -- último mes en el que se decidió la aportación

-- ---------------------------------------------------------------------
-- Configuración: saldos de partida y reglas generales (una fila por persona)
-- ---------------------------------------------------------------------
create table public.fin_config (
  id                uuid primary key default gen_random_uuid(),
  propietario       uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  fecha_inicio      date not null default '2027-01-01' check (extract(day from fecha_inicio) = 1),
  saldo_inicial     numeric(14, 2) not null default 0,   -- cuenta del día a día
  ahorro_inicial    numeric(14, 2) not null default 0,   -- cuenta de ahorro (incluye el fondo)
  inversion_inicial numeric(14, 2) not null default 0,
  inversion_valor   numeric(14, 2) not null default 0,   -- valor actual de lo invertido
  fondo_inicial     numeric(14, 2) not null default 0,   -- fondo de emergencia de partida
  fondo_tope        numeric(14, 2) not null default 3000 check (fondo_tope >= 0),
  sobrante_inicial  numeric(14, 2) not null default 0,
  creado            timestamptz not null default now(),
  modificado        timestamptz not null default now(),
  archivado         boolean not null default false
);

-- ---------------------------------------------------------------------
-- Sueldo con historial: cada fila vale desde su mes hasta la siguiente
-- ---------------------------------------------------------------------
create table public.fin_sueldos (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  desde_mes   date not null check (extract(day from desde_mes) = 1),
  importe     numeric(12, 2) not null check (importe >= 0),
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (propietario, desde_mes)
);

-- Pagas extra: se cobran cada año en el mes indicado
create table public.fin_pagas_extra (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes_del_anio smallint not null check (mes_del_anio between 1 and 12),
  importe      numeric(12, 2) not null check (importe >= 0),
  concepto     text not null default 'Paga extra',
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Sobres: gasto (Gastos fijos, Compras, Ocio…), fondo (Extraordinarios,
-- uno solo) e ingreso (preparado, oculto por ahora)
-- ---------------------------------------------------------------------
create table public.fin_sobres (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre       text not null check (char_length(nombre) between 1 and 40),
  tipo         text not null default 'gasto' check (tipo in ('gasto', 'fondo', 'ingreso')),
  color        text not null default '#3987e5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  orden        smallint not null default 0,
  desde_mes    date check (desde_mes is null or extract(day from desde_mes) = 1),
  hasta_mes    date check (hasta_mes is null or extract(day from hasta_mes) = 1),  -- deja de contar ese mes
  clave_sobrea text,  -- identificador que tenía en Sobrea, para importar sin duplicar
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false,
  check (hasta_mes is null or desde_mes is null or hasta_mes > desde_mes)
);
create unique index fin_sobres_un_fondo on public.fin_sobres (propietario) where tipo = 'fondo' and not archivado;

-- Porcentaje del sueldo de cada sobre, con historial por mes
create table public.fin_porcentajes (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sobre_id    uuid not null references public.fin_sobres(id) on delete cascade,
  desde_mes   date not null check (extract(day from desde_mes) = 1),
  porcentaje  numeric(7, 5) not null check (porcentaje between 0 and 1),  -- 0,075 = 7,5 %
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (sobre_id, desde_mes)
);

-- Conceptos (categorías) de cada sobre: Cena, Ropa, Luz…
create table public.fin_conceptos (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sobre_id    uuid not null references public.fin_sobres(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 40),
  orden       smallint not null default 0,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false,
  unique (sobre_id, nombre)
);

-- ---------------------------------------------------------------------
-- Recurrentes: gastos que se apuntan solos
-- ---------------------------------------------------------------------
create table public.fin_recurrentes (
  id           uuid primary key default gen_random_uuid(),
  propietario  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sobre_id     uuid not null references public.fin_sobres(id) on delete restrict,
  concepto     text not null default '',
  importe      numeric(12, 2) not null,
  nota         text not null default '',
  meses        smallint not null default 1 check (meses between 1 and 60),  -- repartir en N meses
  cada         smallint not null default 1 check (cada between 1 and 365),
  unidad       text not null default 'mes' check (unidad in ('dia', 'semana', 'mes')),
  fecha_inicio date not null,
  siguiente    integer not null default 0 check (siguiente >= 0),  -- nº de la próxima repetición
  activo       boolean not null default true,
  creado       timestamptz not null default now(),
  modificado   timestamptz not null default now(),
  archivado    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Movimientos: cada gasto apuntado
-- ---------------------------------------------------------------------
create table public.fin_movimientos (
  id            uuid primary key default gen_random_uuid(),
  propietario   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha         date not null,
  sobre_id      uuid not null references public.fin_sobres(id) on delete restrict,
  concepto      text not null default '',
  importe       numeric(12, 2) not null,
  nota          text not null default '',
  meses         smallint not null default 1 check (meses between 1 and 60),
  recurrente_id uuid references public.fin_recurrentes(id) on delete set null,
  proyecto_id   uuid references public.proyectos(id) on delete set null,  -- viajes y proyectos (fase 1b)
  creado        timestamptz not null default now(),
  modificado    timestamptz not null default now(),
  archivado     boolean not null default false
);
-- Un recurrente no puede generar dos veces el mismo día, aunque Orvia
-- esté abierta en el móvil y en el ordenador a la vez.
create unique index fin_movimientos_recurrente_dia on public.fin_movimientos (recurrente_id, fecha) where recurrente_id is not null;

-- ---------------------------------------------------------------------
-- Inversiones: aportaciones (+) y retiradas (−)
-- ---------------------------------------------------------------------
create table public.fin_inversiones (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha       date not null,
  importe     numeric(14, 2) not null check (importe <> 0),
  nota        text not null default '',
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);

-- ---------------------------------------------------------------------
-- Aportaciones: dinero del Sobrante que va a un objetivo de ahorro
-- ---------------------------------------------------------------------
create table public.fin_aportaciones (
  id          uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  objetivo_id uuid not null references public.objetivos(id) on delete cascade,
  sobre_id    uuid references public.fin_sobres(id) on delete set null,  -- de qué sobre salió el sobrante
  mes         date not null check (extract(day from mes) = 1),
  importe     numeric(12, 2) not null,
  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),
  archivado   boolean not null default false
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index fin_sueldos_prop_idx       on public.fin_sueldos (propietario, desde_mes);
create index fin_pagas_prop_idx         on public.fin_pagas_extra (propietario);
create index fin_sobres_prop_idx        on public.fin_sobres (propietario, orden);
create index fin_porcentajes_sobre_idx  on public.fin_porcentajes (sobre_id, desde_mes);
create index fin_conceptos_sobre_idx    on public.fin_conceptos (sobre_id, orden);
create index fin_recurrentes_prop_idx   on public.fin_recurrentes (propietario, activo);
create index fin_movimientos_fecha_idx  on public.fin_movimientos (propietario, fecha);
create index fin_movimientos_sobre_idx  on public.fin_movimientos (sobre_id);
create index fin_movimientos_proy_idx   on public.fin_movimientos (proyecto_id) where proyecto_id is not null;
create index fin_inversiones_fecha_idx  on public.fin_inversiones (propietario, fecha);
create index fin_aportaciones_obj_idx   on public.fin_aportaciones (objetivo_id, mes);

-- ---------------------------------------------------------------------
-- "modificado" automático, permisos y seguridad por fila
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'fin_config', 'fin_sueldos', 'fin_pagas_extra', 'fin_sobres', 'fin_porcentajes',
    'fin_conceptos', 'fin_recurrentes', 'fin_movimientos', 'fin_inversiones', 'fin_aportaciones'
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
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- fin_reiniciar(): borra todos tus datos de Finanzas (también los
-- objetivos de ahorro). Lo usa "Volver a importar".
-- ---------------------------------------------------------------------
create or replace function public.fin_reiniciar()
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
  delete from fin_recurrentes  where propietario = auth.uid();
  delete from fin_inversiones  where propietario = auth.uid();
  delete from fin_conceptos    where propietario = auth.uid();
  delete from fin_porcentajes  where propietario = auth.uid();
  delete from fin_sobres       where propietario = auth.uid();
  delete from fin_pagas_extra  where propietario = auth.uid();
  delete from fin_sueldos      where propietario = auth.uid();
  delete from fin_config       where propietario = auth.uid();
  delete from objetivos        where propietario = auth.uid() and metrica = 'dinero';
end;
$$;

-- ---------------------------------------------------------------------
-- fin_importar(datos): guarda una configuración completa en una sola
-- operación. Si algo falla, no se guarda nada.
-- datos = { reemplazar, config, sueldos, pagas, sobres, porcentajes,
--           conceptos, recurrentes, movimientos, inversiones,
--           objetivos, aportaciones } (los identificadores vienen ya creados)
-- ---------------------------------------------------------------------
create or replace function public.fin_importar(datos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  area_finanzas uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  if exists (select 1 from fin_config where propietario = auth.uid()) then
    if coalesce((datos ->> 'reemplazar')::boolean, false) then
      perform fin_reiniciar();
    else
      raise exception 'Finanzas ya tiene una configuración. Usa "Volver a importar" para reemplazarla.';
    end if;
  end if;

  select id into area_finanzas from areas
   where propietario = auth.uid() and nombre = 'Finanzas' and not archivado limit 1;

  insert into fin_config (fecha_inicio, saldo_inicial, ahorro_inicial, inversion_inicial,
                          inversion_valor, fondo_inicial, fondo_tope, sobrante_inicial)
  select coalesce(x.fecha_inicio, '2027-01-01'), coalesce(x.saldo_inicial, 0), coalesce(x.ahorro_inicial, 0),
         coalesce(x.inversion_inicial, 0), coalesce(x.inversion_valor, 0), coalesce(x.fondo_inicial, 0),
         coalesce(x.fondo_tope, 3000), coalesce(x.sobrante_inicial, 0)
    from jsonb_to_record(datos -> 'config') as x(
      fecha_inicio date, saldo_inicial numeric, ahorro_inicial numeric, inversion_inicial numeric,
      inversion_valor numeric, fondo_inicial numeric, fondo_tope numeric, sobrante_inicial numeric);

  insert into fin_sueldos (desde_mes, importe)
  select x.desde_mes, x.importe
    from jsonb_to_recordset(coalesce(datos -> 'sueldos', '[]')) as x(desde_mes date, importe numeric);

  insert into fin_pagas_extra (mes_del_anio, importe, concepto)
  select x.mes_del_anio, x.importe, coalesce(x.concepto, 'Paga extra')
    from jsonb_to_recordset(coalesce(datos -> 'pagas', '[]')) as x(mes_del_anio smallint, importe numeric, concepto text);

  insert into fin_sobres (id, nombre, tipo, color, orden, desde_mes, hasta_mes, clave_sobrea)
  select x.id, x.nombre, x.tipo, x.color, x.orden, x.desde_mes, x.hasta_mes, x.clave_sobrea
    from jsonb_to_recordset(coalesce(datos -> 'sobres', '[]')) as x(
      id uuid, nombre text, tipo text, color text, orden smallint, desde_mes date, hasta_mes date, clave_sobrea text);

  insert into fin_porcentajes (sobre_id, desde_mes, porcentaje)
  select x.sobre_id, x.desde_mes, x.porcentaje
    from jsonb_to_recordset(coalesce(datos -> 'porcentajes', '[]')) as x(sobre_id uuid, desde_mes date, porcentaje numeric);

  insert into fin_conceptos (sobre_id, nombre, orden)
  select x.sobre_id, x.nombre, x.orden
    from jsonb_to_recordset(coalesce(datos -> 'conceptos', '[]')) as x(sobre_id uuid, nombre text, orden smallint);

  insert into fin_recurrentes (id, sobre_id, concepto, importe, nota, meses, cada, unidad, fecha_inicio, siguiente, activo)
  select x.id, x.sobre_id, coalesce(x.concepto, ''), x.importe, coalesce(x.nota, ''), coalesce(x.meses, 1),
         x.cada, x.unidad, x.fecha_inicio, coalesce(x.siguiente, 0), coalesce(x.activo, true)
    from jsonb_to_recordset(coalesce(datos -> 'recurrentes', '[]')) as x(
      id uuid, sobre_id uuid, concepto text, importe numeric, nota text, meses smallint, cada smallint,
      unidad text, fecha_inicio date, siguiente integer, activo boolean);

  insert into fin_movimientos (fecha, sobre_id, concepto, importe, nota, meses, recurrente_id)
  select x.fecha, x.sobre_id, coalesce(x.concepto, ''), x.importe, coalesce(x.nota, ''), coalesce(x.meses, 1), x.recurrente_id
    from jsonb_to_recordset(coalesce(datos -> 'movimientos', '[]')) as x(
      fecha date, sobre_id uuid, concepto text, importe numeric, nota text, meses smallint, recurrente_id uuid)
  on conflict do nothing;  -- un recurrente repetido el mismo día se ignora

  insert into fin_inversiones (fecha, importe, nota)
  select x.fecha, x.importe, coalesce(x.nota, '')
    from jsonb_to_recordset(coalesce(datos -> 'inversiones', '[]')) as x(fecha date, importe numeric, nota text)
   where x.importe <> 0;

  insert into objetivos (id, titulo, area_id, horizonte, fecha_inicio, fecha_limite, metrica, valor_meta, revisado_hasta, estado)
  select x.id, x.titulo, area_finanzas, 'anio', x.fecha_inicio, x.fecha_limite, 'dinero', x.valor_meta, x.revisado_hasta, 'activo'
    from jsonb_to_recordset(coalesce(datos -> 'objetivos', '[]')) as x(
      id uuid, titulo text, fecha_inicio date, fecha_limite date, valor_meta numeric, revisado_hasta date);

  insert into fin_aportaciones (objetivo_id, sobre_id, mes, importe)
  select x.objetivo_id, x.sobre_id, x.mes, x.importe
    from jsonb_to_recordset(coalesce(datos -> 'aportaciones', '[]')) as x(objetivo_id uuid, sobre_id uuid, mes date, importe numeric);

  return jsonb_build_object(
    'sobres',       (select count(*) from fin_sobres where propietario = auth.uid()),
    'movimientos',  (select count(*) from fin_movimientos where propietario = auth.uid()),
    'recurrentes',  (select count(*) from fin_recurrentes where propietario = auth.uid()),
    'objetivos',    (select count(*) from objetivos where propietario = auth.uid() and metrica = 'dinero'),
    'inversiones',  (select count(*) from fin_inversiones where propietario = auth.uid())
  );
end;
$$;

revoke all on function public.fin_reiniciar() from public, anon;
revoke all on function public.fin_importar(jsonb) from public, anon;
grant execute on function public.fin_reiniciar() to authenticated;
grant execute on function public.fin_importar(jsonb) to authenticated;
