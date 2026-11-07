// Gráficos de Finanzas (los mismos que Sobrea): evolución del patrimonio, gasto por mes
// por categoría y curva de gasto acumulado frente a tu media. SVG a mano, sin librerías.
// Cada gráfico se puede recorrer con el dedo, el ratón o las flechas del teclado, y
// tiene una tabla equivalente ("Ver como tabla").

import { escapar } from '../../core/ui/componentes.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Euros sin decimales: 1.234 € */
export const e0 = (x) => Math.round(x).toLocaleString('de-DE') + ' €';
/** Etiqueta corta de eje: 1,2K */
const fk = (v) => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1000) { const k = a / 1000; return s + (Math.abs(k - Math.round(k)) < 0.05 ? Math.round(k) : k.toFixed(1).replace('.', ',')) + 'K'; }
  return s + Math.round(a);
};
/** Marcas "bonitas" del eje vertical. */
function marcas(lo, hi, c) {
  if (hi - lo < 1e-9) hi = lo + 1;
  const raw = (hi - lo) / c, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const st = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const a = Math.floor(lo / st + 1e-9) * st, b = Math.ceil(hi / st - 1e-9) * st, t = [];
  for (let v = a; v <= b + st / 2; v += st) t.push(+v.toFixed(6));
  return t;
}
const topR = (x, y, w, h, r) => { r = Math.min(r, h / 2, w / 2); return `M${x} ${y + h}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h}Z`; };

/**
 * @param {object} meses  { etiquetaCorta(k), anio(k), nombre(k) } para el índice de mes k
 */
function etiquetasX(ks, X, y, actual, meses) {
  const n = ks.length, paso = n > 8 ? 2 : 1;
  return ks.map((k, i) => {
    if ((n - 1 - i) % paso) return '';
    const anio = meses.esEnero(k) || i === 0 ? `<tspan x="${X(i).toFixed(1)}" dy="11" class="g-anio">’${String(meses.anio(k)).slice(2)}</tspan>` : '';
    return `<text x="${X(i).toFixed(1)}" y="${y}" text-anchor="middle" class="g-eje${k === actual ? ' actual' : ''}">${meses.corto(k)}${anio}</text>`;
  }).join('');
}
const rejilla = (tk, Y, ml, W, mr) => tk.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g-linea"/><text x="${ml - 6}" y="${Y(v).toFixed(1)}" text-anchor="end" dominant-baseline="central" class="g-eje">${fk(v)}</text>`).join('');

/** Ayuda para nombrar meses a partir del índice k y el mes de inicio. */
export function nombresDeMeses(motor) {
  const m = (k) => motor.mesK(k);
  return {
    corto: (k) => MESES[+m(k).slice(5, 7) - 1].slice(0, 3),
    largo: (k) => `${MESES[+m(k).slice(5, 7) - 1]} ${m(k).slice(0, 4)}`,
    anio: (k) => +m(k).slice(0, 4),
    esEnero: (k) => m(k).slice(5, 7) === '01',
  };
}

/** Línea del patrimonio. Devuelve { svg, datos } para el recorrido. */
export function lineaPatrimonio(ks, totales, meses, { ejemplo = false } = {}) {
  const W = 340, H = 210, ml = 42, mr = 16, mt = 24, mb = 36, pw = W - ml - mr, ph = H - mt - mb, n = ks.length;
  const tk = marcas(Math.min(...totales), Math.max(...totales), 3), t0 = tk[0], t1 = tk[tk.length - 1];
  const X = (i) => ml + (n > 1 ? (pw * i) / (n - 1) : pw / 2), Y = (v) => mt + ph * (1 - (v - t0) / (t1 - t0 || 1));
  const d = totales.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const lx = X(n - 1), ly = Y(totales[n - 1]);
  const svg = `<svg viewBox="0 0 ${W} ${H}" ${ejemplo ? 'aria-hidden="true"' : 'role="img" aria-label="Gráfico de líneas del patrimonio por mes. Hay una tabla equivalente."'} class="${ejemplo ? 'g-ejemplo' : ''}">
    ${rejilla(tk, Y, ml, W, mr)}
    <path d="${d}L${X(n - 1).toFixed(1)} ${mt + ph}L${X(0).toFixed(1)} ${mt + ph}Z" class="g-area"/>
    <path d="${d}" class="g-trazo"/>
    ${etiquetasX(ks, X, H - mb + 16, ks[n - 1], meses)}
    <line class="g-cruz" y1="${mt}" y2="${mt + ph}" visibility="hidden"/>
    <circle class="g-punto g-cursor" r="4.5" visibility="hidden"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4.5" class="g-punto"/>
    <text x="${lx.toFixed(1)}" y="${(ly - 10).toFixed(1)}" text-anchor="end" class="g-dato">${e0(totales[n - 1])}</text>
    ${ejemplo ? '' : `<rect class="g-zona" x="${ml}" y="${mt - 6}" width="${pw}" height="${ph + 12}" fill="transparent" tabindex="0" aria-label="Recorre los meses con las flechas del teclado"/>`}
  </svg>`;
  return { svg, datos: { tipo: 'linea', n, ml, pw, W, yy: totales.map(Y) } };
}

