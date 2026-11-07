// Pestaña Mes: igual que en Sobrea.
// Te queda para gastar (con barra, marca del día y estado), sueldo, cuenta diaria y
// traspaso al ahorro, anillos de los sobres, Extraordinarios y los movimientos del mes.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { leerLibro } from './motor.js';
import { eliminarMovimiento } from './datos.js';
import { abrirHojaGasto } from './hoja.js';
import { movimientosDelMes, euros, nombreMes, etiquetaDia, hoy } from './calculo.js';

const ICONO_ANTERIOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICONO_SIGUIENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICONO_ESTADO = { bien: '✓', atencion: '⚠', mal: '▲' };

// Mes que se está viendo (índice desde el inicio) y la fecha de inicio, compartidos
// con el botón + para proponer la fecha como hace Sobrea.
let kVisto = null;
let motorActual = null;
let vistaActual = null;
let ultimoQueda = null;

/** Fecha que propone el botón +: hoy si se ve el mes actual; si no, el día 1 del mes visto. */
export function fechaPropuesta() {
  if (!motorActual || kVisto == null || !vistaActual?.isConnected) return null;
  return kVisto === motorActual.kHoy() ? hoy() : motorActual.mesK(kVisto);
}

/** Cifra grande con los céntimos pequeños, como en Sobrea. */
export function cifraGrande(v) {
  const c = Math.round(Math.abs(v) * 100);
  const entero = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = c % 100;
  return `${v < 0 && c > 0 ? '−' : ''}${entero}${resto ? `<span class="menor">,${String(resto).padStart(2, '0')}</span>` : ''}<span class="menor"> €</span>`;
}

export async function montarMes(contenedor) {
  contenedor.innerHTML = '<p class="suave">Cargando el mes…</p>';
  let motor;
  try {
    motor = await leerLibro();
  } catch (e) {
    contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    return;
  }
  if (!motor) return;
  motorActual = motor;
  vistaActual = contenedor;
  if (kVisto == null) kVisto = motor.kInicial();

  pintar(contenedor, motor);

  contenedor.onclick = async (e) => {
    const paso = e.target.closest('[data-paso]');
    if (paso) {
      kVisto = Math.max(0, kVisto + Number(paso.dataset.paso));
      pintar(contenedor, motor);
      return;
    }
    const borrar = e.target.closest('[data-borrar]');
    if (borrar) {
      const mov = motor.libro.movimientos.find((m) => m.id === borrar.dataset.borrar);
      borrar.disabled = true;
      try {
        await eliminarMovimiento(mov.id);
        aviso(mov.meses > 1 ? 'Movimiento y sus cuotas eliminados' : 'Movimiento eliminado');
        dispatchEvent(new CustomEvent('orvia:finanzas'));
      } catch (err) {
        aviso(err.message, { error: true });
        borrar.disabled = false;
      }
      return;
    }
    const fila = e.target.closest('[data-mov]');
    if (fila) {
      const mov = motor.libro.movimientos.find((m) => m.id === fila.dataset.mov);
      if (mov) abrirHojaGasto({ movimiento: mov });
    }
  };

  // Al apuntar, editar o borrar desde cualquier sitio, se recalcula todo.
  const alCambiar = async () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:finanzas', alCambiar);
    try {
      motor = await leerLibro();
      motorActual = motor;
      pintar(contenedor, motor);
    } catch (err) {
      aviso(err.message, { error: true });
    }
  };
  addEventListener('orvia:finanzas', alCambiar);
}

