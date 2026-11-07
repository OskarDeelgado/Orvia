// Puesta en marcha de Finanzas: importar la copia de Sobrea o empezar con la
// configuración básica (y después el inicio guiado). La vista previa se reutiliza
// en Ajustes → Copia de seguridad → Restaurar.

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
  if (estado) dispatchEvent(new CustomEvent('orvia:recargar-modulo')); // ya configurada: Finanzas abre sus pestañas
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
          <span><strong>Importar una copia</strong><span class="suave">De Sobrea o de Orvia: trae tu sueldo, tu reparto, categorías, movimientos, recurrentes, objetivos e inversiones.</span></span>
        </label>
        <button class="opcion-arranque" type="button" id="empezar-basica">
          <span class="opcion-icono">+</span>
          <span><strong>Empezar con la configuración básica</strong><span class="suave">Gastos fijos, Compras, Ocio, Extraordinarios e Ingresos extra, con los conceptos de Sobrea. El sueldo lo pondrás después.</span></span>
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
      const texto = await archivo.text();
      let json = null;
      try { json = JSON.parse(texto); } catch { /* lo explica leerCopiaSobrea */ }
      let traducido, origen;
      if (json?.app === 'Orvia') {
        const { copiaOrviaADatos } = await import('./reglas.js');
        traducido = copiaOrviaADatos(json);
        origen = `Copia de Orvia del ${new Date(json.exportado).toLocaleDateString('es-ES')}`;
      } else {
        const { st, fecha } = leerCopiaSobrea(texto);
        traducido = traducirSobrea(st);
        origen = `Copia de Sobrea${fecha ? ' del ' + new Date(fecha).toLocaleDateString('es-ES') : ''}`;
      }
      pintarVistaPrevia(previa, traducido, {
        origen,
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
      // Como en Sobrea: después, el inicio guiado (saldos, sueldo y reparto).
      alTerminar: () => {
        dispatchEvent(new CustomEvent('orvia:recargar-modulo'));
        setTimeout(() => import('./asistente.js').then((m) => m.abrirAsistente()), 400);
      },
    });
  });
}

// ---------- Vista previa antes de guardar ----------
export function pintarVistaPrevia(destino, { datos, resumen }, { origen, reemplazar, alTerminar }) {
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