/** Columnas apiladas del gasto por mes. segmentos[i] = [[color, nombre, valor], …] */
export function barrasGasto(ks, segmentos, totales, meses, { ejemplo = false } = {}) {
  const W = 340, H = 210, ml = 42, mr = 10, mt = 26, mb = 36, pw = W - ml - mr, ph = H - mt - mb, n = ks.length;
  const slot = pw / n, bw = Math.min(24, slot * 0.6), tk = marcas(0, Math.max(...totales, 1), 3), t1 = tk[tk.length - 1];
  const Y = (v) => mt + ph * (1 - v / t1), X = (i) => ml + slot * (i + 0.5);
  const cols = ks.map((k, i) => {
    let c = 0, out = '';
    const sg = segmentos[i];
    sg.forEach(([color, , v], j) => {
      const y1 = Y(c + v), y0 = Y(c);
      let h = y0 - y1 - (j > 0 ? 2 : 0);
      if (h < 1) h = 1;
      const fill = ejemplo ? 'var(--tinta-apagada)' : color, op = ejemplo ? [0.5, 0.32, 0.2][j % 3] : 1;
      const x = (X(i) - bw / 2).toFixed(1);
      out += j === sg.length - 1 && h >= 3
        ? `<path d="${topR(+x, +y1.toFixed(1), bw, h, 4)}" fill="${fill}" opacity="${op}"/>`
        : `<rect x="${x}" y="${y1.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" fill="${fill}" opacity="${op}"/>`;
      c += v;
    });
    const lab = !ejemplo && i === n - 1 && totales[i] > 0 ? `<text x="${X(i).toFixed(1)}" y="${(Y(totales[i]) - 7).toFixed(1)}" text-anchor="middle" class="g-dato">${e0(totales[i])}</text>` : '';
    return `<g class="g-col" data-i="${i}">${out}${lab}${ejemplo ? '' : `<rect class="g-zona" x="${(ml + slot * i).toFixed(1)}" y="${mt - 8}" width="${slot.toFixed(1)}" height="${ph + 8}" fill="transparent" tabindex="0" data-i="${i}" aria-label="${escapar(meses.largo(k))}: gasto ${e0(totales[i])}"/>`}</g>`;
  }).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" ${ejemplo ? 'aria-hidden="true"' : 'role="group" aria-label="Gráfico de columnas del gasto por mes. Hay una tabla equivalente."'}>
    ${rejilla(tk, Y, ml, W, mr)}${cols}
    <line x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}" class="g-linea"/>
    ${etiquetasX(ks, X, H - mb + 16, ks[n - 1], meses)}
  </svg>`;
  return { svg, datos: { tipo: 'barras', n, ml, pw, W, slot } };
}

/** Curva de gasto acumulado del mes frente a tu media (Análisis). */
export function curvaAnalisis(d) {
  const W = 340, H = 190, ml = 44, mr = 14, mt = 14, mb = 30, pw = W - ml - mr, ph = H - mt - mb, n = d.dim;
  const X = (i) => ml + (n > 1 ? (pw * (i - 1)) / (n - 1) : 0);
  const tk = marcas(0, Math.max(d.bud, d.mediaAcum[n], d.proyT, d.acumActual[d.ultimo], 1) * 1.04, 3), t1 = tk[tk.length - 1];
  const Y = (v) => mt + ph * (1 - v / t1);
  const camino = (arr, a, b) => { let o = ''; for (let i = a; i <= b; i++) o += (i === a ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(arr[i]).toFixed(1); return o; };
  const xs = [...new Set([1, 8, 15, 22, n])].filter((x) => x <= n && (x === n || n - x >= 3 || x === 1))
    .map((x) => `<text x="${X(x).toFixed(1)}" y="${H - mb + 16}" text-anchor="middle" class="g-eje">${x}</text>`).join('');
  const cur = d.acumActual[d.ultimo];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto acumulado del mes frente a tu media${d.esActual ? `. Llevas ${e0(cur)} al día ${d.D} y tu media a esa fecha es ${e0(d.mediaAcum[d.ultimo])}` : ''}. Hay una tabla equivalente.">
    ${rejilla(tk, Y, ml, W, mr)}
    ${d.bud > 0 ? `<line x1="${ml}" x2="${W - mr}" y1="${Y(d.bud).toFixed(1)}" y2="${Y(d.bud).toFixed(1)}" class="g-presupuesto"/>` : ''}
    <path d="${camino(d.mediaAcum, 1, n)}L${X(n).toFixed(1)} ${Y(0)}L${X(1).toFixed(1)} ${Y(0)}Z" class="g-area-media"/>
    <path d="${camino(d.mediaAcum, 1, n)}" class="g-media"/>
    ${d.esActual && d.ultimo < n ? `<path d="M${X(d.ultimo).toFixed(1)} ${Y(cur).toFixed(1)}L${X(n).toFixed(1)} ${Y(d.proyT).toFixed(1)}" class="g-proyeccion"/><circle cx="${X(n).toFixed(1)}" cy="${Y(d.proyT).toFixed(1)}" r="4" class="g-punto-hueco"/>` : ''}
    <path d="${camino(d.acumActual, 1, d.ultimo)}" class="g-trazo g-grueso"/>
    <circle cx="${X(d.ultimo).toFixed(1)}" cy="${Y(cur).toFixed(1)}" r="4.5" class="g-punto"/>
    ${xs}
  </svg>`;
}

