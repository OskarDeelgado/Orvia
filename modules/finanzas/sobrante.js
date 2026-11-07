// Pestaña Sobrante: igual que en Sobrea.
// Sobrante acumulado (con su desglose y cómo ha ido cada sobre en el mes), objetivos,
// Fondo de emergencia y ahorro e inversión acumulado.

import { escapar } from '../../core/ui/componentes.js';
import { euros, nombreMes } from './calculo.js';
import { montarVista, cabeceraMes, cifraGrande, visto } from './vista.js';
import { htmlObjetivos, alClicObjetivos, alEnviarObjetivos } from './objetivos.js';

export function montarSobrante(contenedor) {
  contenedor.addEventListener('submit', (e) => alEnviarObjetivos(e, { motor: visto.motor }));
  return montarVista(contenedor, { pintar, alClic: alClicObjetivos });
}

function pintar(contenedor, motor, k) {
  const mes = motor.mesK(k);
  const Mes = nombreMes(mes, { anio: false }).replace(/^./, (c) => c.toUpperCase());
  const v = motor.sobrante(k);
  const m = motor.margen(k);
  const destinado = motor.aportadoHasta(k);
  const fondo = motor.fondoEn(k);
  const tope = Number(motor.libro.config.fondo_tope) || 0;
  const negativo = v < -0.004;

  contenedor.innerHTML = `
    ${cabeceraMes(motor, k)}
    <p class="suave contexto-mes">Acumulado hasta ${escapar(nombreMes(mes))}</p>

    <section class="cristal" aria-labelledby="t-sobrante">
      <h2 id="t-sobrante">Sobrante</h2>
      <p class="cifra-grande cifra${negativo ? ' negativa' : ''}">${cifraGrande(v)}</p>
      <p class="suave">Lo que no gastas de cada categoría se suma aquí; si te pasas en una, se resta. De aquí salen tus objetivos.${negativo ? ' <strong class="texto-peligro">Está en negativo: has gastado más de lo presupuestado.</strong>' : ''}</p>
      <div class="caja">
        <div class="fila"><span>Saldo inicial</span><span class="cifra-fila">${euros(Number(motor.libro.config.sobrante_inicial) || 0)}</span></div>
        <div class="fila"><span>${escapar(Mes)}: ${m >= 0 ? 'sobra' : 'te pasas'}</span><span class="cifra-fila">${euros(Math.abs(m))}</span></div>
        <div class="fila"><span>Destinado a objetivos</span><span class="cifra-fila">${euros(destinado)}</span></div>
      </div>
      <h3 class="subtitulo">Cómo ha ido ${escapar(nombreMes(mes, { anio: false }))} por categoría</h3>
      ${motor.sobresDelMes(k).map((s) => {
        const d = motor.presupuesto(s, k) - motor.gastado(s, k);
        return `<div class="fila"><span><span class="punto" style="--c:${s.color}"></span>${escapar(s.nombre)}</span><span class="cifra-fila${d < -0.004 ? ' texto-peligro' : ''}">${d >= 0 ? '+' : '−'}${euros(Math.abs(d))}</span></div>`;
      }).join('')}
    </section>

    ${htmlObjetivos(motor)}

    <section class="cristal" aria-labelledby="t-fondo">
      <h2 id="t-fondo">Fondo de emergencia</h2>
      <div class="fila fila-cifra"><span class="cifra-grande cifra">${cifraGrande(fondo.f)}</span><span class="suave">tope ${euros(tope)}</span></div>
      <div class="barra" role="progressbar" aria-valuenow="${Math.round(tope > 0 ? Math.min(100, (fondo.f / tope) * 100) : 0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Fondo de emergencia respecto a su tope"><i style="width:${tope > 0 ? Math.min(100, (fondo.f / tope) * 100) : 0}%"></i></div>
      <p class="suave">Este mes se le pasan ${euros(fondo.aporta)}</p>
    </section>

    <section class="cristal" aria-labelledby="t-acumulado">
      <h2 id="t-acumulado">Ahorro e inversión acumulado</h2>
      <p class="cifra-grande cifra">${cifraGrande(motor.ahorroEInversion(k))}</p>
      <p class="suave">Al fondo se le pasa lo menor entre su % y lo que le falta para el tope; el resto va a ahorro e inversión.</p>
    </section>`;
}
