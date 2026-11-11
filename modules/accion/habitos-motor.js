// Motor de hábitos: semanas, XP, niveles, rachas, comodines y logros.
// Todo se calcula a partir de los registros (nada de puntos guardados aparte), así que
// borrar o corregir un registro recalcula todo sin descuadres.
//
// Reglas:
// - Hábito semanal ("al menos N días"): dificultad × 10 XP por día hecho.
// - Hábito de cantidad (pasos): 1 XP por cada 1.000 de la semana.
// - Semana cumplida: +100 XP. Las rachas cuentan semanas seguidas cumplidas.
// - Comodín: 1 al mes; salva una semana no cumplida (cuenta para la racha, no da XP).
// - Nivel n a partir de 50·n·(n−1) XP: 100, 300, 600, 1.000, 1.500…

import { lunesDe, sumarDias, hoy as hoyTexto } from './fechas.js';

export const XP_SEMANA = 100;
export const umbral = (n) => 50 * n * (n - 1);
export function nivelDe(xp) {
  let n = 1;
  while (umbral(n + 1) <= xp) n++;
  return { nivel: n, xp, desde: umbral(n), hasta: umbral(n + 1), progreso: (xp - umbral(n)) / (umbral(n + 1) - umbral(n)) };
}

const esCantidad = (h) => h.frecuencia?.tipo === 'cantidad';
export const metaDe = (h) => (esCantidad(h) ? Number(h.frecuencia.meta) || 0 : Number(h.frecuencia?.veces) || 1);
const mesDe = (t) => t.slice(0, 7);

/**
 * @param {{habitos, registros, comodines}} datos
 * @param {string} [hoy]
 */
export function crearMotorHabitos({ habitos, registros, comodines }, hoy = hoyTexto()) {
  const lunesHoy = lunesDe(hoy);
  const regDe = {};
  for (const r of registros) (regDe[r.habito_id] ||= []).push(r);
  const comDe = {};
  for (const c of comodines) (comDe[c.habito_id] ||= new Set()).add(c.semana);
  const comodinesEsteMes = comodines.filter((c) => mesDe(String(c.creado || hoy)) === mesDe(hoy)).length;

  function semanasDe(h) {
    const inicio = lunesDe(h.desde || hoy);
    const regs = regDe[h.id] || [];
    const porSemana = {};
    for (const r of regs) {
      if (!r.hecho && !(Number(r.valor) > 0)) continue;
      const l = lunesDe(r.fecha);
      const s = (porSemana[l] ||= { dias: {}, total: 0 });
      const v = esCantidad(h) ? Number(r.valor) || 0 : 1;
      s.dias[r.fecha] = (s.dias[r.fecha] || 0) + v;
      s.total += v;
    }
    const meta = metaDe(h);
    const lista = [];
    const primero = [inicio, ...Object.keys(porSemana)].sort()[0];
    for (let l = primero; l <= lunesHoy; l = sumarDias(l, 7)) {
      const s = porSemana[l] || { dias: {}, total: 0 };
      const cumplida = meta > 0 && s.total >= meta;
      lista.push({
        lunes: l, dias: s.dias, total: s.total, meta, cumplida,
        comodin: !cumplida && !!comDe[h.id]?.has(l),
        xp: (esCantidad(h) ? Math.floor(s.total / 1000) : s.total * (h.dificultad || 2) * 10) + (cumplida ? XP_SEMANA : 0),
        actual: l === lunesHoy,
      });
    }
    return lista;
  }

  function resumen(h) {
    const semanas = semanasDe(h);
    const xp = semanas.reduce((a, s) => a + s.xp, 0);
    const vale = (s) => s.cumplida || s.comodin;
    // Racha: semanas seguidas hasta la última cerrada (la actual cuenta si ya está cumplida).
    let i = semanas.length - 1;
    if (i >= 0 && semanas[i].actual && !vale(semanas[i])) i--;
    let racha = 0;
    while (i >= 0 && vale(semanas[i])) { racha++; i--; }
    let mejor = 0, corrida = 0;
    for (const s of semanas) { corrida = vale(s) ? corrida + 1 : 0; mejor = Math.max(mejor, corrida); }
    const actual = semanas[semanas.length - 1] || { lunes: lunesHoy, dias: {}, total: 0, meta: metaDe(h), cumplida: false, xp: 0 };
    const pasada = semanas.length > 1 ? semanas[semanas.length - 2] : null;
    // Comodín disponible para la semana pasada si no se cumplió y salvarla mantiene una racha.
    const antesDePasada = semanas.length > 2 ? semanas[semanas.length - 3] : null;
    const puedeComodin = !!pasada && !vale(pasada) && comodinesEsteMes < 1 && !!antesDePasada && vale(antesDePasada);
    const total = semanas.reduce((a, s) => a + s.total, 0);
    const diasHechos = semanas.reduce((a, s) => a + Object.keys(s.dias).length, 0);
    const semanasCumplidas = semanas.filter((s) => s.cumplida).length;
    return { habito: h, semanas, actual, pasada, xp, racha, mejor, puedeComodin, total, diasHechos, semanasCumplidas, cantidad: esCantidad(h) };
  }

  const resumenes = habitos.map(resumen);
  const xpTotal = resumenes.reduce((a, r) => a + r.xp, 0);
  const porArea = {};
  for (const r of resumenes) {
    const a = r.habito.area_id || 'sin-area';
    porArea[a] = (porArea[a] || 0) + r.xp;
  }

  // Logros (se calculan; no se guardan).
  const sesiones = resumenes.filter((r) => !r.cantidad).reduce((a, r) => a + r.total, 0);
  const pasos = resumenes.filter((r) => r.cantidad).reduce((a, r) => a + r.total, 0);
  const mejorRacha = Math.max(0, ...resumenes.map((r) => r.mejor));
  const cumplidas = resumenes.reduce((a, r) => a + r.semanasCumplidas, 0);
  const general = nivelDe(xpTotal);
  const logros = [
    { id: 'primera', nombre: 'Primera semana cumplida', icono: 'check', ok: cumplidas >= 1 },
    { id: 'racha4', nombre: '4 semanas seguidas', icono: 'llama', ok: mejorRacha >= 4 },
    { id: 'racha8', nombre: '8 semanas seguidas', icono: 'llama', ok: mejorRacha >= 8 },
    { id: 'racha12', nombre: '12 semanas seguidas', icono: 'llama', ok: mejorRacha >= 12 },
    { id: 'ses25', nombre: '25 sesiones', icono: 'pesa', ok: sesiones >= 25 },
    { id: 'ses50', nombre: '50 sesiones', icono: 'pesa', ok: sesiones >= 50 },
    { id: 'ses100', nombre: '100 sesiones', icono: 'pesa', ok: sesiones >= 100 },
    { id: 'pasos100k', nombre: '100.000 pasos', icono: 'pasos', ok: pasos >= 100000 },
    { id: 'pasos500k', nombre: '500.000 pasos', icono: 'pasos', ok: pasos >= 500000 },
    { id: 'pasos1m', nombre: '1 millón de pasos', icono: 'pasos', ok: pasos >= 1000000 },
    { id: 'nivel5', nombre: 'Nivel 5', icono: 'estrella', ok: general.nivel >= 5 },
    { id: 'nivel10', nombre: 'Nivel 10', icono: 'estrella', ok: general.nivel >= 10 },
  ];

  return {
    hoy, lunesHoy, resumenes, xpTotal, general, porArea, logros,
    comodinesDisponibles: Math.max(0, 1 - comodinesEsteMes),
    porId: Object.fromEntries(resumenes.map((r) => [r.habito.id, r])),
  };
}
