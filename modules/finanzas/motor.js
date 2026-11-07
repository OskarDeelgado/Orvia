// Motor de cálculo de Finanzas: las mismas fórmulas que Sobrea.
// Se crea a partir de todos los datos de Finanzas (un "libro") y responde
// preguntas por mes. El mes 0 es el mes de inicio (enero de 2027).
//
// Equivalencias con Sobrea (entre paréntesis, su nombre):
//   ingreso (inc)      sueldo vigente + pagas extra de ese mes del año
//   presupuesto (bud)  ingreso × porcentaje del sobre
//   gastado (sp)       lo que cuenta en el mes (los repartidos, su cuota)
//   efectivo (cs)      lo que sale de la cuenta ese mes (los repartidos, entero el día del gasto)
//   traspaso (tr)      ingreso × (1 − suma de % de los sobres de gasto) → va al ahorro
//   fondo (fd)         recibe lo menor entre su % del ingreso y lo que le falta para el tope
//   saldo (saldo)      cuenta del día a día
//   ahorro (sav)       cuenta de ahorro (incluye el fondo)
//   sobrante (huc)     lo no gastado de cada sobre, acumulado, menos lo aportado a objetivos

import { mesDe, sumarMeses, distanciaMeses, cuotaDelMes, hoy, euros } from './calculo.js';

const EPS = 0.004;

/** Lee todos los datos de Finanzas. Devuelve null si aún no hay configuración. */
export async function leerLibro() {
  const { listar } = await import('../../core/db.js'); // se importa aquí para poder probar el motor fuera del navegador
  const [config] = await listar('fin_config');
  if (!config) return null;
  const [sueldos, pagas, sobres, porcentajes, conceptos, movimientos, recurrentes, inversiones, objetivos, aportaciones] = await Promise.all([
    listar('fin_sueldos', { orden: 'desde_mes' }),
    listar('fin_pagas_extra', { orden: 'mes_del_anio' }),
    listar('fin_sobres', { orden: 'orden' }),
    listar('fin_porcentajes', { orden: 'desde_mes' }),
    listar('fin_conceptos', { orden: 'orden' }),
    listar('fin_movimientos', { orden: 'fecha', ascendente: false }),
    listar('fin_recurrentes'),
    listar('fin_inversiones', { orden: 'fecha', ascendente: false }),
    listar('objetivos', { filtros: { metrica: 'dinero' } }),
    listar('fin_aportaciones', { orden: 'mes' }),
  ]);
  return crearMotor({ config, sueldos, pagas, sobres, porcentajes, conceptos, movimientos, recurrentes, inversiones, objetivos, aportaciones });
}

