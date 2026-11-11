// Datos de Acción (bloque 1: tareas). Usa la tabla común `tareas` del núcleo
// (supabase/001_nucleo.sql); no necesita migración.

import { listar, crear, actualizar, archivar } from '../../core/db.js';
import { listarAreas } from '../../core/areas.js';

// ---------- Fechas (días como 'AAAA-MM-DD', en hora local) ----------
const dosCifras = (n) => String(n).padStart(2, '0');
export const aTexto = (d) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`;
export const aFecha = (t) => new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
export const hoy = () => aTexto(new Date());
export const sumarDias = (t, n) => { const d = aFecha(t); d.setDate(d.getDate() + n); return aTexto(d); };
/** Lunes de la semana de un día. */
export const lunesDe = (t) => { const d = aFecha(t); return sumarDias(t, -((d.getDay() + 6) % 7)); };
export const diasDeLaSemana = (lunes) => [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(lunes, i));

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreDia = (t) => DIAS[aFecha(t).getDay()];
export const diaCorto = (t) => DIAS[aFecha(t).getDay()].slice(0, 3);
export const nombreMes = (t) => MESES[aFecha(t).getMonth()];
/** "lunes 9 de noviembre", o "Hoy", "Mañana", "Ayer". */
export function etiquetaDia(t, { relativo = true } = {}) {
  const h = hoy();
  if (relativo && t === h) return 'Hoy';
  if (relativo && t === sumarDias(h, 1)) return 'Mañana';
  if (relativo && t === sumarDias(h, -1)) return 'Ayer';
  const d = aFecha(t);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
/** "9 – 15 de noviembre" o "30 nov – 6 dic". */
export function rangoSemana(lunes) {
  const a = aFecha(lunes), b = aFecha(sumarDias(lunes, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} ${MESES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MESES[b.getMonth()].slice(0, 3)}`;
}

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
