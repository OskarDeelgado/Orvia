// Resumen de tu día para el Panel y la oficina (Acción, bloque 5).
// Junta lo que ya existe: tareas de hoy y atrasadas, el próximo evento del calendario
// y tus hábitos (nivel y avance de la semana). Solo lee.

import { listar } from '../../core/db.js';
import { leerHabitos } from './datos.js';
import { crearMotorHabitos } from './habitos-motor.js';
import { leerEventos, eventosPorDia } from './calendario.js';
import { hoy, lunesDe, sumarDias, diasDeLaSemana } from './fechas.js';

const ahoraTexto = () => {
  const d = new Date();
  return `${hoy()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * @returns {Promise<{
 *   tareas: object[], hechasHoy: number, atrasadas: number,
 *   eventosHoy: object[], proximo: object|null, conCalendario: boolean,
 *   habitos: {titulo, total, meta, cantidad, cumplida}[], nivel: object|null
 * }>}
 */
export async function leerResumenDia() {
  const h = hoy();
  const lunes = lunesDe(h);
  const [deHoy, atrasadas, proyectos, habitos, eventos] = await Promise.all([
    listar('tareas', { filtros: { fecha: h } }),
    listar('tareas', { filtros: { estado: 'pendiente' }, rango: { campo: 'fecha', hasta: h } }),
    listar('proyectos').catch(() => []),
    leerHabitos().catch(() => null),
    leerEventos(lunes, sumarDias(lunes, 7)).catch(() => ({ eventos: [], errores: [], calendarios: 0 })),
  ]);
  const porProyecto = Object.fromEntries(proyectos.map((p) => [p.id, p]));
  const conProyecto = (t) => ({ ...t, proyecto: t.proyecto_id ? porProyecto[t.proyecto_id]?.titulo || null : null });
  const pendientesHoy = deHoy.filter((t) => t.estado === 'pendiente');
  const tareas = [
    ...atrasadas.sort((a, b) => a.fecha.localeCompare(b.fecha)).map((t) => ({ ...conProyecto(t), atrasada: true })),
    ...pendientesHoy.sort((a, b) => a.prioridad - b.prioridad || String(a.creado).localeCompare(String(b.creado))).map(conProyecto),
  ];

  const eventosHoy = eventosPorDia(eventos.eventos || [], diasDeLaSemana(lunes))[h] || [];
  const ahora = ahoraTexto();
  // Próximo: el primero con hora que aún no ha terminado; si no hay, uno de día completo.
  const proximo = eventosHoy.find((e) => !e.todoElDia && e.fin > ahora) || eventosHoy.find((e) => e.todoElDia) || null;

  let resumenHabitos = [], nivel = null;
  if (habitos) {
    const motor = crearMotorHabitos(habitos);
    resumenHabitos = motor.resumenes.map((r) => ({
      titulo: r.habito.titulo, total: r.actual.total, meta: r.actual.meta, cantidad: r.cantidad,
      cumplida: r.actual.cumplida, hechoHoy: !!r.actual.dias[h],
    }));
    nivel = motor.general;
  }

  return {
    tareas,
    hechasHoy: deHoy.filter((t) => t.estado === 'hecha').length,
    atrasadas: atrasadas.length,
    eventosHoy,
    proximo,
    // Eventos de hoy que aún no han terminado, además del próximo.
    masEventos: eventosHoy.filter((e) => e !== proximo && (e.todoElDia || e.fin > ahora)).length,
    conCalendario: (eventos.calendarios || 0) > 0,
    habitos: resumenHabitos,
    nivel,
  };
}

/** Frase corta para la ficha de Endrick: «2 tareas hoy · nivel 4». */
export function situacionDe(r) {
  const partes = [];
  const n = r.tareas.length;
  partes.push(n ? `${n} ${n === 1 ? 'tarea' : 'tareas'} hoy` : r.hechasHoy ? 'Todo hecho hoy' : 'Día libre de tareas');
  if (r.nivel && r.habitos.length) partes.push(`nivel ${r.nivel.nivel}`);
  return partes.join(' · ');
}