function pintar(contenedor, motor) {
  const r = motor.resumenMes(kVisto);
  const titulo = nombreMes(r.mes).replace(/^./, (c) => c.toUpperCase());
  const negativo = r.queda < -0.004;
  const pct = Math.round(r.fraccionGastada * 100);

  contenedor.innerHTML = `
    <div class="selector-mes">
      <button class="boton-icono" type="button" data-paso="-1" aria-label="Mes anterior" ${kVisto < 1 ? 'disabled' : ''}>${ICONO_ANTERIOR}</button>
      <h2 aria-live="polite">${escapar(titulo)}</h2>
      <button class="boton-icono" type="button" data-paso="1" aria-label="Mes siguiente">${ICONO_SIGUIENTE}</button>
    </div>

    <section class="cristal heroe-mes estado-${r.estado.tipo}" aria-labelledby="t-queda">
      <h2 id="t-queda" class="heroe-titulo">Te queda para gastar en ${escapar(nombreMes(r.mes, { anio: false }))}</h2>
      <p class="heroe-cifra cifra${negativo ? ' negativa' : ''}" id="cifra-queda">${cifraGrande(r.queda)}</p>
      <div class="barra-mes" role="img" aria-label="${pct} % del presupuesto del mes gastado">
        <i class="relleno" style="width:${Math.min(100, r.fraccionGastada * 100)}%"></i>
        ${r.avanceMes != null ? `<i class="marca-dia" style="left:${r.avanceMes * 100}%"></i>` : ''}
      </div>
      <p class="heroe-estado"><span aria-hidden="true">${ICONO_ESTADO[r.estado.tipo]}</span> ${escapar(r.estado.texto)}</p>
      <p class="heroe-pie">de ${euros(r.total)}${r.ingresosExtra ? ` (incluye ${euros(r.ingresosExtra)} de ingresos extra)` : ''}${r.esActual ? ` · día ${r.dia} de ${r.diasMes}` : ''}</p>
    </section>

    <section class="cristal tres-datos" aria-label="Sueldo, cuenta diaria y traspaso al ahorro">
      <div><span class="etiqueta">Sueldo</span><span class="cifra">${cifraGrande(r.sueldo)}</span></div>
      <div><span class="etiqueta">Cuenta diaria</span><span class="cifra">${cifraGrande(r.cuentaDiaria)}</span></div>
      <div><span class="etiqueta">A ahorro</span><span class="cifra">${cifraGrande(r.aAhorro)}</span></div>
    </section>

    <section class="cristal" aria-labelledby="t-sobres">
      <h2 id="t-sobres">Sobres</h2>
      <div class="anillos">${r.sobres.map(anillo).join('')}</div>
      <div class="fila"><strong>Extraordinarios</strong><span class="suave">${euros(r.extraordinarios)} · sale del fondo</span></div>
    </section>

    <section class="seccion-movs" aria-labelledby="t-movs">
      <h2 id="t-movs" class="titulo-seccion">Movimientos del mes</h2>
      ${listaMovimientos(motor, r)}
    </section>`;

  animarCifra(contenedor.querySelector('#cifra-queda'), r.queda);
}

/** Anillo de un sobre con sus estados: quedan, casi al límite, agotado o te has pasado. */
function anillo({ sobre, gastado, presupuesto }) {
  const o = presupuesto > 0 ? gastado / presupuesto : gastado > 0 ? 1 : 0;
  const relleno = Math.min(1, o) * 100;
  const pct = Math.round(o * 100);
  const pasado = gastado > presupuesto + 0.004;
  const agotado = !pasado && presupuesto > 0 && presupuesto - gastado < 0.005;
  const casi = !pasado && !agotado && presupuesto > 0 && o >= 0.8;
  const estado = pasado ? `<span class="anillo-estado mal">▲ Te has pasado ${euros(gastado - presupuesto)}</span>`
    : agotado ? '<span class="anillo-estado atencion">Agotado</span>'
    : casi ? '<span class="anillo-estado atencion">⚠ Casi al límite</span>' : '';
  return `
    <div class="anillo" style="--c:${sobre.color}">
      <svg viewBox="0 0 100 100" role="img" aria-label="${escapar(sobre.nombre)}: ${pct} % del presupuesto gastado">
        <circle cx="50" cy="50" r="40" class="anillo-pista"/>
        ${relleno > 0 ? `<circle cx="50" cy="50" r="40" class="anillo-avance" pathLength="100" stroke-dasharray="${relleno} 100" stroke-linecap="${relleno >= 99.9 ? 'butt' : 'round'}" transform="rotate(-90 50 50)"/>` : ''}
        ${pasado ? '<circle cx="50" cy="50" r="47.5" class="anillo-exceso"/>' : ''}
        <text x="50" y="50" text-anchor="middle" dominant-baseline="central">${pct} %</text>
      </svg>
      <strong class="anillo-nombre">${escapar(sobre.nombre)}</strong>
      ${pasado || agotado ? '' : `<span class="suave anillo-quedan">Quedan ${euros(presupuesto - gastado)}</span>`}
      ${estado}
    </div>`;
}

