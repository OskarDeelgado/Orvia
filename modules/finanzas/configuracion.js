// Configuración inicial de Finanzas (bloque 1).
// - Sin configuración: importar la copia de Sobrea o empezar con la configuración básica.
// - Con configuración: resumen del sueldo, el reparto y los saldos de partida,
//   y la opción de volver a importar (reemplaza todo).

import { escapar, aviso } from '../../core/ui/componentes.js';
import { leerCopiaSobrea, traducirSobrea, configuracionBasica } from './importador.js';
import { leerConfiguracion, importar } from './datos.js';

// Formato de Sobrea: 2.400 € o 32,50 € (punto de miles siempre, céntimos solo si los hay).
function euros(v) {
  const centimos = Math.round((+v || 0) * 100);
  const signo = centimos < 0 ? '−' : '';
  const abs = Math.abs(centimos);
  const entero = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = abs % 100;
  return `${signo}${entero}${resto ? ',' + String(resto).padStart(2, '0') : ''}\u00a0€`;
}
const pct = (v) => new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(+v || 0);
const nombreMes = (fecha) => {
  const t = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(fecha + 'T00:00:00Z'));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const ICONO_SUBIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>';

export async function montarConfiguracion(contenedor) {
  contenedor.innerHTML = '<p class="suave">Cargando Finanzas…</p>';
  let estado;
  try {
    estado = await leerConfiguracion();
  } catch (e) {
    contenedor.innerHTML = `
      <section class="cristal vacio">
        <p>No se pudieron leer tus datos de Finanzas.</p>
        <p class="suave">${escapar(e.message)}</p>
        <p class="suave">Si acabas de actualizar Orvia, comprueba que has ejecutado <strong>002_finanzas.sql</strong> en el SQL Editor de Supabase.</p>
      </section>`;
    return;
  }
  if (estado) pintarResumen(contenedor, estado);
  else pintarBienvenida(contenedor);
}

// ---------- Sin configuración ----------
function pintarBienvenida(contenedor) {
  contenedor.innerHTML = `
    <section class="cristal arranque">
      <h2>Pon en marcha Finanzas</h2>
      <p class="suave">Elige cómo empezar. Podrás revisar todo antes de guardarlo.</p>
      <div class="opciones-arranque">
        <input id="archivo-sobrea" type="file" accept=".json,application/json" class="oculto-visual">
        <label class="opcion-arranque" for="archivo-sobrea">
          <span class="opcion-icono">${ICONO_SUBIR}</span>
          <span><strong>Importar desde Sobrea</strong><span class="suave">Trae tu sueldo, tu reparto, categorías, movimientos, recurrentes, objetivos e inversiones.</span></span>
        </label>
        <button class="opcion-arranque" type="button" id="empezar-basica">
          <span class="opcion-icono">+</span>
          <span><strong>Empezar con la configuración básica</strong><span class="suave">Gastos fijos, Compras, Ocio y Extraordinarios, con los conceptos de Sobrea. El sueldo lo pondrás después.</span></span>
        </button>
      </div>
      <p class="nota-pequena">La copia de Sobrea se descarga en Sobrea, en Ajustes → Copia de seguridad → Descargar copia de seguridad.</p>
    </section>
    <div id="vista-previa"></div>`;

  const previa = contenedor.querySelector('#vista-previa');
  contenedor.querySelector('#archivo-sobrea').addEventListener('change', async (ev) => {
    const archivo = ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    try {
      const { st, fecha } = leerCopiaSobrea(await archivo.text());
      pintarVistaPrevia(previa, traducirSobrea(st), {
        origen: `Copia de Sobrea${fecha ? ' del ' + new Date(fecha).toLocaleDateString('es-ES') : ''}`,
        reemplazar: false,
        alTerminar: () => dispatchEvent(new CustomEvent('orvia:recargar-modulo')),
      });
    } catch (e) {
      aviso(e.message, { error: true });
    }
  });
  contenedor.querySelector('#empezar-basica').addEventListener('click', () => {
    pintarVistaPrevia(previa, configuracionBasica(), {
      origen: 'Configuración básica',
      reemplazar: false,
      alTerminar: () => dispatchEvent(new CustomEvent('orvia:recargar-modulo')),
    });
  });
}

