// Objetivos de ahorro, como en Sobrea: salen del Sobrante.
// - Tarjeta de Objetivos (pestaña Sobrante): crear, aportar, editar, deshacer aportaciones y eliminar.
// - Cierre de mes: al abrir Finanzas, por cada mes terminado sin revisar, pregunta cuánto
//   destinas del Sobrante (con la cuota sugerida), o permite dejarlo para luego u omitir el mes.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { euros, leerImporte } from './calculo.js';
import { leerLibro } from './motor.js';
import { crearObjetivo, actualizarObjetivo, eliminarObjetivo, aportar, deshacerAportacion, marcarRevisado } from './datos.js';
import { abrirHojaBase, hayHojaAbierta } from './hojabase.js';
import { avisarCambio } from './vista.js';

// Estado de la tarjeta (como gop, gfo y gdq en Sobrea).
const ui = { abierto: null, nuevo: false, borrar: null };
// "Ahora no" en el cierre de mes: no vuelve a preguntar hasta la próxima vez que abras Orvia.
let pospuesto = false;

const r2 = (x) => Math.round(x * 100) / 100;
const mesInput = (motor, k) => motor.mesK(k).slice(0, 7);
const kDeInput = (motor, v) => (/^\d{4}-\d{2}$/.test(v || '') ? motor.kDe(v + '-01') : NaN);
const importeTexto = (v) => String(r2(v)).replace('.', ',');

// ---------- Tarjeta de Objetivos ----------

export function htmlObjetivos(motor) {
  const k0 = Math.max(0, motor.kHoy());
  const lista = motor.objetivos.map((o) => tarjeta(motor, motor.objetivo(o))).join('');
  const formulario = ui.nuevo ? `
    <form class="caja objetivo-nuevo" data-form="nuevo" novalidate>
      <strong>Nuevo objetivo</strong>
      <div class="campo"><label for="obj-nombre">Nombre</label><input id="obj-nombre" maxlength="30" placeholder="Viaje" autocomplete="off"></div>
      <div class="campo"><label for="obj-meta">Meta (€)</label><input id="obj-meta" inputmode="decimal" placeholder="3000" autocomplete="off"></div>
      <div class="dos-campos">
        <div class="campo"><label for="obj-desde">Desde</label><input id="obj-desde" type="month" value="${mesInput(motor, k0)}"></div>
        <div class="campo"><label for="obj-hasta">Hasta</label><input id="obj-hasta" type="month" value="${mesInput(motor, k0 + 6)}"></div>
      </div>
      <div class="dos-botones">
        <button class="boton" type="submit">Crear objetivo</button>
        <button class="boton secundario" type="button" data-obj-nuevo="0">Cancelar</button>
      </div>
    </form>` : '<button class="boton secundario ancho" type="button" data-obj-nuevo="1">+ Nuevo objetivo</button>';
  return `
    <section class="cristal" aria-labelledby="t-objetivos">
      <h2 id="t-objetivos">Objetivos</h2>
      ${lista || '<p class="suave">Fija una meta (por ejemplo, 3.000 € para un viaje) y Orvia te dice cuánto destinar cada mes, a partir de tu Sobrante.</p>'}
      ${formulario}
    </section>`;
}

function tarjeta(motor, g) {
  const { o } = g;
  const pct = Math.min(100, g.meta > 0 ? (g.aportado / g.meta) * 100 : 0);
  const abierto = ui.abierto === o.id;
  const aportaciones = motor.libro.aportaciones.filter((a) => a.objetivo_id === o.id)
    .sort((a, b) => b.mes.localeCompare(a.mes));
  const detalle = abierto ? `
    <form class="objetivo-detalle" data-form="editar" data-objetivo="${o.id}" novalidate>
      <div class="campo"><label for="ed-nombre-${o.id}">Nombre</label><input id="ed-nombre-${o.id}" maxlength="30" value="${escapar(o.titulo)}"></div>
      <div class="dos-campos">
        <div class="campo"><label for="ed-meta-${o.id}">Meta (€)</label><input id="ed-meta-${o.id}" inputmode="decimal" value="${importeTexto(g.meta)}"></div>
        <div class="campo"><label for="ed-hasta-${o.id}">Hasta</label><input id="ed-hasta-${o.id}" type="month" value="${mesInput(motor, g.m1)}"></div>
      </div>
      <button class="boton ancho" type="submit">Guardar cambios</button>
      ${aportaciones.length ? `
        <h3 class="subtitulo">Aportaciones</h3>
        <ul class="lista-simple">${aportaciones.map((a) => `
          <li class="fila">
            <span><strong>Sobrante</strong><span class="suave"> · ${escapar(motor.nombreMesK(motor.kDe(a.mes)))}</span></span>
            <span class="fila-fin"><span class="cifra-fila">${euros(Number(a.importe))}</span><button class="mov-borrar" type="button" data-deshacer="${a.id}" aria-label="Deshacer aportación de ${euros(Number(a.importe))}">✕</button></span>
          </li>`).join('')}</ul>` : ''}
      <button class="boton peligro ancho" type="button" data-obj-borrar="${o.id}">${ui.borrar === o.id ? 'Pulsa otra vez: el dinero vuelve al Sobrante' : 'Eliminar objetivo'}</button>
    </form>` : '';
  return `
    <div class="caja objetivo">
      <div class="fila"><strong>${escapar(o.titulo)}</strong><span class="suave">${escapar(motor.situacionObjetivo(g))}</span></div>
      <div class="barra" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de ${escapar(o.titulo)}"><i style="width:${pct}%"></i></div>
      <p class="suave">Aportado ${euros(g.aportado)} de ${euros(g.meta)}${g.conseguido ? '' : ` · faltan ${euros(g.meta - g.aportado)}`}</p>
      <p class="suave">${escapar(motor.nombreMesK(g.m0))} a ${escapar(motor.nombreMesK(g.m1))}${g.conseguido ? '' : ` · cuota sugerida ${euros(motor.cuotaObjetivo(g, g.hueco))} al mes`}</p>
      <div class="dos-botones">
        <button class="boton secundario" type="button" data-aportar="${o.id}">Aportar</button>
        <button class="boton secundario" type="button" data-detalles="${o.id}" aria-expanded="${abierto}">${abierto ? 'Cerrar' : 'Detalles'}</button>
      </div>
      ${detalle}
    </div>`;
}

