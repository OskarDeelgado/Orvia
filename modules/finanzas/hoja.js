// Panel para apuntar o editar un gasto. Sube desde abajo en el móvil y es una
// ventana centrada en el ordenador. Lo abre el botón + desde cualquier pantalla.
// Cuando guarda algo, avisa con el evento 'orvia:finanzas' para que las listas se refresquen.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { leerCatalogo, sobresDelMes, guardarMovimiento, eliminarMovimiento, crearRecurrente } from './datos.js';
import { hoy, mesDe, sumarMeses, leerImporte, euros, nombreMes, frecuencia } from './calculo.js';

let abierta = null; // { cerrar }

export const avisarCambio = () => window.dispatchEvent(new CustomEvent('orvia:finanzas'));

/**
 * Abre el panel.
 * @param {object} [opciones]
 * @param {object} [opciones.movimiento]  movimiento a editar (sin él, es uno nuevo)
 * @param {string} [opciones.fecha]       fecha propuesta para uno nuevo (por defecto, hoy)
 */
export async function abrirHojaGasto({ movimiento = null, fecha = null } = {}) {
  abierta?.cerrar();
  const volverFoco = document.activeElement;

  const capa = document.createElement('div');
  capa.className = 'hoja-capa';
  capa.dataset.mundo = 'finanzas';
  capa.innerHTML = `
    <div class="hoja-fondo" data-cerrar></div>
    <section class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">
      <div class="hoja-asa" aria-hidden="true"></div>
      <header class="hoja-cabecera">
        <h2 id="hoja-titulo">${movimiento ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar">✕</button>
      </header>
      <div class="hoja-cuerpo"><p class="suave">Cargando…</p></div>
    </section>`;
  document.body.append(capa);
  document.body.classList.add('con-hoja');
  requestAnimationFrame(() => capa.classList.add('abierta'));

  const cerrar = () => {
    if (!capa.isConnected) return;
    capa.classList.remove('abierta');
    document.body.classList.remove('con-hoja');
    removeEventListener('keydown', alTecla);
    setTimeout(() => capa.remove(), 220);
    abierta = null;
    volverFoco?.focus?.({ preventScroll: true });
  };
  const alTecla = (e) => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', alTecla);
  capa.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  abierta = { cerrar };

  const cuerpo = capa.querySelector('.hoja-cuerpo');
  let catalogo;
  try {
    catalogo = await leerCatalogo();
  } catch (e) {
    cuerpo.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    return;
  }
  if (!catalogo) {
    cuerpo.innerHTML = `
      <p>Antes de apuntar gastos hay que poner en marcha Finanzas.</p>
      <div class="acciones"><a class="boton" href="#/finanzas" data-cerrar>Ir a Finanzas</a></div>`;
    return;
  }
  // Sin fecha propuesta: hoy o, si Finanzas aún no ha empezado, el día de inicio (como Sobrea).
  const inicio = catalogo.config.fecha_inicio;
  const porDefecto = hoy() < inicio ? inicio : hoy();
  pintarFormulario(cuerpo, catalogo, { movimiento, fecha: movimiento?.fecha || fecha || porDefecto, cerrar });
}

export function cerrarHojaGasto() {
  abierta?.cerrar();
}

