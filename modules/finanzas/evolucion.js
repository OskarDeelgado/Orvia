// Evolución (Inicio y Análisis, como en Sobrea): patrimonio a fin de cada mes y gasto
// por mes y categoría (con Extraordinarios), para los últimos 6 o 12 meses o todo.

import { escapar } from '../../core/ui/componentes.js';
import { lineaPatrimonio, barrasGasto, tablaEquivalente, nombresDeMeses, e0 } from './graficos.js';

const RANGOS = [[6, '6 meses'], [12, '12 meses'], [0, 'Todo']];
export const evolucion = { rango: 6 };

/** Selector de rango y hueco de los gráficos. */
export function cabeceraEvolucion({ titulo = true } = {}) {
  return `
    <div class="evolucion-cabecera">
      ${titulo ? '<h2 class="titulo-seccion">Evolución</h2>' : ''}
      <div class="segmentos rango" role="group" aria-label="Periodo de los gráficos">
        ${RANGOS.map(([v, l]) => `<button type="button" class="segmento" data-rango="${v}" aria-pressed="${evolucion.rango === v}">${l}</button>`).join('')}
      </div>
    </div>
    <div class="evolucion-graficos"></div>`;
}

/** Pinta los dos gráficos. Devuelve el registro para el recorrido. */
export function pintarEvolucion(caja, motor, registro) {
  const ks = motor.ventana(evolucion.rango);
  const meses = nombresDeMeses(motor);
  let h = '';

  // Patrimonio
  const filas = ks.map((k) => motor.patrimonio(k));
  if (ks.length < 2) {
    const ej = [0, 1, 2, 3, 4, 5].map((i) => motor.kFinal() + i);
    h += tarjeta('Patrimonio', 'Cuenta diaria + ahorro + inversiones, a fin de cada mes',
      `<div class="g-caja g-con-ejemplo"><span class="pildora">Ejemplo</span>${lineaPatrimonio(ej, [3200, 3650, 4100, 4480, 5000, 5520], meses, { ejemplo: true }).svg}</div>`,
      '<p class="suave">Así se verá tu evolución a medida que pasen los meses.</p>');
  } else {
    const g = lineaPatrimonio(ks, filas.map((x) => x.total), meses);
    registro.set('patrimonio', {
      datos: g.datos,
      tooltip: (i) => `<span class="suave">${escapar(meses.largo(ks[i]))}</span><strong>${e0(filas[i].total)}</strong>
        <span class="g-fila"><span>Cuenta diaria</span><span>${e0(filas[i].cuenta)}</span></span>
        <span class="g-fila"><span>Ahorro</span><span>${e0(filas[i].ahorro)}</span></span>
        <span class="g-fila"><span>Inversiones</span><span>${e0(filas[i].inversion)}</span></span>`,
    });
    h += tarjeta('Patrimonio', 'Cuenta diaria + ahorro + inversiones, a fin de cada mes',
      `<div class="g-vista"><div class="g-caja" data-grafico="patrimonio">${g.svg}<div class="g-tooltip" hidden></div></div></div>`,
      tablaEquivalente(['Mes', 'Cuenta diaria', 'Ahorro', 'Inversiones', 'Total'], ks.map((k, i) => [meses.largo(k), e0(filas[i].cuenta), e0(filas[i].ahorro), e0(filas[i].inversion), e0(filas[i].total)])) + botonTabla(),
      true);
  }

  // Gasto por mes
  const sobres = motor.gasto.concat(motor.fondo ? [motor.fondo] : []);
  const seg = ks.map((k) => sobres.filter((s) => motor.gastado(s, k) > 0.004).map((s) => [s.color, s.nombre, motor.gastado(s, k), s]));
  const tot = seg.map((r) => r.reduce((a, x) => a + x[2], 0));
  if (!tot.some((v) => v > 0)) {
    const ej = [0, 1, 2, 3, 4, 5].map((i) => motor.kFinal() + i);
    const muestra = [[620, 210, 90], [620, 340, 60], [620, 180], [620, 260, 120], [620, 300, 40], [620, 150, 80]].map((r) => r.map((v) => ['', '', v]));
    h += tarjeta('Gasto por mes', 'Por categoría, incluidos los extraordinarios',
      `<div class="g-caja g-con-ejemplo"><span class="pildora">Ejemplo</span>${barrasGasto(ej, muestra, [920, 1020, 800, 1000, 960, 850], meses, { ejemplo: true }).svg}</div>`,
      '<p class="suave">Así se verá tu gasto a medida que registres movimientos.</p>');
  } else {
    const usados = sobres.filter((s) => seg.some((r) => r.some((x) => x[3] === s)));
    const pres = ks.map((k) => motor.sobresDelMes(k).reduce((a, s) => a + motor.presupuesto(s, k), 0));
    const g = barrasGasto(ks, seg, tot, meses);
    registro.set('gasto', {
      datos: g.datos,
      tooltip: (i) => `<span class="suave">${escapar(meses.largo(ks[i]))}</span><strong>${e0(tot[i])}</strong>`
        + seg[i].map(([c, n, v]) => `<span class="g-fila"><span><i class="punto" style="--c:${c}"></i>${escapar(n)}</span><span>${e0(v)}</span></span>`).join('')
        + `<span class="g-fila"><span>Presupuesto del mes</span><span>${e0(pres[i])}</span></span>`,
    });
    h += tarjeta('Gasto por mes', 'Por categoría, incluidos los extraordinarios',
      `<div class="g-vista"><div class="g-caja" data-grafico="gasto">${g.svg}<div class="g-tooltip" hidden></div></div>
        <div class="g-leyenda">${usados.map((s) => `<span><i class="punto" style="--c:${s.color}"></i>${escapar(s.nombre)}</span>`).join('')}</div></div>`,
      tablaEquivalente(['Mes', ...usados.map((s) => s.nombre), 'Total'], ks.map((k, i) => [meses.largo(k), ...usados.map((s) => e0(motor.gastado(s, k))), e0(tot[i])])) + botonTabla(),
      true);
  }
  caja.innerHTML = h;
}

const botonTabla = () => '<button class="enlace-tabla" type="button" data-ver-tabla>Ver como tabla</button>';
function tarjeta(titulo, subtitulo, grafico, pie) {
  return `<section class="cristal g-tarjeta"><h2>${titulo}</h2><p class="suave">${subtitulo}</p>${grafico}${pie}</section>`;
}