export function crearMotor(libro) {
  const { config, sueldos, pagas, sobres, porcentajes, movimientos, inversiones, aportaciones } = libro;
  const inicio = config.fecha_inicio;
  const numero = (v) => Number(v) || 0;

  // ---------- Meses ----------
  const mesK = (k) => sumarMeses(inicio, k);
  const kDe = (fecha) => distanciaMeses(inicio, mesDe(fecha));
  const kHoy = () => kDe(hoy());
  /** Mes que se abre por defecto: el actual, o el de inicio si aún no ha llegado (como Sobrea). */
  const kInicial = () => Math.max(0, kHoy());

  // ---------- Sobres ----------
  const porId = Object.fromEntries(sobres.map((s) => [s.id, s]));
  const gasto = sobres.filter((s) => s.tipo === 'gasto');
  const ingreso = sobres.filter((s) => s.tipo === 'ingreso');
  const fondo = sobres.find((s) => s.tipo === 'fondo') || null;
  const pctDe = {};
  for (const p of porcentajes) (pctDe[p.sobre_id] ||= []).push(p);

  const activo = (s, k) => {
    if (s.tipo === 'fondo') return true;
    const m = mesK(k);
    return (!s.desde_mes || s.desde_mes <= m) && (!s.hasta_mes || m < s.hasta_mes);
  };
  const vigente = (lista, m, campo) => {
    let v = 0;
    for (const f of lista || []) if (f.desde_mes <= m) v = numero(f[campo]);
    return v;
  };
  /** Porcentaje del ingreso de un sobre en el mes k (0 si no está activo). */
  const porcentaje = (s, k) => (activo(s, k) ? vigente(pctDe[s.id], mesK(k), 'porcentaje') : 0);

  // ---------- Dinero que entra ----------
  const ingresoMes = (k) => {
    if (k < 0) return 0;
    const m = mesK(k);
    const mesDelAnio = +m.slice(5, 7);
    return vigente(sueldos, m, 'importe') + pagas.filter((p) => p.mes_del_anio === mesDelAnio).reduce((a, p) => a + numero(p.importe), 0);
  };

  // ---------- Movimientos (con caché por mes) ----------
  const movsDe = {};
  for (const m of movimientos) (movsDe[m.sobre_id] ||= []).push(m);
  const cacheGastado = new Map();
  /** Lo que cuenta un sobre en el mes k (los repartidos, su cuota). */
  const gastado = (s, k) => {
    const clave = s.id + ':' + k;
    if (!cacheGastado.has(clave)) {
      const m = mesK(k);
      cacheGastado.set(clave, (movsDe[s.id] || []).reduce((a, mv) => a + cuotaDelMes(mv, m), 0));
    }
    return cacheGastado.get(clave);
  };
  /** Lo que sale de la cuenta en el mes k por un sobre (los repartidos, entero en su mes). */
  const efectivo = (s, k) => {
    const m = mesK(k);
    return (movsDe[s.id] || []).reduce((a, mv) => (mesDe(mv.fecha) === m ? a + numero(mv.importe) : a), 0);
  };
  const presupuesto = (s, k) => ingresoMes(k) * porcentaje(s, k);
  const ingresosExtra = (k) => ingreso.reduce((a, s) => a + gastado(s, k), 0);
  /** Sobres de gasto que se ven en un mes: activos o con gasto. */
  const sobresDelMes = (k) => gasto.filter((s) => activo(s, k) || Math.abs(gastado(s, k)) > 0);

  const sumaPorcentajes = (k) => gasto.reduce((a, s) => a + porcentaje(s, k), 0);
  const traspaso = (k) => ingresoMes(k) * (1 - sumaPorcentajes(k));
  const efectivoGastos = (k) => gasto.reduce((a, s) => a + efectivo(s, k), 0);
  const inversionMes = (k) => {
    const m = mesK(k);
    return inversiones.reduce((a, r) => (mesDe(r.fecha) === m ? a + numero(r.importe) : a), 0);
  };
  const gastoFondo = (k) => (fondo ? gastado(fondo, k) : 0);
  const porcentajeFondo = (k) => (fondo ? porcentaje(fondo, k) : 0);

  // ---------- Acumulados ----------
  function fondoHasta(n) {
    let f = numero(config.fondo_inicial);
    const tope = numero(config.fondo_tope);
    const filas = [];
    for (let k = 0; k <= n; k++) {
      const aporta = Math.max(0, Math.min(porcentajeFondo(k) * ingresoMes(k), tope - f));
      f += aporta - gastoFondo(k);
      filas.push({ f, aporta });
    }
    return filas;
  }
  const fondoEn = (n) => (n < 0 ? { f: numero(config.fondo_inicial), aporta: 0 } : fondoHasta(n)[n]);
  function saldo(n) {
    let t = numero(config.saldo_inicial);
    for (let k = 0; k <= n; k++) t += ingresoMes(k) + ingresosExtra(k) - efectivoGastos(k) - traspaso(k);
    return t;
  }
  function ahorroCuenta(n) {
    let t = numero(config.ahorro_inicial);
    for (let k = 0; k <= n; k++) t += traspaso(k) - gastoFondo(k) - inversionMes(k);
    return t;
  }
  function invertido(n) {
    let t = numero(config.inversion_inicial);
    for (let k = 0; k <= n; k++) t += inversionMes(k);
    return t;
  }
  /** Ahorro e inversión acumulado: lo traspasado menos lo que se ha llevado el fondo. */
  function ahorroEInversion(n) {
    const f = fondoHasta(n);
    let t = 0;
    for (let k = 0; k <= n; k++) t += traspaso(k) - f[k].aporta;
    return t;
  }
  const margen = (k) => gasto.reduce((a, s) => a + presupuesto(s, k) - gastado(s, k), 0);
  const aportadoHasta = (n) => aportaciones.reduce((a, c) => (distanciaMeses(inicio, c.mes) <= n ? a + numero(c.importe) : a), 0);
  function sobrante(n) {
    let t = numero(config.sobrante_inicial);
    for (let k = 0; k <= n; k++) t += margen(k);
    return t - aportadoHasta(n);
  }
  /** Patrimonio: cuenta diaria + ahorro + inversiones (valor actual en el mes en curso, si se ha indicado). */
  function patrimonio(k) {
    const a = saldo(k), b = ahorroCuenta(k);
    const valor = numero(config.inversion_valor);
    const c = valor > 0 && k === kInicial() ? valor : invertido(k);
    return { cuenta: a, ahorro: b, inversion: c, total: a + b + c };
  }

  // ---------- Resumen del mes (pestaña Mes, Inicio y Panel) ----------
  function resumenMes(k) {
    const lista = sobresDelMes(k);
    let total = 0, gastadoTotal = 0;
    for (const s of lista) {
      total += presupuesto(s, k);
      gastadoTotal += gastado(s, k);
    }
    const extra = ingresosExtra(k);
    total += extra;
    const queda = total - gastadoTotal;
    const pasados = lista.filter((s) => gastado(s, k) > presupuesto(s, k) + EPS);
    const esActual = k === kHoy();
    const m = mesK(k);
    const diasMes = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const dia = esActual ? +hoy().slice(8, 10) : null;
    const avanceMes = esActual ? dia / diasMes : null;
    const fraccionGastada = total > 0 ? gastadoTotal / total : gastadoTotal > 0 ? 1 : 0;

    let estado;
    if (queda < -EPS) estado = { tipo: 'mal', texto: `Te has pasado ${euros(-queda)} del presupuesto` };
    else if (pasados.length) {
      estado = {
        tipo: 'atencion',
        texto: pasados.length > 1 ? `${pasados.length} categorías se han pasado`
          : `${pasados[0].nombre} se ha pasado ${euros(gastado(pasados[0], k) - presupuesto(pasados[0], k))}`,
      };
    } else if (avanceMes != null && fraccionGastada > avanceMes + 0.1) {
      estado = { tipo: 'atencion', texto: `Vas más rápido que el mes: llevas el ${Math.round(fraccionGastada * 100)} % gastado` };
    } else {
      estado = { tipo: 'bien', texto: 'Vas bien' + (avanceMes != null ? `: llevas el ${Math.round(fraccionGastada * 100)} % gastado` : '') };
    }

    return {
      k, mes: m, total, gastado: gastadoTotal, queda, ingresosExtra: extra, fraccionGastada, estado,
      esActual, dia, diasMes, avanceMes,
      sueldo: ingresoMes(k), cuentaDiaria: saldo(k), aAhorro: traspaso(k),
      sobres: lista.map((s) => ({ sobre: s, gastado: gastado(s, k), presupuesto: presupuesto(s, k) })),
      extraordinarios: gastoFondo(k),
    };
  }

  return {
    libro, inicio, porId, gasto, ingreso, fondo,
    mesK, kDe, kHoy, kInicial,
    activo, porcentaje, ingresoMes, presupuesto, gastado, efectivo, ingresosExtra, sobresDelMes,
    traspaso, fondoEn, saldo, ahorroCuenta, invertido, ahorroEInversion, sobrante, margen, aportadoHasta, patrimonio,
    resumenMes,
  };
}
