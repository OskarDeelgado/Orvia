// Pestaña Ajustes de Finanzas: igual que en Sobrea (salvo Apariencia: Orvia es solo oscura).
// Cada apartado se pliega y despliega, con un resumen a la derecha, como en Sobrea.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { euros, leerImporte, frecuencia, fechaRepeticion } from './calculo.js';
import { montarVista, avisarCambio } from './vista.js';
import { COLORES, leerCopiaSobrea, traducirSobrea } from './importador.js';
import {
  efecto, guardarPorcentaje, guardarSueldo, enVigorYUltimo, guardarConfig, cambiarNumeroPagas, cambiarPaga,
  categoriasVisibles, nombreOcupado, crearCategoria, renombrarCategoria, cambiarColor, comprobarEliminar,
  eliminarCategoria, cancelarEliminacion, anadirConcepto, quitarConcepto, ignorarSugerencia,
  guardarRecurrente, pausarReanudar, eliminarRecurrente, borrarMovimientos, borrarTodo, leerParaCopia, copiaOrviaADatos,
} from './reglas.js';
import { htmlGuia, guiaPdf, GUIA } from './guia.js';
import { abrirAsistente } from './asistente.js';
import { pintarVistaPrevia } from './configuracion.js';
import { entregar } from './informes.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CLAVE = 'orvia-fin-ajustes';
const ui = { abiertos: leerAbiertos(), color: null, recurrente: null, confirmar: null };
const pct = (x) => +(x * 100).toFixed(2);
const pctTexto = (x) => String(+(x * 100).toFixed(1)).replace('.', ',');
const valor = (v) => String(Math.round((+v || 0) * 100) / 100).replace('.', ',');
const fdt = (f) => `${f.slice(8)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;

function leerAbiertos() {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')); } catch { return new Set(); }
}
function guardarAbiertos() {
  try { localStorage.setItem(CLAVE, JSON.stringify([...ui.abiertos])); } catch { /* sin almacenamiento: se olvida al salir */ }
}

/** Confirmación con segunda pulsación (4 segundos), como en Sobrea. */
function confirmar(clave, repintar) {
  if (ui.confirmar === clave) { ui.confirmar = null; return true; }
  ui.confirmar = clave;
  repintar();
  setTimeout(() => { if (ui.confirmar === clave) { ui.confirmar = null; repintar(); } }, 4000);
  return false;
}

export function montarAjustes(contenedor) {
  return montarVista(contenedor, { pintar, alClic, alCambio });
}

// ---------- Pintar ----------

function apartado(id, titulo, resumen, cuerpo) {
  const abierto = ui.abiertos.has(id);
  return `
    <section class="cristal plegable">
      <button class="plegable-cabecera" type="button" data-plegar="${id}" aria-expanded="${abierto}" aria-controls="ap-${id}">
        <span class="plegable-titulo">${escapar(titulo)}</span>
        <span class="plegable-resumen">${escapar(resumen || '')}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="plegable-cuerpo" id="ap-${id}" ${abierto ? '' : 'hidden'}>${cuerpo}</div>
    </section>`;
}

const campo = (etiqueta, dato, v, extra = '') => `<div class="campo"><label for="aj-${dato}">${etiqueta}</label><input id="aj-${dato}" data-k="${dato}" inputmode="decimal" autocomplete="off" value="${valor(v)}" ${extra}></div>`;

function pintar(contenedor, motor) {
  const { config } = motor.libro;
  const kActual = Math.max(0, motor.kHoy());
  const vivos = categoriasVisibles(motor);
  const gastos = vivos.filter((s) => s.tipo === 'gasto');
  const ingresos = motor.libro.sobres.filter((s) => s.tipo === 'ingreso');
  const fondo = motor.fondo;
  const sueldo = enVigorYUltimo(motor, motor.libro.sueldos, 'importe');
  const pagas = [...motor.libro.pagas].sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  const resto = 1 - motor.libro.sobres.filter((s) => s.tipo === 'gasto' && !s.hasta_mes).reduce((a, s) => a + motor.ultimoPorcentaje(s), 0) - (fondo ? motor.ultimoPorcentaje(fondo) : 0);
  const sug = motor.sugerencias();
  const c = motor.kHoy();
  const recurrentes = motor.libro.recurrentes;
  const pista = (s) => {
    const filas = motor.libro.porcentajes.filter((p) => p.sobre_id === s.id);
    const v = enVigorYUltimo(motor, filas, 'porcentaje');
    return v.vigor !== v.ultimo ? `<p class="ayuda">En vigor este mes: ${pctTexto(v.vigor)} %. El cambio rige desde ${escapar(motor.nombreMesK(motor.kDe(v.desde)))}.</p>` : '';
  };
  const conceptosDe = (id) => motor.libro.conceptos.filter((x) => x.sobre_id === id);

  const cuentas = `
    ${campo(`Saldo inicial cuenta diaria (${motor.nombreMesK(0).toLowerCase().replace(/^\w+/, (m) => '1 ' + m)}, €)`, 'saldo_inicial', config.saldo_inicial)}
    ${campo('Saldo inicial cuenta de ahorro (incluye el fondo de emergencia, €)', 'ahorro_inicial', config.ahorro_inicial)}
    ${campo('Invertido inicialmente (€)', 'inversion_inicial', config.inversion_inicial)}
    ${campo('Sueldo mensual neto (€)', 'sueldo', sueldo.ultimo)}
    ${sueldo.vigor !== sueldo.ultimo ? `<p class="ayuda">En vigor este mes: ${euros(sueldo.vigor)}. El cambio rige desde ${escapar(motor.nombreMesK(motor.kDe(sueldo.desde)))}.</p>` : ''}
    <div class="campo"><label for="aj-npagas">Número de pagas extra</label><select id="aj-npagas" data-npagas>${[0, 1, 2, 3, 4].map((i) => `<option${i === pagas.length ? ' selected' : ''}>${i}</option>`).join('')}</select></div>
    ${pagas.map((p, i) => `<div class="dos-campos">
      <div class="campo"><label for="aj-pm-${p.id}">Mes paga ${i + 1}</label><select id="aj-pm-${p.id}" data-paga-mes="${p.id}">${MESES.map((m, j) => `<option value="${j + 1}"${j + 1 === p.mes_del_anio ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label for="aj-pi-${p.id}">Importe (€)</label><input id="aj-pi-${p.id}" data-paga-importe="${p.id}" inputmode="decimal" value="${valor(p.importe)}"></div>
    </div>`).join('')}`;

  const categorias = gastos.map((s) => {
    const fin = s.hasta_mes ? motor.kDe(s.hasta_mes) : null;
    const empieza = s.desde_mes ? motor.kDe(s.desde_mes) : 0;
    return `<div class="caja${fin != null ? ' inactiva' : ''}">
      <div class="fila-nombre">
        <div class="campo"><label for="aj-n-${s.id}">Nombre</label><input id="aj-n-${s.id}" data-nombre="${s.id}" value="${escapar(s.nombre)}" maxlength="40"></div>
        <button class="muestra-color" type="button" data-color="${s.id}" aria-label="Cambiar color de ${escapar(s.nombre)}" aria-expanded="${ui.color === s.id}" style="--c:${s.color}"></button>
      </div>
      ${ui.color === s.id ? `<div class="paleta">${COLORES.map((col, i) => `<button type="button" data-color-elegido="${s.id}|${col}" aria-label="Color ${i + 1}" aria-pressed="${s.color === col}" style="--c:${col}"></button>`).join('')}</div>` : ''}
      <div class="fila-acciones">
        <span class="suave">${fin != null ? `Se elimina desde ${escapar(motor.nombreMesK(fin))}` : empieza > kActual ? `Empieza en ${escapar(motor.nombreMesK(empieza))}` : ''}</span>
        ${fin != null ? `<button class="boton secundario boton-pequeno" type="button" data-cancelar-baja="${s.id}">Cancelar eliminación</button>`
          : `<button class="boton secundario boton-pequeno" type="button" data-eliminar-cat="${s.id}">${ui.confirmar === 'cat:' + s.id ? 'Pulsa otra vez para eliminar' : 'Eliminar'}</button>`}
      </div>
    </div>`;
  }).join('') + `
    <div class="caja">
      <strong>Nueva categoría</strong>
      <div class="dos-campos nueva-categoria">
        <input id="aj-nueva" placeholder="Nombre" aria-label="Nombre de la nueva categoría" maxlength="40">
        <select id="aj-nueva-tipo" aria-label="Tipo de categoría"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select>
      </div>
      <button class="boton secundario ancho" type="button" data-crear-cat>Crear categoría</button>
      <p class="ayuda">Las categorías de gasto nuevas empiezan con un 0 %: asígnales su porcentaje en «Reparto del sueldo».</p>
    </div>`;

  const repartoHtml = gastos.map((s) => `
    <div class="caja${s.hasta_mes ? ' inactiva' : ''}">
      <label class="fila-porcentaje"><span><span class="punto" style="--c:${s.color}"></span>${escapar(s.nombre)}</span>
        <span class="entrada-pct"><input inputmode="decimal" data-pct="${s.id}" aria-label="Porcentaje del sueldo para ${escapar(s.nombre)}" value="${String(pct(motor.ultimoPorcentaje(s))).replace('.', ',')}"><span>%</span></span></label>
      ${pista(s)}
    </div>`).join('') + (fondo ? `
    <div class="caja">
      <label class="fila-porcentaje"><span><span class="punto" style="--c:${fondo.color}"></span>Fondo de emergencia</span>
        <span class="entrada-pct"><input inputmode="decimal" data-pct="${fondo.id}" aria-label="Porcentaje del sueldo para el fondo de emergencia" value="${String(pct(motor.ultimoPorcentaje(fondo))).replace('.', ',')}"><span>%</span></span></label>
      ${pista(fondo)}
    </div>` : '') + `
    <div class="caja"><div class="fila"><strong>Ahorro e inversión (el resto)</strong><strong class="${resto < 0 ? 'texto-peligro' : ''}">${pctTexto(resto)} %</strong></div>
      ${resto < 0 ? '<p class="texto-peligro">Los porcentajes suman más del 100 %.</p>' : ''}</div>
    <p class="ayuda">Un cambio de porcentaje rige desde el mes siguiente: el mes en curso se queda como estaba el día 1. Antes de ${escapar(motor.nombreMesK(0).toLowerCase())} se aplica directamente.</p>`;

  const ingresosHtml = (ingresos.map((s) => `
    <div class="caja">
      <div class="campo"><label for="aj-n-${s.id}">Nombre</label><input id="aj-n-${s.id}" data-nombre="${s.id}" value="${escapar(s.nombre)}" maxlength="40"></div>
      <button class="boton secundario ancho boton-separado" type="button" data-eliminar-cat="${s.id}">${ui.confirmar === 'cat:' + s.id ? 'Pulsa otra vez para eliminar' : 'Eliminar'}</button>
    </div>`).join('') || '<p class="suave">No tienes categorías de ingreso. Crea una en «Nueva categoría» eligiendo el tipo Ingreso.</p>')
    + '<p class="ayuda">Un ingreso registrado en estas categorías se suma a lo que tienes disponible para gastar ese mes y a tu cuenta diaria. No se reparte entre los sobres ni cambia el Sobrante.</p>';

  const saldos = `<div class="tres-campos">
    ${campo('Fondo emergencia (€)', 'fondo_inicial', config.fondo_inicial)}
    ${campo('Tope fondo (€)', 'fondo_tope', config.fondo_tope)}
    ${campo('Sobrante inicial (€)', 'sobrante_inicial', config.sobrante_inicial)}
  </div>`;

  const conceptos = [...vivos, ...(fondo ? [fondo] : [])].map((s) => `
    <div class="bloque-conceptos">
      <strong>${escapar(s.nombre)}</strong>
      <div class="chips-elegir">${conceptosDe(s.id).map((x) => `<button type="button" class="chip-opcion" data-quitar-concepto="${x.id}" aria-label="Quitar ${escapar(x.nombre)}">${escapar(x.nombre)} ✕</button>`).join('')}</div>
      <div class="dos-campos"><input id="aj-c-${s.id}" placeholder="Nuevo concepto" aria-label="Nuevo concepto para ${escapar(s.nombre)}" maxlength="40"><button class="boton secundario" type="button" data-anadir-concepto="${s.id}">Añadir</button></div>
    </div>`).join('');

  const desdeSug = motor.nombreMesK(3).toLowerCase();
  const sugerencias = c < 3
    ? `<p class="suave">Disponible desde ${escapar(desdeSug)}, cuando haya tres meses de historial. Entonces, cada mes te propondrá ajustar el porcentaje de cada categoría según tu gasto real de los últimos tres meses. Tú decides si aplicas cada cambio.</p>`
    : (sug.length ? sug.map((r) => `
      <div class="caja">
        <div class="fila"><strong><span class="punto" style="--c:${r.sobre.color}"></span>${escapar(r.sobre.nombre)}</strong><strong>${pctTexto(r.actual)} % → ${pctTexto(r.propuesto)} %</strong></div>
        <p class="suave">Tu gasto de ${escapar(MESES[(+motor.mesK(c - 3).slice(5, 7)) - 1].slice(0, 3).toLowerCase())} a ${escapar(MESES[(+motor.mesK(c - 1).slice(5, 7)) - 1].slice(0, 3).toLowerCase())}: ${euros(r.media)} al mes, un ${pctTexto(r.real)} % de tu sueldo${Math.abs(r.real - r.propuesto) > 0.0049 ? ' (el cambio se limita a 2 puntos por mes)' : ''}.</p>
        <p class="suave">Ahorro e inversión: ${pctTexto(r.ahorro0)} % → ${pctTexto(r.ahorro)} %${r.ahorro < r.ahorro0 - 0.0001 ? ' (baja)' : ' (sube)'}${r.ahorro < 0 ? ' · <span class="texto-peligro">los porcentajes sumarían más de 100 %</span>' : ''}</p>
        <div class="dos-botones"><button class="boton" type="button" data-aplicar-sug="${r.sobre.id}" ${r.ahorro < 0 ? 'disabled' : ''}>Aplicar</button><button class="boton secundario" type="button" data-ignorar-sug="${r.sobre.id}">Ignorar este mes</button></div>
      </div>`).join('') : '<p class="suave">Tus porcentajes encajan con tu gasto de los últimos tres meses: sin sugerencias este mes.</p>')
      + '<p class="ayuda">Compara tu gasto medio de los últimos tres meses con el porcentaje de cada categoría, sin contar los extraordinarios. Un cambio aplicado rige desde el mes siguiente y no toca los meses pasados.</p>';

  const recHtml = (recurrentes.map((r) => {
    const s = motor.porId[r.sobre_id] || { nombre: '(eliminada)', color: '#6b7280' };
    const proximo = fechaRepeticion(r, r.siguiente);
    const abierto = ui.recurrente === r.id;
    return `<div class="caja">
      <button class="fila-recurrente" type="button" data-recurrente="${r.id}" aria-expanded="${abierto}">
        <span><strong>${escapar(r.concepto || s.nombre)}</strong><span class="suave"><span class="punto" style="--c:${s.color}"></span>${escapar(s.nombre)} · ${euros(Number(r.importe))} · ${escapar(frecuencia(r))}${r.meses > 1 ? ` · en ${r.meses} meses` : ''}</span></span>
        <span class="suave">${r.activo ? 'Próximo ' + fdt(proximo).slice(0, 5) : 'En pausa'}</span>
      </button>
      ${abierto ? `<form class="edicion-recurrente" data-form-recurrente="${r.id}" novalidate>
        <div class="dos-campos">
          <div class="campo"><label for="rc-i-${r.id}">Importe (€)</label><input id="rc-i-${r.id}" inputmode="decimal" value="${valor(r.importe)}"></div>
          <div class="campo"><label for="rc-n-${r.id}">Cada</label><input id="rc-n-${r.id}" inputmode="numeric" value="${r.cada}"></div>
        </div>
        <div class="campo"><label for="rc-u-${r.id}">Unidad</label><select id="rc-u-${r.id}">${[['dia', 'días'], ['semana', 'semanas'], ['mes', 'meses']].map(([v, l]) => `<option value="${v}"${v === r.unidad ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <button class="boton ancho" type="submit">Guardar cambios</button>
        <div class="dos-botones">
          <button class="boton secundario" type="button" data-pausar="${r.id}">${r.activo ? 'Pausar' : 'Reanudar'}</button>
          <button class="boton secundario texto-peligro" type="button" data-eliminar-rec="${r.id}">${ui.confirmar === 'rec:' + r.id ? 'Pulsa otra vez para eliminar' : 'Eliminar'}</button>
        </div>
        <p class="ayuda">Los cambios valen para los próximos cobros; los ya apuntados no se tocan. Próximo cobro: ${r.activo ? fdt(proximo) : 'en pausa'}.</p>
      </form>` : ''}
    </div>`;
  }).join('') || '<p class="suave">Aún no tienes ninguno. Al apuntar un gasto, pulsa Repetir para que se apunte solo cada cierto tiempo.</p>')
    + '<p class="ayuda">Los cobros se apuntan al abrir Finanzas, con la fecha en que tocaban. Si no la abres en unos días, se apuntan todos los pendientes. Puedes editar o borrar cada uno como cualquier movimiento.</p>';

  const nActivos = recurrentes.filter((r) => r.activo).length;
  const nGastos = gastos.filter((s) => !s.hasta_mes).length;

  contenedor.innerHTML = `
    ${apartado('cuentas', 'Cuentas e ingresos', `Sueldo ${euros(sueldo.ultimo)}`, cuentas)}
    ${apartado('categorias', 'Categorías de gastos', `${nGastos} ${nGastos === 1 ? 'categoría' : 'categorías'}`, categorias)}
    ${apartado('reparto', 'Reparto del sueldo', `ahorro ${pctTexto(resto)} %`, repartoHtml)}
    ${apartado('ingresos', 'Categorías de ingreso', `${ingresos.length} ${ingresos.length === 1 ? 'categoría' : 'categorías'}`, ingresosHtml)}
    ${apartado('saldos', 'Saldos iniciales de partida', '', saldos)}
    ${apartado('conceptos', 'Conceptos por categoría', '', conceptos)}
    ${apartado('sugerencias', 'Sugerencias de reajuste', c < 3 ? `Desde ${desdeSug}` : sug.length ? `${sug.length} ${sug.length === 1 ? 'sugerencia' : 'sugerencias'}` : 'Sin sugerencias', sugerencias)}
    ${apartado('recurrentes', 'Gastos recurrentes', nActivos ? `${nActivos} ${nActivos === 1 ? 'activo' : 'activos'}` : 'Ninguno', recHtml)}
    ${apartado('guia', 'Guía de uso', `${GUIA.length} temas`, `<p class="suave">Qué hace cada parte de Finanzas y cómo funciona el dinero.</p>${htmlGuia()}<button class="boton secundario ancho boton-separado" type="button" data-guia-pdf>Descargar guía en PDF</button>`)}
    ${apartado('copia', 'Copia de seguridad', 'Archivo .json', `
      <p class="suave">Guarda todos tus datos de Finanzas en un archivo, o restaura una copia de Orvia o de Sobrea.</p>
      <button class="boton secundario ancho" type="button" data-copia>Descargar copia de seguridad</button>
      <input id="aj-restaurar" type="file" accept=".json,application/json" class="oculto-visual">
      <label class="boton secundario ancho boton-separado" for="aj-restaurar">Restaurar desde un archivo…</label>
      <div id="aj-previa"></div>`)}
    ${apartado('privacidad', 'Aviso y privacidad', 'Tus datos', `
      <p class="suave"><strong class="tinta">Uso personal.</strong> Finanzas no es asesoramiento financiero ni sustituye a tu banco. No se conecta a ninguna cuenta bancaria: solo calcula con lo que tú introduces.</p>
      <p class="suave"><strong class="tinta">Qué datos se guardan.</strong> Los importes, categorías, fechas y notas que apuntas, y tu configuración (sueldo, saldos y porcentajes).</p>
      <p class="suave"><strong class="tinta">Dónde se guardan.</strong> En tu propio proyecto de Supabase. Cada fila lleva tu usuario y solo tu sesión puede leerla. No se usan para publicidad ni se venden ni se comparten.</p>
      <p class="suave"><strong class="tinta">Tus derechos.</strong> Puedes llevarte tus datos a Excel desde la pestaña Mes, guardar una copia de seguridad y borrarlo todo con el botón de abajo. Borrar elimina tu configuración, tus movimientos y tus objetivos de ahorro, y no se puede deshacer.</p>
      <button class="boton peligro ancho" type="button" data-borrar-todo>${ui.confirmar === 'todo' ? 'Pulsa otra vez para borrarlo todo' : 'Borrar todos mis datos'}</button>`)}
    <section class="cristal">
      <h2>Inicio guiado</h2>
      <p class="suave">Repite el asistente de saldos, sueldo y reparto.</p>
      <button class="boton secundario ancho boton-separado" type="button" data-asistente>Repetir inicio guiado</button>
    </section>
    <button class="boton secundario ancho boton-separado" type="button" data-borrar-movs>${ui.confirmar === 'movs' ? 'Pulsa otra vez para confirmar' : 'Borrar todos los movimientos'}</button>`;
}

// ---------- Clics ----------

async function alClic(e, ctx) {
  const { motor, repintar } = ctx;
  const t = e.target.closest('button,[data-plegar]');
  if (!t) return;
  const d = t.dataset;
  const hacer = async (accion, mensaje) => {
    t.disabled = true;
    try {
      const r = await accion();
      if (mensaje) aviso(typeof mensaje === 'function' ? mensaje(r) : mensaje);
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
      t.disabled = false;
    }
  };

  if (d.plegar) {
    if (ui.abiertos.has(d.plegar)) ui.abiertos.delete(d.plegar); else ui.abiertos.add(d.plegar);
    guardarAbiertos();
    const abierto = ui.abiertos.has(d.plegar);
    t.setAttribute('aria-expanded', String(abierto));
    t.nextElementSibling.hidden = !abierto;
    return;
  }
  if (d.color) { ui.color = ui.color === d.color ? null : d.color; return repintar(); }
  if (d.colorElegido) {
    const [id, col] = d.colorElegido.split('|');
    ui.color = null;
    return hacer(() => cambiarColor(motor, motor.porId[id], col));
  }
  if (d.eliminarCat) {
    const s = motor.porId[d.eliminarCat];
    const { n, base, E } = comprobarEliminar(motor, s);
    if (n) return aviso(`«${s.nombre}» tiene ${n} ${n > 1 ? 'gastos' : 'gasto'}${base || s.tipo === 'ingreso' ? '' : ' desde ' + motor.nombreMesK(E)}: pásalos a otra categoría (tocándolos en Mes) o bórralos antes`, { error: true });
    if (!confirmar('cat:' + s.id, repintar)) return;
    return hacer(() => eliminarCategoria(motor, s), (r) => (r.del_todo ? 'Categoría eliminada' : `Se eliminará desde ${motor.nombreMesK(r.E)}; los meses anteriores no cambian`));
  }
  if (d.cancelarBaja) return hacer(() => cancelarEliminacion(d.cancelarBaja), 'Eliminación cancelada');
  if (d.crearCat != null) {
    const nombre = document.getElementById('aj-nueva').value.trim();
    const tipo = document.getElementById('aj-nueva-tipo').value;
    if (!nombre) return aviso('Escribe un nombre para la categoría', { error: true });
    if (nombreOcupado(motor, nombre)) return aviso('Ya existe una categoría con ese nombre', { error: true });
    return hacer(() => crearCategoria(motor, nombre, tipo), (r) => (tipo === 'ingreso' ? 'Categoría de ingreso creada'
      : r.base ? 'Categoría creada: asigna su % en Reparto del sueldo' : `Categoría creada: empieza en ${motor.nombreMesK(r.E)}`));
  }
  if (d.quitarConcepto) return hacer(() => quitarConcepto(d.quitarConcepto));
  if (d.anadirConcepto) {
    const id = d.anadirConcepto, campoC = document.getElementById('aj-c-' + id), nombre = campoC.value.trim();
    if (!nombre || motor.libro.conceptos.some((x) => x.sobre_id === id && x.nombre === nombre)) return;
    return hacer(() => anadirConcepto(motor, id, nombre));
  }
  if (d.aplicarSug) {
    const r = motor.sugerencias().find((x) => x.sobre.id === d.aplicarSug);
    if (!r) return;
    return hacer(() => guardarPorcentaje(motor, r.sobre, r.propuesto), `Aplicado desde ${motor.nombreMesK(efecto(motor).E)}`);
  }
  if (d.ignorarSug) return hacer(() => ignorarSugerencia(motor, motor.porId[d.ignorarSug]));
  if (d.recurrente) { ui.recurrente = ui.recurrente === d.recurrente ? null : d.recurrente; ui.confirmar = null; return repintar(); }
  if (d.pausar) {
    const r = motor.libro.recurrentes.find((x) => x.id === d.pausar);
    return hacer(() => pausarReanudar(r), r.activo ? 'En pausa' : 'Reanudado');
  }
  if (d.eliminarRec) {
    if (!confirmar('rec:' + d.eliminarRec, repintar)) return;
    ui.recurrente = null;
    return hacer(() => eliminarRecurrente(d.eliminarRec), 'Eliminado. Los cobros ya apuntados se mantienen');
  }
  if (d.guiaPdf != null) { t.disabled = true; await guiaPdf(); t.disabled = false; return; }
  if (d.copia != null) {
    t.disabled = true;
    try {
      const copia = await leerParaCopia();
      await entregar(`Orvia_Finanzas_copia_${new Date().toISOString().slice(0, 10)}.json`, new TextEncoder().encode(JSON.stringify(copia, null, 1)), 'application/json');
      aviso('Copia de seguridad lista');
    } catch (err) {
      aviso('No se pudo crear la copia: ' + err.message, { error: true });
    }
    t.disabled = false;
    return;
  }
  if (d.borrarTodo != null) {
    if (!confirmar('todo', repintar)) return;
    t.disabled = true;
    try {
      await borrarTodo();
      aviso('Datos borrados');
      dispatchEvent(new CustomEvent('orvia:recargar-modulo'));
    } catch (err) {
      aviso(err.message, { error: true });
      t.disabled = false;
    }
    return;
  }
  if (d.asistente != null) return abrirAsistente({ repetir: true });
  if (d.borrarMovs != null) {
    if (!confirmar('movs', repintar)) return;
    return hacer(() => borrarMovimientos(), 'Movimientos borrados');
  }
}

// ---------- Cambios en campos ----------

async function alCambio(e, { motor }) {
  const el = e.target, d = el.dataset;
  const guardar = async (accion, mensaje) => {
    try {
      const r = await accion();
      const m = typeof mensaje === 'function' ? mensaje(r) : mensaje;
      if (m) aviso(m);
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
      avisarCambio();
    }
  };
  const numero = () => {
    const v = el.value.trim() === '' ? 0 : leerImporte(el.value);
    if (!(v >= 0)) { aviso('Escribe una cantidad válida, por ejemplo 1.250,50', { error: true }); avisarCambio(); return null; }
    return v;
  };

  if (el.id === 'aj-restaurar') {
    const archivo = el.files[0];
    el.value = '';
    if (archivo) restaurar(archivo);
    return;
  }
  if (d.k) {
    const v = numero();
    if (v == null) return;
    if (d.k === 'sueldo') {
      return guardar(() => guardarSueldo(motor, v), (r) => (r.directo ? '' : `El cambio rige desde ${motor.nombreMesK(r.desde)}; este mes se mantiene`));
    }
    return guardar(() => guardarConfig(motor, { [d.k]: v }));
  }
  if (d.npagas != null) {
    const sueldo = motor.libro.sueldos.length ? Number(motor.libro.sueldos.at(-1).importe) : 0;
    return guardar(() => cambiarNumeroPagas(motor, +el.value, sueldo));
  }
  if (d.pagaMes) return guardar(() => cambiarPaga(d.pagaMes, { mes_del_anio: +el.value }));
  if (d.pagaImporte) {
    const v = numero();
    if (v == null) return;
    return guardar(() => cambiarPaga(d.pagaImporte, { importe: v }));
  }
  if (d.nombre) {
    const nombre = el.value.trim();
    if (!nombre || nombreOcupado(motor, nombre, d.nombre)) {
      aviso(nombre ? 'Ya existe una categoría con ese nombre' : 'El nombre no puede estar vacío', { error: true });
      return avisarCambio();
    }
    return guardar(() => renombrarCategoria(d.nombre, nombre));
  }
  if (d.pct) {
    const v = numero();
    if (v == null) return;
    const s = motor.porId[d.pct];
    return guardar(() => guardarPorcentaje(motor, s, Math.round(v * 100) / 10000),
      (r) => (r.directo || r.desde == null ? '' : `El cambio rige desde ${motor.nombreMesK(r.desde)}; este mes se mantiene`));
  }
}

// Guardar el formulario de un recurrente
document.addEventListener('submit', async (e) => {
  const form = e.target.closest?.('[data-form-recurrente]');
  if (!form) return;
  e.preventDefault();
  const { visto } = await import('./vista.js');
  const id = form.dataset.formRecurrente;
  const r = visto.motor.libro.recurrentes.find((x) => x.id === id);
  const importe = leerImporte(form.querySelector(`#rc-i-${id}`).value);
  const cada = Math.floor(Number(form.querySelector(`#rc-n-${id}`).value));
  const unidad = form.querySelector(`#rc-u-${id}`).value;
  if (!(importe > 0) || !(cada >= 1 && cada <= 365)) return aviso('Revisa el importe y la frecuencia', { error: true });
  try {
    await guardarRecurrente(r, { importe: Math.round(importe * 100) / 100, cada, unidad });
    aviso('Cambios guardados');
    avisarCambio();
  } catch (err) {
    aviso(err.message, { error: true });
  }
});

/** Restaurar: acepta una copia de Orvia (de Finanzas o la general) o una de Sobrea. */
async function restaurar(archivo) {
  const destino = document.getElementById('aj-previa');
  try {
    const texto = await archivo.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* lo detecta leerCopiaSobrea */ }
    let traducido, origen;
    if (json?.app === 'Orvia') {
      traducido = copiaOrviaADatos(json);
      origen = `Copia de Orvia del ${new Date(json.exportado).toLocaleDateString('es-ES')}`;
    } else {
      const { st, fecha } = leerCopiaSobrea(texto);
      traducido = traducirSobrea(st);
      origen = `Copia de Sobrea${fecha ? ' del ' + new Date(fecha).toLocaleDateString('es-ES') : ''}`;
    }
    pintarVistaPrevia(destino, traducido, {
      origen, reemplazar: true,
      alTerminar: () => { aviso('Copia restaurada'); dispatchEvent(new CustomEvent('orvia:recargar-modulo')); },
    });
  } catch (err) {
    aviso(err.message || 'Ese archivo no es una copia de Orvia ni de Sobrea', { error: true });
  }
}
