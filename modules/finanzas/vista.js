// Lo que comparten las pestañas de Finanzas que van por meses (Mes, Sobrante y Ahorro),
// como en Sobrea: el mes que estás viendo es el mismo en todas, la cabecera con las
// flechas no deja ir antes del mes de inicio, y todo se recalcula al apuntar o borrar.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { leerLibro } from './motor.js';
import { nombreMes, hoy } from './calculo.js';

const ICONO_ANTERIOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICONO_SIGUIENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/** Mes visto (índice desde el inicio), último motor leído y la vista abierta. */
export const visto = { k: null, motor: null, vista: null };

/** Cambia el mes visto (por ejemplo, al apuntar algo en otro mes, como hace Sobrea). */
export function irAlMes(k) {
  visto.k = Math.max(0, k);
}

/** Fecha que propone Sobrea en el mes visto: hoy si es el actual; si no, el día 1. */
export function fechaDelMesVisto(motor = visto.motor, k = visto.k) {
  return k === motor.kHoy() ? hoy() : motor.mesK(k);
}

/** Fecha que propone el botón +: la del mes visto si hay una pestaña de Finanzas abierta. */
export function fechaPropuesta() {
  if (!visto.motor || visto.k == null || !visto.vista?.isConnected) return null;
  return fechaDelMesVisto();
}

/** Cifra grande con los céntimos pequeños, como en Sobrea. */
export function cifraGrande(v) {
  const c = Math.round(Math.abs(v) * 100);
  const entero = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = c % 100;
  return `${v < 0 && c > 0 ? '−' : ''}${entero}${resto ? `<span class="menor">,${String(resto).padStart(2, '0')}</span>` : ''}<span class="menor"> €</span>`;
}

/** Cabecera con el mes y las flechas. */
export function cabeceraMes(motor, k) {
  const titulo = nombreMes(motor.mesK(k)).replace(/^./, (c) => c.toUpperCase());
  return `
    <div class="selector-mes">
      <button class="boton-icono" type="button" data-paso="-1" aria-label="Mes anterior" ${k < 1 ? 'disabled' : ''}>${ICONO_ANTERIOR}</button>
      <h2 aria-live="polite">${escapar(titulo)}</h2>
      <button class="boton-icono" type="button" data-paso="1" aria-label="Mes siguiente">${ICONO_SIGUIENTE}</button>
    </div>`;
}

/**
 * Monta una pestaña por meses.
 * @param {HTMLElement} contenedor
 * @param {object} opciones
 * @param {(contenedor, motor, k) => void} opciones.pintar
 * @param {(evento, ctx) => any} [opciones.alClic]    ctx = { motor, k, repintar, recargar }
 * @param {(evento, ctx) => any} [opciones.alCambio]  cambios de campos (evento 'change')
 */
export async function montarVista(contenedor, { pintar, alClic, alCambio }) {
  contenedor.innerHTML = '<p class="suave">Cargando…</p>';
  let motor;
  try {
    motor = await leerLibro();
  } catch (e) {
    contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    return;
  }
  if (!motor) return;
  visto.motor = motor;
  visto.vista = contenedor;
  if (visto.k == null) visto.k = motor.kInicial();

  const repintar = () => pintar(contenedor, visto.motor, visto.k);
  const recargar = async () => {
    try {
      visto.motor = await leerLibro();
      repintar();
    } catch (err) {
      aviso(err.message, { error: true });
    }
  };
  const ctx = () => ({ motor: visto.motor, k: visto.k, repintar, recargar });

  repintar();

  contenedor.addEventListener('click', (e) => {
    const paso = e.target.closest('[data-paso]');
    if (paso) {
      irAlMes(visto.k + Number(paso.dataset.paso));
      repintar();
      return;
    }
    alClic?.(e, ctx());
  });
  if (alCambio) contenedor.addEventListener('change', (e) => alCambio(e, ctx()));

  // Al apuntar, editar o borrar desde cualquier sitio, se recalcula todo.
  const alAvisar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:finanzas', alAvisar);
    recargar();
  };
  addEventListener('orvia:finanzas', alAvisar);
}

/** Avisa a todas las pantallas de Finanzas de que algo ha cambiado. */
export const avisarCambio = () => dispatchEvent(new CustomEvent('orvia:finanzas'));
