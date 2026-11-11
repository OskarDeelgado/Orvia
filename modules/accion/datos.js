// Datos de Acción (bloque 1: tareas). Usa la tabla común `tareas` del núcleo
// (supabase/001_nucleo.sql); no necesita migración.

import { listar, crear, actualizar, archivar } from '../../core/db.js';
import { listarAreas } from '../../core/areas.js';

import { hoy, sumarDias, lunesDe, diasDeLaSemana } from './fechas.js';
export * from './fechas.js';

// ---------- Lectura ----------
const ordenTareas = (a, b) =>
  (a.estado === 'hecha') - (b.estado === 'hecha') || a.prioridad - b.prioridad || String(a.creado).localeCompare(String(b.creado));

/**
 * Todo lo que necesita la vista de la semana.
 * @returns {{ lunes, dias: Object<string, tarea[]>, sinFecha: tarea[], atrasadas: tarea[], areas, porArea }}
 */
export async function leerSemana(lunes) {
  const domingoSiguiente = sumarDias(lunes, 7);
  const [semana, sinFecha, atrasadas, areas] = await Promise.all([
    listar('tareas', { rango: { campo: 'fecha', desde: lunes, hasta: domingoSiguiente } }),
    listar('tareas', { filtros: { fecha: null, estado: 'pendiente' } }),
    listar('tareas', { filtros: { estado: 'pendiente' }, rango: { campo: 'fecha', hasta: hoy() } }),
    listarAreas(),
  ]);
  const dias = Object.fromEntries(diasDeLaSemana(lunes).map((d) => [d, []]));
  for (const t of semana) if (t.estado !== 'cancelada' && dias[t.fecha]) dias[t.fecha].push(t);
  for (const d of Object.keys(dias)) dias[d].sort(ordenTareas);
  return {
    lunes, dias,
    sinFecha: sinFecha.sort(ordenTareas),
    atrasadas: atrasadas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.prioridad - b.prioridad),
    areas, porArea: Object.fromEntries(areas.map((a) => [a.id, a])),
  };
}

/** Tareas pendientes de hoy (y atrasadas), para el Panel y la oficina. */
export async function leerHoy() {
  const h = hoy();
  const [deHoy, atrasadas] = await Promise.all([
    listar('tareas', { filtros: { fecha: h } }),
    listar('tareas', { filtros: { estado: 'pendiente' }, rango: { campo: 'fecha', hasta: h } }),
  ]);
  const pendientes = deHoy.filter((t) => t.estado === 'pendiente');
  return { pendientes: pendientes.length, hechas: deHoy.filter((t) => t.estado === 'hecha').length, atrasadas: atrasadas.length };
}

// ---------- Escritura ----------
export function crearTarea({ titulo, fecha = null, prioridad = 2, area_id = null, notas = null }) {
  return crear('tareas', { titulo, fecha, prioridad, area_id, notas, estado: 'pendiente', semana: fecha ? lunesDe(fecha) : null });
}

export function guardarTarea(id, { titulo, fecha, prioridad, area_id, notas }) {
  return actualizar('tareas', id, { titulo, fecha, prioridad, area_id, notas, semana: fecha ? lunesDe(fecha) : null });
}

export function moverTarea(id, fecha) {
  return actualizar('tareas', id, { fecha, semana: fecha ? lunesDe(fecha) : null });
}

export function marcarTarea(tarea, hecha) {
  return actualizar('tareas', tarea.id, {
    estado: hecha ? 'hecha' : 'pendiente',
    completada_en: hecha ? new Date().toISOString() : null,
  });
}

export const eliminarTarea = (id) => archivar('tareas', id);

/** Avisa a las pantallas de Acción (y al Panel) de que algo ha cambiado. */
export const avisarCambio = () => dispatchEvent(new CustomEvent('orvia:accion'));

// ---------- Hábitos (bloque 2; tablas del núcleo + supabase/004_habitos.sql) ----------

export async function leerHabitos() {
  const [habitos, registros, comodines, areas] = await Promise.all([
    listar('habitos', { filtros: { activo: true }, orden: 'orden' }),
    listar('habitos_registros', { orden: 'fecha' }),
    listar('habitos_comodines'),
    listarAreas(),
  ]);
  return { habitos, registros, comodines, areas, porArea: Object.fromEntries(areas.map((a) => [a.id, a])) };
}

export function crearHabito({ titulo, frecuencia, dificultad = 2, area_id = null, orden = 0 }) {
  return crear('habitos', { titulo, frecuencia, dificultad, area_id, orden, activo: true, desde: lunesDe(hoy()) });
}
export const guardarHabito = (id, cambios) => actualizar('habitos', id, cambios);
export const eliminarHabito = (id) => archivar('habitos', id);

/**
 * Marca o desmarca un día (hábito semanal) o guarda la cantidad del día (pasos).
 * Un día tiene un único registro (único por hábito y fecha): se actualiza, nunca se duplica.
 */
export async function guardarDia(registros, habitoId, fecha, { hecho, valor = null }) {
  const existente = registros.find((r) => r.habito_id === habitoId && r.fecha === fecha);
  if (existente) return actualizar('habitos_registros', existente.id, { hecho, valor });
  try {
    return await crear('habitos_registros', { habito_id: habitoId, fecha, hecho, valor });
  } catch (e) {
    // Ya existía (por ejemplo, lo apuntó el atajo de pasos desde otro dispositivo): se actualiza.
    if (e.original?.code !== '23505') throw e;
    const [fila] = await listar('habitos_registros', { filtros: { habito_id: habitoId, fecha }, incluirArchivados: true });
    return actualizar('habitos_registros', fila.id, { hecho, valor, archivado: false });
  }
}

export const usarComodin = (habitoId, semana) => crear('habitos_comodines', { habito_id: habitoId, semana });

/** Avisa a las pantallas de hábitos (y de la semana) de que algo ha cambiado. */
export const avisarHabitos = () => dispatchEvent(new CustomEvent('orvia:accion'));