/** Clics de la tarjeta. Devuelve true si el clic era suyo. */
export async function alClicObjetivos(e, { motor, repintar }) {
  const t = e.target.closest('[data-obj-nuevo],[data-aportar],[data-detalles],[data-deshacer],[data-obj-borrar]');
  if (!t) return false;
  const d = t.dataset;
  if (d.objNuevo != null) {
    ui.nuevo = d.objNuevo === '1';
    repintar();
    if (ui.nuevo) document.getElementById('obj-nombre')?.focus();
  } else if (d.aportar) {
    abrirAportacion(motor, d.aportar, Math.max(0, motor.kHoy()), true);
  } else if (d.detalles) {
    ui.abierto = ui.abierto === d.detalles ? null : d.detalles;
    ui.borrar = null;
    repintar();
  } else if (d.deshacer) {
    t.disabled = true;
    await intentar(() => deshacerAportacion(d.deshacer), 'Aportación deshecha: el dinero vuelve al Sobrante');
  } else if (d.objBorrar) {
    if (ui.borrar !== d.objBorrar) {
      const id = d.objBorrar;
      ui.borrar = id;
      repintar();
      setTimeout(() => { if (ui.borrar === id) { ui.borrar = null; repintar(); } }, 4000);
    } else {
      ui.borrar = null;
      ui.abierto = null;
      await intentar(() => eliminarObjetivo(d.objBorrar), 'Objetivo eliminado');
    }
  }
  return true;
}

/** Formularios de la tarjeta (crear y editar). */
export async function alEnviarObjetivos(e, { motor }) {
  const form = e.target.closest('[data-form]');
  if (!form) return false;
  e.preventDefault();
  const $ = (id) => document.getElementById(id);
  if (form.dataset.form === 'nuevo') {
    const titulo = $('obj-nombre').value.trim();
    const meta = r2(leerImporte($('obj-meta').value));
    const m0 = kDeInput(motor, $('obj-desde').value), m1 = kDeInput(motor, $('obj-hasta').value);
    if (!titulo || !(meta > 0)) return aviso('Indica un nombre y una meta', { error: true });
    if (!(m0 >= 0) || !(m1 >= m0)) return aviso(`Revisa las fechas: desde ${motor.nombreMesK(0).toLowerCase()} y hasta un mes igual o posterior`, { error: true });
    ui.nuevo = false;
    await intentar(() => crearObjetivo({ titulo, meta, desde: motor.mesK(m0), hasta: motor.mesK(m1) }), 'Objetivo creado');
  } else {
    const id = form.dataset.objetivo;
    const g = motor.objetivo(motor.objetivos.find((o) => o.id === id));
    const titulo = $('ed-nombre-' + id).value.trim();
    const meta = r2(leerImporte($('ed-meta-' + id).value));
    const m1 = kDeInput(motor, $('ed-hasta-' + id).value);
    if (!titulo || !(meta > 0) || !(m1 >= g.m0)) return aviso('Revisa nombre, meta y fecha final', { error: true });
    if (meta < g.aportado - 0.004) return aviso(`La meta no puede ser menor que lo ya aportado (${euros(g.aportado)})`, { error: true });
    await intentar(() => actualizarObjetivo(id, { titulo, meta, hasta: motor.mesK(m1) }), 'Cambios guardados');
  }
  return true;
}

async function intentar(accion, mensaje) {
  try {
    await accion();
    aviso(mensaje);
    avisarCambio();
  } catch (err) {
    aviso(err.message, { error: true });
    avisarCambio();
  }
}

// ---------- Aportar (a mano o en el cierre de mes) ----------

/**
 * @param {boolean} manual  true: botón Aportar; false: cierre de un mes terminado.
 */
