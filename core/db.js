// Única puerta de acceso a la base de datos.
// Ningún módulo usa Supabase directamente: todos pasan por estas funciones.
// Así, si algún día cambia la base de datos, solo hay que tocar este archivo.

import { SUPABASE_URL, SUPABASE_CLAVE_PUBLICA } from './config.js';

// vendor/supabase.js se carga antes en index.html y deja "supabase" en window.
export const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICA, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'orvia-sesion',
  },
});

// Todas las tablas: núcleo (001), Finanzas (002) y comodines de hábitos (004). La copia de seguridad las incluye todas.
export const TABLAS = [
  'areas',
  'objetivos',
  'proyectos',
  'tareas',
  'habitos',
  'habitos_registros',
  'habitos_comodines',
  'notas',
  'enlaces',
  'fin_config',
  'fin_sueldos',
  'fin_pagas_extra',
  'fin_sobres',
  'fin_porcentajes',
  'fin_conceptos',
  'fin_recurrentes',
  'fin_movimientos',
  'fin_inversiones',
  'fin_aportaciones',
];

function comprobar({ data, error }, accion) {
  if (error) {
    const e = new Error(`No se pudo ${accion}: ${error.message}`);
    e.original = error;
    throw e;
  }
  return data;
}

/**
 * Lista filas de una tabla.
 * @param {string} tabla
 * @param {object} [opciones]
 * @param {object} [opciones.filtros]  igualdades campo → valor
 * @param {object} [opciones.rango]    { campo, desde, hasta }: desde incluido, hasta excluido
 * @param {string} [opciones.orden]    campo por el que ordenar
 * @param {boolean} [opciones.ascendente=true]
 * @param {boolean} [opciones.incluirArchivados=false]
 */
export async function listar(tabla, opciones = {}) {
  const { filtros = {}, rango = null, orden = 'creado', ascendente = true, incluirArchivados = false } = opciones;
  let consulta = cliente.from(tabla).select('*');
  if (!incluirArchivados) consulta = consulta.eq('archivado', false);
  for (const [campo, valor] of Object.entries(filtros)) {
    consulta = valor === null ? consulta.is(campo, null) : consulta.eq(campo, valor);
  }
  if (rango?.desde != null) consulta = consulta.gte(rango.campo, rango.desde);
  if (rango?.hasta != null) consulta = consulta.lt(rango.campo, rango.hasta);
  consulta = consulta.order(orden, { ascending: ascendente });
  return comprobar(await consulta, `leer ${tabla}`);
}

export async function obtener(tabla, id) {
  return comprobar(
    await cliente.from(tabla).select('*').eq('id', id).maybeSingle(),
    `leer ${tabla}`,
  );
}

export async function crear(tabla, datos) {
  const filas = Array.isArray(datos) ? datos : [datos];
  const resultado = comprobar(
    await cliente.from(tabla).insert(filas).select(),
    `guardar en ${tabla}`,
  );
  return Array.isArray(datos) ? resultado : resultado[0];
}

export async function actualizar(tabla, id, cambios) {
  return comprobar(
    await cliente.from(tabla).update(cambios).eq('id', id).select().single(),
    `actualizar ${tabla}`,
  );
}

// Nada se borra de verdad desde la app: se archiva y se puede recuperar.
export async function archivar(tabla, id) {
  return actualizar(tabla, id, { archivado: true });
}

export async function contar(tabla) {
  const { count, error } = await cliente
    .from(tabla)
    .select('id', { count: 'exact', head: true })
    .eq('archivado', false);
  if (error) throw new Error(`No se pudo contar ${tabla}: ${error.message}`);
  return count ?? 0;
}

/** Ejecuta una función de la base de datos (por ejemplo, fin_importar). */
export async function llamar(funcion, argumentos = {}) {
  return comprobar(await cliente.rpc(funcion, argumentos), 'completar la operación');
}

// Copia completa de todos tus datos, incluidos los archivados.
export async function exportarTodo() {
  const copia = {
    app: 'Orvia',
    version: 1,
    exportado: new Date().toISOString(),
    tablas: {},
  };
  for (const tabla of TABLAS) {
    copia.tablas[tabla] = await listar(tabla, { incluirArchivados: true });
  }
  return copia;
}
