// Pestaña Ahorro: igual que en Sobrea.
// Cuenta de ahorro (con el fondo dentro), inversiones con su valor actual y rentabilidad,
// patrimonio total y los movimientos de invertir o retirar del mes.

import { aviso } from '../../core/ui/componentes.js';
import { euros, leerImporte, mesDe } from './calculo.js';
import { montarVista, cabeceraMes, cifraGrande, fechaDelMesVisto, irAlMes, avisarCambio, visto } from './vista.js';
import { guardarInversion, eliminarInversion, guardarValorCartera } from './datos.js';

let signo = 1;             // Invertir (1) o Retirar (-1), como el selector de Sobrea
const abiertos = new Set(); // movimientos de inversión con la edición abierta

const r2 = (x) => Math.round(x * 100) / 100;
const textoImporte = (v) => String(r2(v)).replace('.', ',');

export function montarAhorro(contenedor) {
  contenedor.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'form-inversion') registrar(e.target);
    else if (e.target.dataset.editarInv) guardarEdicion(e.target);
  });
  return montarVista(contenedor, { pintar, alClic, alCambio });
}

function pintar(contenedor, motor, k) {
  const ahorro = motor.ahorroCuenta(k);
  const fondo = motor.fondoEn(k).f;
  const invertido = motor.invertido(k);
  const indicado = Number(motor.libro.config.inversion_valor) || 0;
  const conValor = indicado > 0 && k === motor.kInicial();
  const valor = conValor ? indicado : invertido;
  const ganancia = valor - invertido;
  const patrimonio = motor.saldo(k) + ahorro + valor;
  const mes = motor.mesK(k);
  const lista = motor.libro.inversiones.filter((r) => mesDe(r.fecha) === mes).sort((a, b) => b.fecha.localeCompare(a.fecha));

  contenedor.innerHTML = `
    ${cabeceraMes(motor, k)}

    <section class="cristal" aria-labelledby="t-cuenta-ahorro">
      <h2 id="t-cuenta-ahorro">Cuenta de ahorro</h2>
      <p class="cifra-grande cifra">${cifraGrande(ahorro)}</p>
      <p class="suave">Incluye el fondo de emergencia (${euros(fondo)}); libre: ${euros(ahorro - fondo)}</p>
      <p class="suave">Este mes entran ${euros(motor.traspaso(k))} desde tu cuenta diaria</p>
    </section>

    <section class="cristal" aria-labelledby="t-inversiones">
      <h2 id="t-inversiones">Inversiones</h2>
      <div class="fila fila-cifra">
        <div><span class="etiqueta">Invertido</span><span class="cifra-grande cifra">${cifraGrande(invertido)}</span></div>
        <div class="derecha"><span class="etiqueta">Valor actual</span><span class="cifra-grande cifra">${cifraGrande(valor)}</span></div>
      </div>
      <p class="${conValor ? (ganancia < 0 ? 'texto-peligro' : 'texto-exito') : 'suave'}">${conValor
        ? `${ganancia >= 0 ? '+' : '−'}${euros(Math.abs(ganancia))}${invertido > 0 ? ` (${(ganancia / invertido * 100).toFixed(1).replace('.', ',')} %)` : ''}`
        : 'Indica el valor actual (mes en curso) para ver la rentabilidad'}</p>
      <div class="campo">
        <label for="valor-cartera">Valor actual de la cartera (€)</label>
        <input id="valor-cartera" inputmode="decimal" autocomplete="off" value="${indicado ? textoImporte(indicado) : ''}" placeholder="0">
      </div>
    </section>

    <p class="suave patrimonio-linea">Patrimonio total: <strong class="tinta">${euros(patrimonio)}</strong> · evolución en Análisis</p>

    <section class="cristal" aria-labelledby="t-mover">
      <h2 id="t-mover">Mover dinero a inversiones</h2>
      <form id="form-inversion" novalidate>
        <div class="segmentos" role="group" aria-label="Tipo de movimiento">
          <button type="button" class="segmento" data-signo="1" aria-pressed="${signo > 0}">Invertir</button>
          <button type="button" class="segmento" data-signo="-1" aria-pressed="${signo < 0}">Retirar</button>
        </div>
        <div class="dos-campos">
          <div class="campo"><label for="inv-importe">Importe (€)</label><input id="inv-importe" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>
          <div class="campo"><label for="inv-fecha">Fecha</label><input id="inv-fecha" type="date" value="${fechaDelMesVisto(motor, k)}"></div>
        </div>
        <button class="boton ancho" type="submit">Registrar</button>
      </form>
      ${lista.length ? `<ul class="lista-movs lista-inversiones">${lista.map(filaInversion).join('')}</ul>`
        : '<div class="vacio"><p><strong>Sin movimientos de inversión</strong></p><p class="suave">Aquí verás lo que inviertas o retires este mes.</p></div>'}
    </section>`;
}