// ---------- Vista previa antes de guardar ----------
function pintarVistaPrevia(destino, { datos, resumen }, { origen, reemplazar, alTerminar }) {
  const sumaGasto = resumen.sobres.filter((s) => s.activo).reduce((a, s) => a + s.porcentaje, 0);
  const traspaso = Math.max(0, 1 - sumaGasto - resumen.fondo.porcentaje);
  destino.innerHTML = `
    <section class="cristal" aria-labelledby="t-previa">
      <h2 id="t-previa">Revisa antes de guardar</h2>
      <p class="suave">${escapar(origen)}</p>
      <dl class="lista-filas">
        <div class="fila"><dt>Sueldo mensual</dt><dd>${euros(resumen.sueldo)}</dd></div>
        <div class="fila"><dt>Pagas extra</dt><dd>${resumen.pagas ? plural(resumen.pagas, 'paga', 'pagas') : 'Ninguna'}</dd></div>
      </dl>
      <h3 class="subtitulo">Reparto del sueldo <span class="suave">(últimos porcentajes; el historial se conserva)</span></h3>
      <ul class="lista-filas">
        ${resumen.sobres.map((s) => `
          <li class="fila${s.activo ? '' : ' inactiva'}"><span><span class="punto" style="--c:${s.color}"></span>${escapar(s.nombre)}${s.activo ? '' : ' <span class="suave">(dada de baja)</span>'}</span><span>${pct(s.porcentaje)}</span></li>`).join('')}
        <li class="fila"><span><span class="punto" style="--c:#9aa1ad"></span>Extraordinarios (fondo, tope ${euros(resumen.fondo.tope)})</span><span>${pct(resumen.fondo.porcentaje)}</span></li>
        <li class="fila total"><span>Traspaso al ahorro</span><span>${pct(traspaso)}</span></li>
      </ul>
      <p class="suave conteo">${[
        plural(resumen.conceptos, 'concepto', 'conceptos'),
        plural(resumen.movimientos, 'movimiento', 'movimientos'),
        plural(resumen.recurrentes, 'recurrente', 'recurrentes'),
        plural(resumen.inversiones, 'inversión', 'inversiones'),
        plural(resumen.objetivos, 'objetivo de ahorro', 'objetivos de ahorro'),
      ].join(' · ')}</p>
      ${resumen.avisos.length ? `<ul class="avisos-importacion">${resumen.avisos.map((a) => `<li>${escapar(a)}</li>`).join('')}</ul>` : ''}
      ${reemplazar ? '<p class="error">Esto borrará todos tus datos actuales de Finanzas y los sustituirá por estos.</p>' : ''}
      <div class="acciones">
        <button class="boton" type="button" id="guardar">${reemplazar ? 'Sí, reemplazar todo' : 'Guardar en Finanzas'}</button>
        <button class="boton secundario" type="button" id="cancelar">Cancelar</button>
      </div>
    </section>`;
  destino.scrollIntoView({ behavior: 'smooth', block: 'start' });

  destino.querySelector('#cancelar').addEventListener('click', () => (destino.innerHTML = ''));
  destino.querySelector('#guardar').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      const r = await importar(datos, { reemplazar });
      aviso(`Guardado: ${plural(r.sobres, 'sobre', 'sobres')} y ${plural(r.movimientos, 'movimiento', 'movimientos')}`);
      alTerminar();
    } catch (e) {
      aviso(e.message, { error: true });
      boton.disabled = false;
      boton.textContent = reemplazar ? 'Sí, reemplazar todo' : 'Guardar en Finanzas';
    }
  });
}