export function abrirAportacion(motor, objetivoId, k, manual) {
  const o = motor.objetivos.find((x) => x.id === objetivoId);
  if (!o) return;
  const g = motor.objetivo(o);
  const cuota = r2(motor.cuotaObjetivo(g, Math.min(k, g.m1)));
  const { hay, sobro } = motor.disponibleObjetivos(k);
  const nombreMes = motor.nombreMesK(k);

  const { cuerpo, cerrar } = abrirHojaBase(manual ? `Aportar a ${o.titulo}` : `Cierre de ${nombreMes}: ${o.titulo}`, {
    alCerrar: (motivo) => { if (!manual && motivo === 'cerrar') pospuesto = true; },
  });

  cuerpo.innerHTML = `
    <p class="suave">Llevas ${euros(g.aportado)} de ${euros(g.meta)}${manual ? '.' : `. Cuota sugerida para ${escapar(nombreMes)}: <strong class="tinta">${euros(cuota)}</strong>. Indica cuánto destinas del Sobrante.`}</p>
    ${hay > 0.004 ? `
      <form id="form-aportar" novalidate>
        <div class="caja fila-aportar">
          <label for="aportar-importe"><strong>Sobrante</strong><span class="suave">${manual ? '' : `Sobró en ${escapar(nombreMes.split(' ')[0])}: ${euros(sobro)} · `}Disponible: ${euros(hay)}</span></label>
          <span class="importe-pequeno"><input id="aportar-importe" inputmode="decimal" placeholder="0,00" autocomplete="off"><span aria-hidden="true">€</span></span>
        </div>
        <p class="suave" id="aportar-total" aria-live="polite"></p>
        <button class="boton secundario ancho" type="button" id="aportar-rellenar">Rellenar con la cuota sugerida</button>
        <button class="boton ancho" type="submit" id="aportar-guardar">Guardar aportación</button>
      </form>` : '<p class="suave">No hay Sobrante disponible para aportar ahora mismo.</p>'}
    ${manual ? '' : `
      <div class="dos-botones">
        <button class="boton secundario" type="button" id="cierre-luego">Ahora no</button>
        <button class="boton secundario" type="button" id="cierre-omitir">Omitir este mes</button>
      </div>`}`;

  const campo = cuerpo.querySelector('#aportar-importe');
  const valor = () => Math.max(0, r2(leerImporte(campo?.value || '') || 0));
  const total = () => {
    const el = cuerpo.querySelector('#aportar-total');
    if (!el) return;
    const t = valor();
    el.innerHTML = `Destinas <strong class="tinta">${euros(t)}</strong>` + (t > g.falta + 0.004
      ? ` <span class="texto-peligro">· supera lo que falta (${euros(g.falta)})</span>`
      : ` · te faltarían ${euros(Math.max(0, g.falta - t))}`);
  };
  total();
  campo?.addEventListener('input', total);
  setTimeout(() => campo?.focus({ preventScroll: true }), 80);

  cuerpo.querySelector('#aportar-rellenar')?.addEventListener('click', () => {
    const v = Math.min(cuota, hay);
    campo.value = v > 0 ? importeTexto(v) : '';
    total();
  });

  cuerpo.querySelector('#form-aportar')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = valor();
    if (t > hay + 0.004) return aviso('Esa cantidad supera lo que hay en el Sobrante', { error: true });
    if (t > g.falta + 0.004) return aviso('Eso supera lo que falta para el objetivo', { error: true });
    const boton = cuerpo.querySelector('#aportar-guardar');
    boton.disabled = true;
    try {
      if (t > 0) await aportar({ objetivo_id: o.id, mes: motor.mesK(k), importe: t });
      if (!manual) await marcarRevisado(o.id, motor.mesK(k));
      const conseguido = g.aportado + t >= g.meta - 0.005;
      aviso(t > 0 ? `${conseguido ? '¡Objetivo conseguido! ' : 'Aportado '}${euros(t)} a ${o.titulo}` : 'Mes anotado sin aportación');
      cerrar('guardado');
      avisarCambio();
      if (!manual) setTimeout(revisarCierres, 350);
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });

  cuerpo.querySelector('#cierre-luego')?.addEventListener('click', () => { pospuesto = true; cerrar('luego'); });
  cuerpo.querySelector('#cierre-omitir')?.addEventListener('click', async () => {
    try {
      await marcarRevisado(o.id, motor.mesK(k));
      cerrar('omitido');
      avisarCambio();
      setTimeout(revisarCierres, 350);
    } catch (err) {
      aviso(err.message, { error: true });
    }
  });
}

/** Si hay algún mes terminado sin cerrar en un objetivo, abre su cierre (como Sobrea al abrir). */
export async function revisarCierres() {
  if (pospuesto || hayHojaAbierta()) return;
  try {
    const motor = await leerLibro();
    const p = motor?.cierrePendiente();
    if (p && !hayHojaAbierta()) abrirAportacion(motor, p.g.o.id, p.k, false);
  } catch {
    // Si no se puede leer, ya avisará la pestaña.
  }
}

