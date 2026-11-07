// Tarjeta "Análisis de {mes} frente a tu media" (Inicio), igual que en Sobrea:
// resumen, curva de gasto acumulado, proyección, lo más destacado y el detalle por
// categoría y concepto, con tabla equivalente.

import { escapar } from '../../core/ui/componentes.js';
import { euros, nombreMes } from './calculo.js';
import { curvaAnalisis, tablaEquivalente, e0, nombresDeMeses } from './graficos.js';

export const abiertas = new Set(); // categorías desplegadas

const valoracion = (dv, pc, rel, nuevo) => (nuevo
  ? `<span class="an-v ${rel ? 'sube' : 'igual'}">${rel ? '▲ ' : ''}Sin histórico</span>`
  : rel
    ? `<span class="an-v ${dv > 0 ? 'sube' : 'baja'}">${dv > 0 ? '▲' : '▼'} ${euros(Math.abs(dv))}${pc != null ? ' · ' + (dv > 0 ? '+' : '−') + Math.round(Math.abs(pc) * 100) + ' %' : ''}</span>`
    : '<span class="an-v igual">≈ En línea</span>');

function barra(cur, media, color, rel, dv) {
  const mx = Math.max(cur, media, 1) * 1.12;
  return `<div class="an-barra" aria-hidden="true"><i class="an-c${rel && dv > 0 ? ' alto' : ''}" style="width:${Math.min(100, (cur / mx) * 100).toFixed(1)}%;background:${color}"></i>${media > 0 ? `<i class="an-m" style="left:${((media / mx) * 100).toFixed(1)}%"></i>` : ''}</div>`;
}

