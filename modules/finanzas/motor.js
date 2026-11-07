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

import { mesDe, sumarMeses, distanciaMeses, cuotaDelMes, hoy, euros, movimientosDelMes, fechaRepeticion } from './calculo.js';

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

  // ---------- Objetivos de ahorro (salen del Sobrante, como en Sobrea) ----------
  // Cada objetivo va de un mes (m0) a otro (m1). "revisado" es el último mes cuyo
  // cierre ya se ha hecho (aportando u omitiendo); en Sobrea se llama hk.
  const r2 = (x) => Math.round(x * 100) / 100;
  const objetivos = libro.objetivos || [];
  function objetivo(o) {
    const m0 = kDe(o.fecha_inicio), m1 = kDe(o.fecha_limite);
    const revisado = o.revisado_hasta ? kDe(o.revisado_hasta) : null;
    const meta = numero(o.valor_meta);
    const aportado = r2(aportaciones.reduce((a, c) => (c.objetivo_id === o.id ? a + numero(c.importe) : a), 0));
    const conseguido = aportado >= meta - 0.005;
    const hueco = Math.max(m0, Math.min(m1, revisado == null ? m0 : revisado + 1));
    return { o, m0, m1, revisado, meta, aportado, conseguido, hueco, falta: Math.max(0, r2(meta - aportado)) };
  }
  /** Cuota sugerida en el mes k: lo que falta entre los meses que quedan hasta el final. */
  const cuotaObjetivo = (g, k) => Math.max(0, g.meta - g.aportado) / Math.max(1, g.m1 - k + 1);
  /** Cómo va: conseguido, plazo vencido, empieza en…, o por delante/por detrás/al día. */
  function situacionObjetivo(g) {
    const actual = kHoy();
    if (g.conseguido) return '✓ Conseguido';
    if (actual > g.m1) return 'Plazo vencido';
    const ultimoCerrado = Math.min(actual - 1, g.m1);
    if (ultimoCerrado < g.m0) return 'Empieza en ' + nombreMesK(g.m0);
    const esperado = (g.meta * (ultimoCerrado - g.m0 + 1)) / (g.m1 - g.m0 + 1);
    const dif = g.aportado - esperado;
    return dif > 0.005 ? `Vas ${euros(dif)} por delante` : dif < -0.005 ? `Vas ${euros(-dif)} por detrás` : 'Vas al día';
  }
  /** Primer cierre de mes pendiente (meses ya terminados sin revisar), o null. */
  function cierrePendiente() {
    const actual = kHoy();
    for (const o of objetivos) {
      const g = objetivo(o);
      if (g.conseguido) continue;
      const k = g.revisado == null ? g.m0 : g.revisado + 1;
      if (k >= 0 && k <= g.m1 && k <= actual - 1) return { g, k };
    }
    return null;
  }
  /** Lo que se puede aportar en el mes k: el Sobrante acumulado y lo que sobró ese mes. */
  const disponibleObjetivos = (k) => ({ hay: r2(sobrante(k)), sobro: r2(Math.max(0, margen(k))) });
  const nombreMesK = (k) => {
    const m = mesK(k);
    const n = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' }).format(new Date(m + 'T00:00:00Z'));
    return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + m.slice(0, 4);
  };

  // ---------- Inicio y Análisis ----------
  /** Último mes con datos (movimientos o inversiones), o el mes que se abre por defecto (aE en Sobrea). */
  function kFinal() {
    let k = kInicial();
    for (const r of movimientos) k = Math.max(k, kDe(r.fecha));
    for (const r of inversiones) k = Math.max(k, kDe(r.fecha));
    return k;
  }
  /** Meses de los gráficos de evolución: los últimos 6 o 12, o todos (0). */
  const ventana = (rango) => {
    const e = kFinal(), lo = rango ? Math.max(0, e - rango + 1) : 0, r = [];
    for (let k = lo; k <= e; k++) r.push(k);
    return r;
  };
  /** Último porcentaje del historial de un sobre (aunque empiece en un mes futuro). */
  const ultimoPorcentaje = (s) => { const h = pctDe[s.id] || []; return h.length ? numero(h[h.length - 1].porcentaje) : 0; };
  /** Sugerencias de reajuste de porcentajes según el gasto de los 3 últimos meses cerrados (máx. ±2 puntos). */
  function sugerencias() {
    const c = kHoy();
    if (c < 3) return [];
    const k0 = c - 3, meses = [k0, k0 + 1, k0 + 2];
    const I = meses.reduce((a, k) => a + ingresoMes(k), 0);
    if (!(I > 0)) return [];
    const vivos = gasto.filter((s) => !s.hasta_mes);
    const ahorro0 = 1 - vivos.reduce((a, s) => a + ultimoPorcentaje(s), 0) - (fondo ? ultimoPorcentaje(fondo) : 0);
    const out = [];
    for (const s of vivos) {
      if ((s.desde_mes ? kDe(s.desde_mes) : 0) > k0) continue;
      const S = meses.reduce((a, k) => a + gastado(s, k), 0);
      if (!(S > 0)) continue;
      const actual = ultimoPorcentaje(s), real = S / I;
      const delta = Math.max(-0.02, Math.min(0.02, real - actual));
      const propuesto = Math.round((actual + delta) * 1000) / 1000;
      if (Math.abs(propuesto - actual) < 0.0049) continue;
      out.push({ sobre: s, actual, real, propuesto, media: S / 3, ahorro: ahorro0 - (propuesto - actual), ahorro0 });
    }
    return out;
  }
  /** Próximos cobros recurrentes en los 14 días siguientes a hoy (máx. 3). */
  function proximosCobros() {
    const h = hoy();
    const lim = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1, +h.slice(8, 10) + 14)).toISOString().slice(0, 10);
    return (libro.recurrentes || [])
      .filter((r) => r.activo && porId[r.sobre_id])
      .map((r) => ({ r, fecha: fechaRepeticion(r, r.siguiente) }))
      .filter((x) => x.fecha > h && x.fecha <= lim)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 3);
  }
  /** Avisos de Inicio, en el orden de Sobrea. */
  function avisos(k) {
    const av = [];
    for (const s of sobresDelMes(k)) {
      const x = gastado(s, k), y = presupuesto(s, k);
      if (x > y + EPS) av.push({ tipo: 'mal', icono: '!', texto: `${s.nombre}: te has pasado ${euros(x - y)}` });
      else if (y > 0 && x / y >= 0.8 && y - x >= 0.005) av.push({ tipo: 'atencion', icono: '!', texto: `${s.nombre}: llevas el ${Math.round((x / y) * 100)} % del presupuesto` });
    }
    const p = cierrePendiente();
    if (p) av.push({ tipo: 'info', icono: '↗', texto: `Decide cuánto aportas a ${p.g.o.titulo} (cierre de ${nombreMesK(p.k)})`, accion: { etiqueta: 'Decidir aportación', cierre: `${p.g.o.id}:${p.k}` } });
    const n = sugerencias().length;
    if (n) av.push({ tipo: 'info', icono: '%', texto: `${n} ${n === 1 ? 'sugerencia' : 'sugerencias'} de reajuste de porcentajes`, accion: { etiqueta: 'Revisar en Ajustes', pestana: 'configuracion' } });
    for (const { r, fecha } of proximosCobros()) {
      av.push({ tipo: 'info', icono: '↻', texto: `Próximo cobro: ${r.concepto}, ${euros(numero(r.importe))} el ${fecha.slice(8)}/${fecha.slice(5, 7)}` });
    }
    if (!av.length) av.push({ tipo: 'bien', icono: '✓', texto: 'Todo en orden este mes' });
    return av;
  }

  /**
   * Análisis del mes k frente a tu media (anData en Sobrea): compara con los meses
   * anteriores (hasta 6) que tienen gasto, sin Extraordinarios, por categoría y concepto.
   */
  function analisis(k) {
    const c = kHoy();
    if (k > c) return { no: 'futuro' };
    let meses = [];
    for (let j = Math.max(0, k - 6); j < k; j++) meses.push(j);
    const deGasto = new Set(gasto.map((s) => s.id));
    const filas = (j) => movimientosDelMesK(j).filter((r) => deGasto.has(r.sobre_id));
    const total = (j) => filas(j).reduce((a, r) => a + r.cuenta, 0);
    meses = meses.filter((j) => total(j) > EPS);
    if (meses.length < 2) return { no: 'pocos', n: meses.length };

    const esActual = k === c;
    const D = esActual ? +hoy().slice(8, 10) : null;
    const dim = diasMesK(k);
    const dia = (r) => +r.fecha.slice(8, 10);
    const hasta = (r) => D == null || dia(r) <= D;
    const A = {};
    const de = (s) => A[s] || (A[s] = { td: 0, fl: 0, n: 0, cur: 0, cn: {} });
    const deC = (o, cn) => o.cn[cn] || (o.cn[cn] = { td: 0, fl: 0, cur: 0 });
    for (const s of gasto) de(s.id).n = meses.filter((j) => activo(s, j)).length;

    const mediaAcum = new Array(dim + 1).fill(0);
    for (const j of meses) {
      const dj = diasMesK(j);
      const por = new Array(Math.max(dim, dj) + 2).fill(0);
      for (const r of filas(j)) {
        const o = de(r.sobre_id), cc = deC(o, r.concepto || '');
        o.fl += r.cuenta; cc.fl += r.cuenta;
        if (hasta(r)) { o.td += r.cuenta; cc.td += r.cuenta; }
        por[dia(r)] += r.cuenta;
      }
      let acum = 0;
      for (let d = 1; d <= dim; d++) {
        acum += por[d] || 0;
        if (d === dim) for (let x = dim + 1; x < por.length; x++) acum += por[x] || 0;
        mediaAcum[d] += acum;
      }
    }
    for (let d = 1; d <= dim; d++) mediaAcum[d] /= meses.length;

    const actuales = filas(k).filter(hasta);
    const acumActual = new Array(dim + 1).fill(0), porDia = new Array(dim + 2).fill(0);
    for (const r of actuales) {
      const o = de(r.sobre_id), cc = deC(o, r.concepto || '');
      o.cur += r.cuenta; cc.cur += r.cuenta;
      porDia[dia(r)] += r.cuenta;
    }
    const ultimo = D == null ? dim : Math.min(D, dim);
    let a2 = 0;
    for (let d = 1; d <= ultimo; d++) { a2 += porDia[d] || 0; acumActual[d] = a2; }

    const fiable = !esActual || D >= 7;
    const relevante = (dv, av) => fiable && Math.abs(dv) >= 15 && (av > 0 ? Math.abs(dv) / av >= 0.2 : true);
    const cats = [];
    let curT = 0, mediaT = 0, mediaCompletaT = 0, proyT = 0;
    for (const s of gasto) {
      const o = A[s.id];
      if (!o || (!o.n && !o.cur)) continue;
      const hist = o.n > 0, aT = hist ? o.td / o.n : 0, aF = hist ? o.fl / o.n : 0, dv = o.cur - aT;
      const pj = esActual ? o.cur + Math.max(0, aF - aT) : o.cur;
      const cn = Object.keys(o.cn).map((nombre) => {
        const x = o.cn[nombre], cT = hist ? x.td / o.n : 0, cF = hist ? x.fl / o.n : 0, d2 = x.cur - cT;
        return {
          nombre, cur: x.cur, media: cT, mediaCompleta: cF, dif: d2, pct: cT > 0 ? d2 / cT : null,
          nuevo: hist && cT === 0 && x.cur > 0, relevante: hist && relevante(d2, cT),
          proyeccion: esActual ? x.cur + Math.max(0, cF - cT) : x.cur,
        };
      }).filter((x) => x.cur > EPS || x.media > EPS).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
      cats.push({ sobre: s, hist, cur: o.cur, media: aT, mediaCompleta: aF, dif: dv, pct: aT > 0 ? dv / aT : null, relevante: hist && relevante(dv, aT), proyeccion: pj, cn });
      curT += o.cur;
      if (hist) { mediaT += aT; mediaCompletaT += aF; }
      proyT += pj;
    }
    cats.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));
    const curH = cats.filter((x) => x.hist).reduce((a, x) => a + x.cur, 0);
    const bud = sobresDelMes(k).reduce((a, s) => a + presupuesto(s, k), 0);
    return { esActual, D, dim, meses, cats, curT, curH, mediaT, mediaCompletaT, proyT, bud, mediaAcum, acumActual, ultimo, fiable };
  }
  const movimientosDelMesK = (k) => movimientosDelMes(movimientos, mesK(k));
  const diasMesK = (k) => { const m = mesK(k); return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); };

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
    kFinal, ventana, sugerencias, proximosCobros, avisos, analisis, movimientosDelMesK, ultimoPorcentaje,
    objetivos, objetivo, cuotaObjetivo, situacionObjetivo, cierrePendiente, disponibleObjetivos, nombreMesK,
  };
}