function pintarFormulario(cuerpo, catalogo, { movimiento, fecha, cerrar }) {
  const editando = !!movimiento;
  const estado = {
    sobre: movimiento?.sobre_id || null,
    concepto: movimiento?.concepto || '',
    repartir: movimiento?.meses > 1,
    repetir: false,
  };

  cuerpo.innerHTML = `
    <form id="form-gasto" novalidate>
      <label class="oculto-visual" for="gasto-importe">Importe en euros</label>
      <div class="importe-grande">
        <input id="gasto-importe" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${movimiento ? Number(movimiento.importe).toFixed(2).replace('.', ',').replace(/,00$/, '') : ''}">
        <span aria-hidden="true">€</span>
      </div>

      <fieldset class="grupo">
        <legend>Sobre</legend>
        <div class="segmentos" id="gasto-sobres"></div>
      </fieldset>

      <fieldset class="grupo">
        <legend>Concepto</legend>
        <div class="chips-elegir" id="gasto-conceptos"></div>
      </fieldset>

      <div class="dos-campos">
        <div class="campo"><label for="gasto-fecha">Fecha</label><input id="gasto-fecha" type="date" value="${fecha}" required></div>
        <div class="campo"><label for="gasto-nota">Nota</label><input id="gasto-nota" maxlength="200" placeholder="Opcional" value="${escapar(movimiento?.nota || '')}"></div>
      </div>

      <div class="opciones-extra" id="gasto-extras">
        <button type="button" class="chip-alternar" id="alt-repartir" aria-pressed="${estado.repartir}">↻ Repartir en meses</button>
        ${editando ? '' : '<button type="button" class="chip-alternar" id="alt-repetir" aria-pressed="false">⟳ Repetir</button>'}
      </div>
      <div class="campo" id="bloque-repartir" ${estado.repartir ? '' : 'hidden'}>
        <label for="gasto-meses">Repartir en (meses)</label>
        <input id="gasto-meses" type="number" inputmode="numeric" min="2" max="60" step="1" value="${movimiento?.meses > 1 ? movimiento.meses : 12}">
        <span class="ayuda" id="ayuda-repartir"></span>
      </div>
      <div id="bloque-repetir" hidden>
        <div class="dos-campos">
          <div class="campo"><label for="gasto-cada">Cada</label><input id="gasto-cada" type="number" inputmode="numeric" min="1" max="365" step="1" value="1"></div>
          <div class="campo"><label for="gasto-unidad">Unidad</label>
            <select id="gasto-unidad"><option value="dia">días</option><option value="semana">semanas</option><option value="mes" selected>meses</option></select>
          </div>
        </div>
        <p class="ayuda" id="ayuda-repetir"></p>
      </div>
      ${movimiento?.recurrente_id ? '<p class="ayuda">Este gasto viene de un recurrente. Lo que cambies aquí solo afecta a este movimiento.</p>' : ''}

      <p class="error" id="gasto-error" role="alert" hidden></p>
      <button class="boton ancho" type="submit" id="gasto-guardar">${editando ? 'Guardar cambios' : 'Apuntar'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="gasto-eliminar">Eliminar movimiento</button>' : ''}
    </form>`;

  const $ = (sel) => cuerpo.querySelector(sel);
  const campoImporte = $('#gasto-importe');
  const campoFecha = $('#gasto-fecha');

  function pintarSobres() {
    const mes = mesDe(campoFecha.value || hoy());
    const lista = sobresDelMes(catalogo, mes);
    if (estado.sobre && !lista.some((s) => s.id === estado.sobre) && catalogo.porId[estado.sobre]) lista.push(catalogo.porId[estado.sobre]);
    if (!estado.sobre || !lista.some((s) => s.id === estado.sobre)) {
      estado.sobre = lista.find((s) => s.tipo === 'gasto')?.id || lista[0]?.id || null;
      estado.concepto = '';
    }
    $('#gasto-sobres').innerHTML = lista.map((s) => `
      <button type="button" class="segmento" data-sobre="${s.id}" aria-pressed="${s.id === estado.sobre}">
        <span class="punto" style="--c:${s.color}"></span>${s.tipo === 'ingreso' ? '＋ ' : ''}${escapar(s.nombre)}
      </button>`).join('');
    pintarConceptos();
    pintarExtras();
  }
  function pintarConceptos() {
    const conceptos = catalogo.conceptosDe(estado.sobre);
    if (estado.concepto && !conceptos.includes(estado.concepto)) conceptos.push(estado.concepto);
    $('#gasto-conceptos').innerHTML = conceptos.length
      ? conceptos.map((c) => `<button type="button" class="chip-opcion" data-concepto="${escapar(c)}" aria-pressed="${c === estado.concepto}">${escapar(c)}</button>`).join('')
      : '<span class="ayuda">Este sobre no tiene conceptos. Podrás añadirlos en los ajustes de Finanzas.</span>';
  }
  // Repartir y repetir solo tienen sentido en sobres de gasto (no en Extraordinarios ni en ingresos).
  function pintarExtras() {
    const esGasto = catalogo.porId[estado.sobre]?.tipo === 'gasto';
    $('#gasto-extras').hidden = !esGasto;
    if (!esGasto) {
      estado.repartir = false;
      estado.repetir = false;
    }
    $('#alt-repartir').setAttribute('aria-pressed', String(estado.repartir));
    $('#bloque-repartir').hidden = !estado.repartir;
    const altRepetir = $('#alt-repetir');
    if (altRepetir) altRepetir.setAttribute('aria-pressed', String(estado.repetir));
    $('#bloque-repetir').hidden = !estado.repetir;
    actualizarAyudas();
  }
  function actualizarAyudas() {
    const importe = leerImporte(campoImporte.value);
    const fechaTxt = campoFecha.value || hoy();
    if (estado.repartir) {
      const meses = Math.round(+$('#gasto-meses').value);
      $('#ayuda-repartir').textContent = importe > 0 && meses >= 2
        ? `${euros(importe / meses)} al mes de ${nombreMes(mesDe(fechaTxt))} a ${nombreMes(sumarMeses(mesDe(fechaTxt), meses - 1))}.`
        : 'Entre 2 y 60 meses.';
    }
    if (estado.repetir) {
      const rec = { cada: Math.max(1, Math.round(+$('#gasto-cada').value || 1)), unidad: $('#gasto-unidad').value };
      const inicio = catalogo.config.fecha_inicio;
      $('#ayuda-repetir').textContent = `Se apuntará solo ${frecuencia(rec)} desde el ${fechaTxt.split('-').reverse().join('/')}.`
        + (fechaTxt < inicio ? ` Las repeticiones empezarán a contar en ${nombreMes(inicio)}, cuando arranca Finanzas.` : '');
    }
  }

  pintarSobres();
  campoFecha.addEventListener('change', pintarSobres);
  campoImporte.addEventListener('input', actualizarAyudas);
  cuerpo.addEventListener('input', (e) => { if (['gasto-meses', 'gasto-cada', 'gasto-unidad'].includes(e.target.id)) actualizarAyudas(); });
  cuerpo.addEventListener('click', (e) => {
    const sobre = e.target.closest('[data-sobre]');
    if (sobre) {
      if (estado.sobre !== sobre.dataset.sobre) estado.concepto = '';
      estado.sobre = sobre.dataset.sobre;
      cuerpo.querySelectorAll('[data-sobre]').forEach((b) => b.setAttribute('aria-pressed', String(b === sobre)));
      pintarConceptos();
      pintarExtras();
      return;
    }
    const concepto = e.target.closest('[data-concepto]');
    if (concepto) {
      estado.concepto = estado.concepto === concepto.dataset.concepto ? '' : concepto.dataset.concepto;
      cuerpo.querySelectorAll('[data-concepto]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.concepto === estado.concepto)));
      return;
    }
    if (e.target.closest('#alt-repartir')) {
      estado.repartir = !estado.repartir;
      if (estado.repartir) estado.repetir = false;
      pintarExtras();
      return;
    }
    if (e.target.closest('#alt-repetir')) {
      estado.repetir = !estado.repetir;
      if (estado.repetir) estado.repartir = false;
      pintarExtras();
    }
  });
  setTimeout(() => campoImporte.focus(), 80);

  const error = $('#gasto-error');
  const mostrarError = (t) => { error.textContent = t; error.hidden = !t; };

  $('#form-gasto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const importe = leerImporte(campoImporte.value);
    if (!(importe > 0)) return mostrarError('Escribe un importe mayor que cero, por ejemplo 12,50.');
    if (importe > 1e7) return mostrarError('Ese importe es demasiado alto. Revísalo.');
    if (!estado.sobre) return mostrarError('Elige un sobre.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(campoFecha.value)) return mostrarError('Elige una fecha.');
    const meses = estado.repartir ? Math.round(+$('#gasto-meses').value) : 1;
    if (estado.repartir && !(meses >= 2 && meses <= 60)) return mostrarError('Para repartir, elige entre 2 y 60 meses.');
    mostrarError('');

    const datos = {
      fecha: campoFecha.value,
      sobre_id: estado.sobre,
      concepto: estado.concepto,
      importe,
      nota: $('#gasto-nota').value.trim(),
      meses,
    };
    const boton = $('#gasto-guardar');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      if (estado.repetir) {
        const cada = Math.round(+$('#gasto-cada').value);
        if (!(cada >= 1 && cada <= 365)) throw new Error('Elige cada cuánto se repite (entre 1 y 365).');
        await crearRecurrente({ ...datos, cada, unidad: $('#gasto-unidad').value, fecha_inicio: datos.fecha });
        aviso(`Gasto recurrente creado: ${euros(importe)} ${frecuencia({ cada, unidad: $('#gasto-unidad').value })}`);
      } else {
        await guardarMovimiento({ id: movimiento?.id, ...datos });
        const esIngreso = catalogo.porId[estado.sobre]?.tipo === 'ingreso';
        aviso(movimiento ? 'Cambios guardados' : `${esIngreso ? 'Ingreso' : 'Gasto'} apuntado: ${euros(importe)}`);
      }
      avisarCambio();
      cerrar();
    } catch (e) {
      mostrarError(e.message);
      boton.disabled = false;
      boton.textContent = editando ? 'Guardar cambios' : 'Apuntar';
    }
  });

  // Eliminar pide una segunda pulsación para confirmar.
  const botonEliminar = $('#gasto-eliminar');
  botonEliminar?.addEventListener('click', async () => {
    if (botonEliminar.dataset.confirmar !== '1') {
      botonEliminar.dataset.confirmar = '1';
      botonEliminar.textContent = 'Pulsa otra vez para eliminar';
      return;
    }
    botonEliminar.disabled = true;
    try {
      await eliminarMovimiento(movimiento.id);
      aviso(movimiento.meses > 1 ? 'Movimiento y sus cuotas eliminados' : 'Movimiento eliminado');
      avisarCambio();
      cerrar();
    } catch (e) {
      mostrarError(e.message);
      botonEliminar.disabled = false;
    }
  });
}