export function htmlComparativa(motor, k) {
  const d = motor.analisis(k);
  const mes = nombreMes(motor.mesK(k), { anio: false });
  const cab = `<h2>Análisis de ${escapar(mes)} frente a tu media</h2>`;
  if (d.no === 'futuro') return cab + '<p class="suave">Solo se analizan el mes en curso y los meses pasados.</p>';
  if (d.no === 'pocos') {
    const ej = [['Ocio', '+64 € · +32 %', 'sube', 78, 60, '#199e70'], ['Compras', '▼ 40 € · −21 %', 'baja', 46, 58, '#eb6834'], ['Gastos fijos', '≈ En línea', 'igual', 64, 62, '#3987e5']];
    return cab + `<p class="suave">Para comparar necesito al menos 2 meses cerrados con gastos. ${d.n ? `Ahora tengo ${d.n}.` : 'Aún no hay ninguno.'} Así se verá cuando los haya:</p>
      <div class="an-ejemplo"><span class="pildora">Ejemplo</span>${ej.map((r) => `<div class="an-fila"><div class="an-cab"><strong>${r[0]}</strong><span class="an-v ${r[2]}">${r[1]}</span></div><div class="an-barra"><i class="an-c" style="width:${r[3]}%;background:${r[5]}"></i><i class="an-m" style="left:${r[4]}%"></i></div></div>`).join('')}</div>`;
  }

  const dv = d.curH - d.mediaT, pc = d.mediaT > 0 ? dv / d.mediaT : 0;
  const relT = d.fiable && Math.abs(dv) >= 15 && Math.abs(pc) >= 0.05, sube = dv > 0;
  const meses = nombresDeMeses(motor);
  const nombres = d.meses.map((j) => meses.corto(j)).join(', ');
  const titulo = !d.fiable ? 'Aún hay pocos días para valorar'
    : relT ? (d.esActual ? `Vas un ${Math.round(Math.abs(pc) * 100)} % por ${sube ? 'encima' : 'debajo'} de tu media` : `Gastaste un ${Math.round(Math.abs(pc) * 100)} % ${sube ? 'más' : 'menos'} que tu media`)
      : (d.esActual ? 'Vas en línea con tu media' : 'Gastaste lo habitual');
  const icono = !d.fiable ? '…' : relT ? (sube ? '▲' : '▼') : '≈';
  const tono = !d.fiable ? 'info' : relT ? (sube ? 'mal' : 'bien') : 'bien';
  const sub = d.esActual
    ? `${euros(d.curH)} gastados hasta el día ${d.D}; a esta fecha sueles llevar ${euros(d.mediaT)}.${d.fiable ? '' : ' Con menos de 7 días del mes la comparación aún no es fiable.'}`
    : `${euros(d.curH)} frente a ${euros(d.mediaT)} de media.`;
  const cifras = d.esActual
    ? `<div class="fila"><span class="suave">Proyección a fin de mes</span><strong>${euros(d.proyT)}</strong></div><div class="fila"><span class="suave">Media de un mes completo</span><strong>${euros(d.mediaCompletaT)}</strong></div>${d.bud > 0 ? `<div class="fila"><span class="suave">Presupuesto</span><strong class="${d.proyT > d.bud + 0.004 ? 'texto-peligro' : ''}">${euros(d.bud)}</strong></div>` : ''}`
    : `<div class="fila"><span class="suave">Media de un mes completo</span><strong>${euros(d.mediaCompletaT)}</strong></div>${d.bud > 0 ? `<div class="fila"><span class="suave">Presupuesto</span><strong>${euros(d.bud)}</strong></div>` : ''}`;

  const destacados = [];
  if (d.fiable) for (const c of d.cats) {
    if (c.relevante) destacados.push({ t: c.sobre.nombre, dv: c.dif });
    for (const x of c.cn) if (x.relevante) destacados.push({ t: `${c.sobre.nombre} › ${x.nombre || 'Sin concepto'}`, dv: x.dif });
  }
  const arriba = destacados.filter((x) => x.dv > 0).sort((a, b) => b.dv - a.dv).slice(0, 3);
  const abajo = destacados.filter((x) => x.dv < 0).sort((a, b) => a.dv - b.dv).slice(0, 2);
  const htmlDestacados = arriba.length || abajo.length ? `
    <div class="an-destacado"><strong>Lo más destacado</strong>
      ${arriba.map((x) => `<div class="aviso-fila"><i class="aviso-mal" aria-hidden="true">▲</i><div>${escapar(x.t)}: <strong>${euros(x.dv)}</strong> por encima de tu media</div></div>`).join('')}
      ${abajo.map((x) => `<div class="aviso-fila"><i class="aviso-bien" aria-hidden="true">▼</i><div>${escapar(x.t)}: <strong>${euros(-x.dv)}</strong> por debajo de tu media</div></div>`).join('')}
    </div>` : '';

  const filas = d.cats.map((c) => {
    const col = c.sobre.color, abierta = abiertas.has(c.sobre.id), nc = c.cn.length;
    return `<button class="an-fila" type="button" data-categoria="${c.sobre.id}" aria-expanded="${abierta}">
        <span class="an-cab"><strong><span class="punto" style="--c:${col}"></span>${escapar(c.sobre.nombre)}</strong>${valoracion(c.dif, c.pct, c.relevante, !c.hist)}</span>
        ${barra(c.cur, c.media, col, c.relevante, c.dif)}
        <span class="an-pie"><span>${euros(c.cur)}${c.hist ? ' · media ' + (d.esActual ? 'a hoy ' : '') + euros(c.media) : ''}</span><span>${nc} ${nc === 1 ? 'concepto' : 'conceptos'} ${abierta ? '▴' : '▾'}</span></span>
      </button>
      ${abierta ? `<div class="an-conceptos">${c.cn.map((x) => `
        <div class="an-fila">
          <div class="an-cab"><span>${escapar(x.nombre || 'Sin concepto')}</span>${valoracion(x.dif, x.pct, x.relevante || (x.nuevo && d.fiable && x.cur >= 15), x.nuevo)}</div>
          ${barra(x.cur, x.media, col, x.relevante, x.dif)}
          <div class="an-pie"><span>${euros(x.cur)}${x.media > 0 ? ' · media ' + (d.esActual ? 'a hoy ' : '') + euros(x.media) : ''}</span>${d.esActual && x.proyeccion > x.cur + 0.004 ? `<span>cierre previsto ${euros(x.proyeccion)}</span>` : ''}</div>
        </div>`).join('')}
        ${d.esActual && c.hist ? `<div class="an-pie"><span>Proyección de ${escapar(c.sobre.nombre)}: ${euros(c.proyeccion)}</span><span>media del mes ${euros(c.mediaCompleta)}</span></div>` : ''}
      </div>` : ''}`;
  }).join('');

  const tabla = tablaEquivalente(
    ['Categoría', 'Este mes', 'Media' + (d.esActual ? ' a hoy' : ''), 'Diferencia'].concat(d.esActual ? ['Proyección'] : []),
    d.cats.map((c) => [c.sobre.nombre, e0(c.cur), c.hist ? e0(c.media) : '—', c.hist ? (c.dif >= 0 ? '+' : '−') + e0(Math.abs(c.dif)) : '—'].concat(d.esActual ? [e0(c.proyeccion)] : [])),
  );

  return cab + `
    <p class="suave">Comparado con tu media de los últimos ${d.meses.length} meses con datos (${escapar(nombres)}). Sin extraordinarios; avisa si la diferencia supera el 20 % y 15 €.</p>
    <div class="g-vista an-cuerpo">
      <div>
        <div class="an-resumen"><i class="an-icono aviso-${tono}" aria-hidden="true">${icono}</i><div><strong>${escapar(titulo)}</strong><p class="suave">${escapar(sub)}</p></div></div>
        <div class="g-caja">${curvaAnalisis(d)}</div>
        <div class="g-leyenda">
          <span><i class="g-l g-l-mes"></i>Este mes</span>
          ${d.esActual && d.ultimo < d.dim ? '<span><i class="g-l g-l-proy"></i>Proyección</span>' : ''}
          <span><i class="g-l g-l-media"></i>Tu media</span>
          ${d.bud > 0 ? '<span><i class="g-l g-l-pres"></i>Presupuesto</span>' : ''}
        </div>
        <div class="an-cifras">${cifras}</div>
        ${htmlDestacados}
      </div>
      <div>
        <p class="an-titulo-cat"><strong>Por categoría</strong> <span class="suave">· la marca vertical es tu media${d.esActual ? ' a esta fecha' : ''}</span></p>
        ${filas}
      </div>
    </div>
    ${tabla}
    <button class="enlace-tabla" type="button" data-ver-tabla>Ver como tabla</button>`;
}
