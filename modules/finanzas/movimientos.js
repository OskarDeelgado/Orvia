// Pestaña Movimientos: los gastos de un mes, agrupados por día.
// Tocar uno lo abre para editarlo o eliminarlo.

import { escapar } from '../../core/ui/componentes.js';
import { leerCatalogo, leerMovimientos } from './datos.js';
import { abrirHojaGasto } from './hoja.js';
import { movimientosDelMes, sumarMeses, euros, nombreMes, etiquetaDia, hoy, mesDe } from './calculo.js';

const ICONO_ANTERIOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICONO_SIGUIENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

let mesVisto = null; // se recuerda mientras la app esté abierta

export async function montarMovimientos(contenedor) {
  mesVisto ||= mesDe(hoy());
  contenedor.innerHTML = `
    <div class="selector-mes">
      <button class="boton-icono" type="button" id="mes-anterior" aria-label="Mes anterior">${ICONO_ANTERIOR}</button>
      <h2 id="mes-titulo" aria-live="polite"></h2>
      <button class="boton-icono" type="button" id="mes-siguiente" aria-label="Mes siguiente">${ICONO_SIGUIENTE}</button>
    </div>
    <div id="lista-movimientos"><p class="suave">Cargando movimientos…</p></div>`;

  const lista = contenedor.querySelector('#lista-movimientos');
  let catalogo = null;
  let porId = {};

  async function pintar() {
    contenedor.querySelector('#mes-titulo').textContent = nombreMes(mesVisto).replace(/^./, (c) => c.toUpperCase());
    try {
      [catalogo] = await Promise.all([catalogo || leerCatalogo()]);
      const todos = await leerMovimientos(mesVisto);
      const delMes = movimientosDelMes(todos, mesVisto);
      porId = Object.fromEntries(todos.map((m) => [m.id, m]));
      lista.innerHTML = delMes.length ? listaHtml(delMes, catalogo) : vacioHtml();
    } catch (e) {
      lista.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    }
  }

  contenedor.querySelector('#mes-anterior').addEventListener('click', () => { mesVisto = sumarMeses(mesVisto, -1); pintar(); });
  contenedor.querySelector('#mes-siguiente').addEventListener('click', () => { mesVisto = sumarMeses(mesVisto, 1); pintar(); });
  lista.addEventListener('click', (e) => {
    const fila = e.target.closest('[data-mov]');
    if (fila && porId[fila.dataset.mov]) abrirHojaGasto({ movimiento: porId[fila.dataset.mov] });
    if (e.target.closest('#apuntar-primero')) {
      const esActual = mesVisto === mesDe(hoy());
      abrirHojaGasto({ fecha: esActual ? hoy() : mesVisto });
    }
  });

  // Se refresca cuando se apunta, edita o elimina un gasto desde cualquier sitio.
  const alCambiar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:finanzas', alCambiar);
    pintar();
  };
  addEventListener('orvia:finanzas', alCambiar);
  await pintar();
}

function vacioHtml() {
  return `
    <section class="cristal vacio">
      <p>No hay gastos en ${escapar(nombreMes(mesVisto))}.</p>
      <div class="acciones"><button class="boton" type="button" id="apuntar-primero">Apuntar un gasto</button></div>
    </section>`;
}

function listaHtml(movimientos, catalogo) {
  const total = movimientos.reduce((a, m) => a + m.cuenta, 0);
  const grupos = new Map();
  for (const m of movimientos) {
    const dia = m.fechaEnMes || m.fecha;
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(m);
  }
  return `
    <p class="total-mes"><span class="suave">Gastado en ${escapar(nombreMes(mesVisto, { anio: false }))}</span><span class="cifra-fila">${euros(total)}</span></p>
    ${[...grupos].map(([dia, movs]) => `
      <section class="dia" aria-label="${escapar(etiquetaDia(dia))}">
        <h3 class="dia-titulo">${escapar(etiquetaDia(dia))}</h3>
        <ul class="cristal lista-movs">
          ${movs.map((m) => filaHtml(m, catalogo)).join('')}
        </ul>
      </section>`).join('')}`;
}

function filaHtml(m, catalogo) {
  const sobre = catalogo.porId[m.sobre_id] || { nombre: 'Sobre eliminado', color: '#6b7280' };
  const marcas = [];
  if (m.cuota) marcas.push(`cuota ${m.cuota} de ${m.meses} · ${euros(m.importe)} en total`);
  if (m.recurrente_id) marcas.push('recurrente');
  if (m.nota) marcas.push(m.nota);
  return `
    <li>
      <button class="mov" type="button" data-mov="${m.id}" aria-label="${escapar(`${m.concepto || sobre.nombre}, ${euros(m.cuenta)}. Editar`)}">
        <span class="punto" style="--c:${sobre.color}"></span>
        <span class="mov-texto">
          <span class="mov-concepto">${escapar(m.concepto || sobre.nombre)}</span>
          <span class="mov-detalle">${escapar([sobre.nombre, ...marcas].join(' · '))}</span>
        </span>
        <span class="mov-importe cifra-fila">−${euros(m.cuenta)}</span>
      </button>
    </li>`;
}