function filaInversion(r) {
  const importe = Number(r.importe);
  const fecha = `${r.fecha.slice(8)}/${r.fecha.slice(5, 7)}`;
  const editar = abiertos.has(r.id) ? `
    <form class="edicion-inversion" data-editar-inv="${r.id}" novalidate>
      <div class="dos-campos">
        <div class="campo"><label for="ei-tipo-${r.id}">Tipo</label>
          <select id="ei-tipo-${r.id}"><option value="1"${importe > 0 ? ' selected' : ''}>Invertido</option><option value="-1"${importe < 0 ? ' selected' : ''}>Retirado</option></select>
        </div>
        <div class="campo"><label for="ei-importe-${r.id}">Importe (€)</label><input id="ei-importe-${r.id}" inputmode="decimal" value="${textoImporte(Math.abs(importe))}"></div>
      </div>
      <div class="campo"><label for="ei-fecha-${r.id}">Fecha</label><input id="ei-fecha-${r.id}" type="date" value="${r.fecha}"></div>
      <button class="boton ancho" type="submit">Guardar cambios</button>
    </form>` : '';
  return `
    <li>
      <div class="mov-fila">
        <button class="mov" type="button" data-inv="${r.id}" aria-expanded="${abiertos.has(r.id)}">
          <span class="mov-texto"><span class="mov-concepto">${importe > 0 ? 'Invertido' : 'Retirado'}</span><span class="mov-detalle">${fecha}</span></span>
          <span class="mov-importe cifra-fila">${euros(Math.abs(importe))}</span>
        </button>
        <button class="mov-borrar" type="button" data-borrar-inv="${r.id}" aria-label="Eliminar este movimiento de inversión">✕</button>
      </div>
      ${editar}
    </li>`;
}

async function alClic(e, { repintar }) {
  const s = e.target.closest('[data-signo]');
  if (s) {
    signo = Number(s.dataset.signo);
    e.currentTarget.querySelectorAll('[data-signo]').forEach((b) => b.setAttribute('aria-pressed', String(b === s)));
    return;
  }
  const borrar = e.target.closest('[data-borrar-inv]');
  if (borrar) {
    borrar.disabled = true;
    try {
      await eliminarInversion(borrar.dataset.borrarInv);
      aviso('Movimiento eliminado');
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
      borrar.disabled = false;
    }
    return;
  }
  const fila = e.target.closest('[data-inv]');
  if (fila) {
    const id = fila.dataset.inv;
    if (abiertos.has(id)) abiertos.delete(id); else abiertos.add(id);
    repintar();
  }
}

async function alCambio(e) {
  if (e.target.id !== 'valor-cartera') return;
  const texto = e.target.value.trim();
  const valor = texto ? leerImporte(texto) : 0;
  if (!(valor >= 0)) return aviso('Escribe un importe válido, por ejemplo 1.620', { error: true });
  try {
    await guardarValorCartera(r2(valor));
    avisarCambio();
  } catch (err) {
    aviso(err.message, { error: true });
  }
}

async function registrar(form) {
  const motor = visto.motor;
  const importe = r2(leerImporte(form.querySelector('#inv-importe').value));
  const fecha = form.querySelector('#inv-fecha').value;
  if (!(importe > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return aviso('Indica importe y fecha', { error: true });
  const k = motor.kDe(fecha);
  if (k < 0) return aviso(`Finanzas empieza en ${motor.nombreMesK(0).toLowerCase()}`, { error: true });
  try {
    await guardarInversion({ fecha, importe: signo * importe });
    irAlMes(k);
    aviso(`${signo > 0 ? 'Invertido' : 'Retirado'}: ${euros(importe)}`);
    avisarCambio();
  } catch (err) {
    aviso(err.message, { error: true });
  }
}

async function guardarEdicion(form) {
  const motor = visto.motor;
  const id = form.dataset.editarInv;
  const importe = r2(leerImporte(form.querySelector(`#ei-importe-${id}`).value));
  const fecha = form.querySelector(`#ei-fecha-${id}`).value;
  const k = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? motor.kDe(fecha) : -1;
  if (!(importe > 0) || k < 0) return aviso(`Revisa importe y fecha (Finanzas empieza en ${motor.nombreMesK(0).toLowerCase()})`, { error: true });
  try {
    await guardarInversion({ id, fecha, importe: Number(form.querySelector(`#ei-tipo-${id}`).value) * importe });
    abiertos.delete(id);
    irAlMes(k);
    aviso('Cambios guardados');
    avisarCambio();
  } catch (err) {
    aviso(err.message, { error: true });
  }
}
