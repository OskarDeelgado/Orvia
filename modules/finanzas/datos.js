// Acceso a los datos de Finanzas. Todo pasa por core/db.js.

import { listar, contar, llamar, crear, actualizar, archivar } from '../../core/db.js';
import { sumarMeses, fechaRepeticion, hoy } from './calculo.js';

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

/** Mes que se muestra al abrir: el actual o, si Finanzas aún no ha empezado, su mes de inicio. */
export function mesInicial(config) {
  const actual = primerDiaDelMes();
  return config && config.fecha_inicio > actual ? config.fecha_inicio : actual;
}

/** Configuración, sobres y conceptos: lo necesario para apuntar y mostrar gastos. */
export async function leerCatalogo() {
  const [config] = await listar('fin_config');
  if (!config) return null;
  const [sobres, conceptos] = await Promise.all([
    listar('fin_sobres', { orden: 'orden' }),
    listar('fin_conceptos', { orden: 'orden' }),
  ]);
  const visibles = sobres.filter((s) => s.tipo !== 'ingreso');
  return {
    config,
    sobres: visibles,
    porId: Object.fromEntries(sobres.map((s) => [s.id, s])),
    conceptosDe: (sobreId) => conceptos.filter((c) => c.sobre_id === sobreId).map((c) => c.nombre),
  };
}

/** Sobres en los que se puede apuntar un gasto en un mes (los de gasto activos y Extraordinarios). */
export function sobresDelMes(catalogo, mes) {
  return catalogo.sobres.filter((s) => s.tipo === 'fondo' || ((!s.desde_mes || s.desde_mes <= mes) && (!s.hasta_mes || s.hasta_mes > mes)));
}

/** Movimientos que pueden contar en un mes (incluye los repartidos de hasta 5 años antes). */
export function leerMovimientos(mes) {
  return listar('fin_movimientos', {
    rango: { campo: 'fecha', desde: sumarMeses(mes, -59), hasta: sumarMeses(mes, 1) },
    orden: 'fecha',
    ascendente: false,
  });
}

/** Crea o actualiza un movimiento. */
export function guardarMovimiento({ id, ...campos }) {
  return id ? actualizar('fin_movimientos', id, campos) : crear('fin_movimientos', campos);
}

/** Elimina un movimiento (queda archivado y entra en la copia de seguridad). */
export function eliminarMovimiento(id) {
  return archivar('fin_movimientos', id);
}

/** Crea un recurrente y apunta las repeticiones que ya tocan (la primera, hoy o antes). */
export async function crearRecurrente(campos) {
  const rec = await crear('fin_recurrentes', { ...campos, siguiente: 0, activo: true });
  await generarRecurrentes();
  return rec;
}

/**
 * Apunta las repeticiones pendientes de los recurrentes activos, hasta hoy.
 * La base de datos impide duplicados, así que no importa si el móvil y el
 * ordenador lo hacen a la vez. Devuelve cuántos movimientos ha creado.
 */
export async function generarRecurrentes() {
  const [config] = await listar('fin_config');
  if (!config) return 0;
  const recurrentes = await listar('fin_recurrentes', { filtros: { activo: true } });
  const limite = hoy();
  let creados = 0;
  for (const r of recurrentes) {
    let k = r.siguiente;
    for (let vueltas = 0; vueltas < 800; vueltas++) {
      const fecha = fechaRepeticion(r, k);
      if (fecha > limite) break;
      if (fecha >= config.fecha_inicio) {
        try {
          await crear('fin_movimientos', {
            fecha, sobre_id: r.sobre_id, concepto: r.concepto, importe: r.importe, nota: r.nota, meses: r.meses, recurrente_id: r.id,
          });
          creados++;
        } catch (e) {
          if (e.original?.code !== '23505') throw e; // 23505: ya existía (lo creó otro dispositivo)
        }
      }
      k++;
    }
    if (k !== r.siguiente) await actualizar('fin_recurrentes', r.id, { siguiente: k });
  }
  return creados;
}