/** Tabla equivalente a un gráfico (oculta hasta pulsar "Ver como tabla"). */
export function tablaEquivalente(cabecera, filas) {
  return `<div class="g-tabla" hidden><table><thead><tr>${cabecera.map((h) => `<th scope="col">${escapar(h)}</th>`).join('')}</tr></thead><tbody>${filas.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${escapar(c)}</td>` : `<th scope="row">${escapar(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/**
 * Activa el recorrido de los gráficos dentro de un contenedor.
 * @param {Map<string, object>} registro  id del gráfico → { datos, tooltip(i) => html }
 */
export function activarRecorrido(contenedor, registro) {
  const caja = (e) => e.target.closest?.('.g-caja');
  const info = (b) => registro.get(b.dataset.grafico);
  const indice = (b, x) => {
    const g = info(b), d = g.datos, r = b.querySelector('svg').getBoundingClientRect(), vx = ((x - r.left) / r.width) * d.W;
    return d.tipo === 'linea' ? Math.round((vx - d.ml) / (d.pw / Math.max(1, d.n - 1))) : Math.floor((vx - d.ml) / d.slot);
  };
  const mostrar = (b, i) => {
    const g = info(b);
    if (!g) return;
    const d = g.datos;
    i = Math.max(0, Math.min(d.n - 1, i));
    g.actual = i;
    const tp = b.querySelector('.g-tooltip');
    tp.innerHTML = g.tooltip(i);
    tp.hidden = false;
    let xv;
    if (d.tipo === 'linea') {
      xv = d.ml + (d.n > 1 ? (d.pw * i) / (d.n - 1) : d.pw / 2);
      const cruz = b.querySelector('.g-cruz'), cursor = b.querySelector('.g-cursor');
      cruz.setAttribute('x1', xv); cruz.setAttribute('x2', xv); cruz.setAttribute('visibility', 'visible');
      cursor.setAttribute('cx', xv); cursor.setAttribute('cy', d.yy[i]); cursor.setAttribute('visibility', 'visible');
    } else {
      xv = d.ml + d.slot * (i + 0.5);
      b.querySelectorAll('.g-col').forEach((c) => c.classList.toggle('activa', +c.dataset.i === i));
    }
    const bw = b.clientWidth, tw = tp.offsetWidth, x = (xv / d.W) * bw;
    tp.style.left = Math.max(0, Math.min(bw - tw, x - tw / 2)) + 'px';
  };
  const ocultar = (b) => {
    const tp = b.querySelector('.g-tooltip');
    if (tp) tp.hidden = true;
    b.querySelector('.g-cruz')?.setAttribute('visibility', 'hidden');
    b.querySelector('.g-cursor')?.setAttribute('visibility', 'hidden');
    b.querySelectorAll('.g-col.activa').forEach((c) => c.classList.remove('activa'));
  };
  const mover = (e) => { const b = caja(e); if (b && info(b)) mostrar(b, indice(b, e.clientX)); };
  contenedor.addEventListener('pointermove', mover);
  contenedor.addEventListener('pointerdown', mover);
  contenedor.addEventListener('pointerout', (e) => { const b = caja(e); if (b && !b.contains(e.relatedTarget)) ocultar(b); });
  contenedor.addEventListener('focusin', (e) => {
    const b = caja(e); if (!b || !info(b)) return;
    const i = e.target.dataset?.i;
    mostrar(b, i != null ? +i : info(b).datos.n - 1);
  });
  contenedor.addEventListener('focusout', (e) => { const b = caja(e); if (b) ocultar(b); });
  contenedor.addEventListener('keydown', (e) => {
    const b = caja(e); if (!b || !info(b) || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const g = info(b), c = (g.actual ?? g.datos.n - 1) + (e.key === 'ArrowLeft' ? -1 : 1);
    if (g.datos.tipo === 'linea') mostrar(b, c);
    else b.querySelectorAll('.g-zona')[Math.max(0, Math.min(g.datos.n - 1, c))]?.focus();
  });
  // "Ver como tabla" / "Ver como gráfico"
  contenedor.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ver-tabla]');
    if (!t) return;
    const tarjeta = t.closest('.g-tarjeta'), tabla = tarjeta.querySelector('.g-tabla'), graf = tarjeta.querySelector('.g-vista');
    const verTabla = tabla.hidden;
    tabla.hidden = !verTabla;
    graf.hidden = verTabla;
    t.textContent = verTabla ? 'Ver como gráfico' : 'Ver como tabla';
  });
}