// ---------- Con configuración ----------
function pintarResumen(contenedor, { config, mes, sueldo, pagas, reparto, cuentas }) {
  const gastos = reparto.filter((s) => s.tipo === 'gasto');
  const fondo = reparto.find((s) => s.tipo === 'fondo');
  const sumaGasto = gastos.reduce((a, s) => a + s.porcentaje, 0);
  const traspaso = Math.max(0, 1 - sumaGasto - (fondo?.porcentaje ?? 0));
  const empieza = config.fecha_inicio > mes ? config.fecha_inicio : null;

  contenedor.innerHTML = `
    <section class="cristal">
      <h2>Tu configuración</h2>
      <p class="suave">${empieza ? `Finanzas empieza en ${nombreMes(config.fecha_inicio).toLowerCase()}.` : `Valores de ${nombreMes(mes).toLowerCase()}.`} Lo siguiente será apuntar gastos con el botón +.</p>
      <dl class="lista-filas">
        <div class="fila"><dt>Sueldo mensual</dt><dd class="cifra-fila">${euros(sueldo)}</dd></div>
        ${pagas.map((p) => `<div class="fila"><dt>${escapar(p.concepto)} de ${MESES[p.mes_del_anio - 1]}</dt><dd class="cifra-fila">${euros(p.importe)}</dd></div>`).join('')}
      </dl>
    </section>

    <section class="cristal" aria-labelledby="t-reparto">
      <h2 id="t-reparto">Reparto del sueldo</h2>
      <ul class="lista-filas">
        ${gastos.map((s) => `<li class="fila"><span><span class="punto" style="--c:${s.color}"></span>${escapar(s.nombre)}</span><span class="cifra-fila">${pct(s.porcentaje)} · ${euros(sueldo * s.porcentaje)}</span></li>`).join('')}
        ${fondo ? `<li class="fila"><span><span class="punto" style="--c:${fondo.color}"></span>Extraordinarios <span class="suave">(fondo hasta ${euros(config.fondo_tope)})</span></span><span class="cifra-fila">${pct(fondo.porcentaje)} · ${euros(sueldo * fondo.porcentaje)}</span></li>` : ''}
        <li class="fila total"><span>Traspaso al ahorro</span><span class="cifra-fila">${pct(traspaso)} · ${euros(sueldo * traspaso)}</span></li>
      </ul>
    </section>

    <section class="cristal" aria-labelledby="t-saldos">
      <h2 id="t-saldos">Saldos de partida</h2>
      <dl class="lista-filas">
        <div class="fila"><dt>Cuenta del día a día</dt><dd class="cifra-fila">${euros(config.saldo_inicial)}</dd></div>
        <div class="fila"><dt>Cuenta de ahorro</dt><dd class="cifra-fila">${euros(config.ahorro_inicial)}</dd></div>
        <div class="fila"><dt>Fondo de emergencia</dt><dd class="cifra-fila">${euros(config.fondo_inicial)}</dd></div>
        <div class="fila"><dt>Inversión (aportado · valor actual)</dt><dd class="cifra-fila">${euros(config.inversion_inicial)} · ${euros(config.inversion_valor)}</dd></div>
        <div class="fila"><dt>Sobrante</dt><dd class="cifra-fila">${euros(config.sobrante_inicial)}</dd></div>
      </dl>
      <p class="suave conteo">${[
        plural(cuentas.conceptos, 'concepto', 'conceptos'),
        plural(cuentas.movimientos, 'movimiento', 'movimientos'),
        plural(cuentas.recurrentes, 'recurrente', 'recurrentes'),
        plural(cuentas.inversiones, 'inversión', 'inversiones'),
        plural(cuentas.objetivos, 'objetivo de ahorro', 'objetivos de ahorro'),
      ].join(' · ')}</p>
    </section>

    <section class="cristal zona-reemplazar">
      <h2>Volver a importar</h2>
      <p class="suave">Sustituye todo lo de Finanzas por una copia nueva de Sobrea. Útil a finales de diciembre, cuando tengas tu configuración real.</p>
      <input id="archivo-reemplazo" type="file" accept=".json,application/json" class="oculto-visual">
      <label class="boton secundario" for="archivo-reemplazo">Elegir copia de Sobrea</label>
    </section>
    <div id="vista-previa"></div>`;

  const previa = contenedor.querySelector('#vista-previa');
  contenedor.querySelector('#archivo-reemplazo').addEventListener('change', async (ev) => {
    const archivo = ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    try {
      const { st, fecha } = leerCopiaSobrea(await archivo.text());
      pintarVistaPrevia(previa, traducirSobrea(st), {
        origen: `Copia de Sobrea${fecha ? ' del ' + new Date(fecha).toLocaleDateString('es-ES') : ''}`,
        reemplazar: true,
        alTerminar: () => {
          dispatchEvent(new CustomEvent('orvia:finanzas'));
          montarConfiguracion(contenedor);
        },
      });
    } catch (e) {
      aviso(e.message, { error: true });
    }
  });
}
