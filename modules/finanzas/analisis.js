// Pestaña Análisis: igual que en Sobrea. Patrimonio total del último mes con datos
// (con su desglose) y la evolución de patrimonio y gasto.

import { escapar } from '../../core/ui/componentes.js';
import { euros, nombreMes } from './calculo.js';
import { leerLibro } from './motor.js';
import { cifraGrande } from './vista.js';
import { cabeceraEvolucion, pintarEvolucion, evolucion } from './evolucion.js';
import { activarRecorrido } from './graficos.js';

export async function montarAnalisis(contenedor) {
  contenedor.innerHTML = '<p class="suave">Cargando…</p>';
  const registro = new Map();
  activarRecorrido(contenedor, registro);
  let motor;
  const pintar = () => {
    const m = motor.kFinal(), p = motor.patrimonio(m);
    const Mes = nombreMes(motor.mesK(m)).replace(/^./, (c) => c.toUpperCase());
    contenedor.innerHTML = `
      <section class="cristal" aria-labelledby="t-pat-total">
        <h2 id="t-pat-total">Patrimonio total</h2>
        <p class="cifra-grande cifra">${cifraGrande(p.total)}</p>
        <p class="suave">Cuenta diaria + ahorro + inversiones · ${escapar(Mes)}</p>
        <div class="caja">
          <div class="fila"><span class="suave">Cuenta diaria</span><strong>${euros(p.cuenta)}</strong></div>
          <div class="fila"><span class="suave">Ahorro</span><strong>${euros(p.ahorro)}</strong></div>
          <div class="fila"><span class="suave">Inversiones</span><strong>${euros(p.inversion)}</strong></div>
        </div>
      </section>
      ${cabeceraEvolucion()}`;
    registro.clear();
    pintarEvolucion(contenedor.querySelector('.evolucion-graficos'), motor, registro);
  };
  const cargar = async () => {
    try {
      motor = await leerLibro();
      if (motor) pintar();
    } catch (e) {
      contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    }
  };
  contenedor.addEventListener('click', (e) => {
    const rango = e.target.closest('[data-rango]');
    if (!rango) return;
    evolucion.rango = Number(rango.dataset.rango);
    contenedor.querySelectorAll('[data-rango]').forEach((b) => b.setAttribute('aria-pressed', String(b === rango)));
    registro.clear();
    pintarEvolucion(contenedor.querySelector('.evolucion-graficos'), motor, registro);
  });
  const alAvisar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:finanzas', alAvisar);
    cargar();
  };
  addEventListener('orvia:finanzas', alAvisar);
  await cargar();
}