/** Movimientos del mes por día, con el total de cada día (como Sobrea). */
function listaMovimientos(motor, r) {
  const movs = movimientosDelMes(motor.libro.movimientos, r.mes);
  if (!movs.length) {
    return `<div class="cristal vacio"><p><strong>Aún no hay movimientos en ${escapar(nombreMes(r.mes, { anio: false }))}</strong></p><p class="suave">Pulsa el botón + para añadir tu primer gasto o ingreso.</p></div>`;
  }
  const esIngreso = (m) => motor.porId[m.sobre_id]?.tipo === 'ingreso';
  const grupos = new Map();
  for (const m of movs) {
    const dia = m.fechaEnMes || m.fecha;
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(m);
  }
  return [...grupos].map(([dia, lista]) => {
    const gastos = lista.filter((m) => !esIngreso(m)).reduce((a, m) => a + m.cuenta, 0);
    const ingresos = lista.filter(esIngreso).reduce((a, m) => a + m.cuenta, 0);
    return `
      <div class="dia">
        <h3 class="dia-titulo"><span>${escapar(etiquetaDia(dia))}</span><span class="cifra-fila">${gastos > 0 ? euros(gastos) : '+' + euros(ingresos)}</span></h3>
        <ul class="cristal lista-movs">${lista.map((m) => filaMovimiento(m, motor, esIngreso(m))).join('')}</ul>
      </div>`;
  }).join('');
}

function filaMovimiento(m, motor, ingreso) {
  const sobre = motor.porId[m.sobre_id] || { nombre: '(eliminada)', color: '#6b7280' };
  const detalle = [sobre.nombre];
  if (m.meses > 1) detalle.push(`↻ ${m.cuota}/${m.meses} de ${euros(m.importe)}`);
  if (m.recurrente_id) detalle.push('recurrente');
  const cuotaPosterior = m.meses > 1 && m.cuota > 1; // en Sobrea, solo se borra desde su primer mes
  return `
    <li class="mov-fila">
      <button class="mov" type="button" data-mov="${m.id}" aria-label="${escapar(`${m.concepto || sobre.nombre}, ${euros(m.cuenta)}. Editar`)}">
        <span class="punto" style="--c:${sobre.color}"></span>
        <span class="mov-texto">
          <span class="mov-concepto">${escapar(m.concepto || sobre.nombre)}${m.nota ? ' <span class="mov-nota" title="' + escapar(m.nota) + '">· ' + escapar(m.nota) + '</span>' : ''}</span>
          <span class="mov-detalle">${escapar(detalle.join(' · '))}</span>
        </span>
        <span class="mov-importe cifra-fila${ingreso ? ' ingreso' : ''}">${ingreso ? '+' : ''}${euros(m.cuenta)}</span>
      </button>
      ${cuotaPosterior ? '<span class="mov-hueco"></span>' : `<button class="mov-borrar" type="button" data-borrar="${m.id}" aria-label="Eliminar ${escapar(m.concepto || sobre.nombre)}">✕</button>`}
    </li>`;
}

/** La cifra de "te queda" cuenta hasta su nuevo valor, como en Sobrea. */
function animarCifra(el, hasta) {
  const desde = ultimoQueda;
  ultimoQueda = hasta;
  if (!el || desde == null || Math.abs(desde - hasta) < 0.005 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now(), dur = 600;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    if (!el.isConnected) return;
    el.innerHTML = cifraGrande(desde + (hasta - desde) * e);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
