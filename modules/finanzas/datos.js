// Acceso a los datos de Finanzas. Todo pasa por core/db.js.

import { listar, contar, llamar } from '../../core/db.js';

/** Primer día de un mes como texto 'AAAA-MM-01'. */
export function primerDiaDelMes(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Valor vigente en un mes dentro de un historial [{desde_mes, ...}] ordenado por fecha. */
export function vigente(historial, mes, campo) {
  let valor = null;
  for (const fila of historial) if (fila.desde_mes <= mes) valor = fila[campo];
  return valor;
}

/** Lee la configuración de Finanzas. Devuelve null si aún no hay ninguna. */
export async function leerConfiguracion() {
  const [config] = await listar('fin_config');
  if (!config) return null;
  const [sueldos, pagas, sobres, porcentajes, movimientos, recurrentes, inversiones, conceptos, objetivos] = await Promise.all([
    listar('fin_sueldos', { orden: 'desde_mes' }),
    listar('fin_pagas_extra', { orden: 'mes_del_anio' }),
    listar('fin_sobres', { orden: 'orden' }),
    listar('fin_porcentajes', { orden: 'desde_mes' }),
    contar('fin_movimientos'),
    contar('fin_recurrentes'),
    contar('fin_inversiones'),
    contar('fin_conceptos'),
    listar('objetivos', { filtros: { metrica: 'dinero' } }),
  ]);
  // Mes de referencia: el actual o, si Finanzas aún no ha empezado, su mes de inicio.
  const hoy = primerDiaDelMes();
  const mes = hoy > config.fecha_inicio ? hoy : config.fecha_inicio;
  const activo = (s) => (!s.desde_mes || s.desde_mes <= mes) && (!s.hasta_mes || s.hasta_mes > mes);
  const reparto = sobres
    .filter((s) => s.tipo !== 'ingreso' && activo(s))
    .map((s) => ({
      ...s,
      porcentaje: Number(vigente(porcentajes.filter((p) => p.sobre_id === s.id), mes, 'porcentaje') ?? 0),
    }));
  return {
    config,
    mes,
    sueldo: Number(vigente(sueldos, mes, 'importe') ?? 0),
    pagas,
    reparto,
    cuentas: { movimientos, recurrentes, inversiones, conceptos, objetivos: objetivos.length },
  };
}

/** Guarda una configuración completa (de Sobrea o la básica). */
export function importar(datos, { reemplazar = false } = {}) {
  return llamar('fin_importar', { datos: { ...datos, reemplazar } });
}
