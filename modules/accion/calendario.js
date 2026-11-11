// Calendario del iPhone en Orvia (Acción, bloque 4). Solo lectura.
// - Los enlaces de «Calendario público» de iCloud se guardan en la tabla `calendarios` (006).
// - Los eventos los trae la función del servidor «calendario» (supabase/functions/calendario),
//   porque el navegador no puede leer iCloud directamente.
// - Se guardan unos minutos en memoria para no pedirlos en cada repintado de la semana.

import { listar, crear, actualizar, archivar, invocar } from '../../core/db.js';
import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import { sumarDias, etiquetaDia } from './fechas.js';

export const COLORES = [
  ['#7aa2f7', 'Azul'], ['#7dd3a8', 'Verde'], ['#b49af0', 'Violeta'],
  ['#e0b25c', 'Ámbar'], ['#f08c78', 'Coral'], ['#5cc6db', 'Cian'],
];

const VIDA_CACHE = 5 * 60 * 1000;
const cache = new Map(); // 'desde|hasta' → { cuando, datos }
let hayCalendarios = null; // se sabe tras la primera lectura

export const listarCalendarios = () => listar('calendarios', { orden: 'orden' });
/** ¿Tiene calendarios conectados? (null = aún no se sabe) */
export const tieneCalendarios = () => hayCalendarios;

function olvidar() { cache.clear(); }

/**
 * Eventos entre dos días ('AAAA-MM-DD', hasta no incluido).
 * @returns {Promise<{eventos: object[], errores: object[], calendarios: number}>}
 */
export async function leerEventos(desde, hasta, { forzar = false } = {}) {
  const clave = `${desde}|${hasta}`;
  const guardado = cache.get(clave);
  if (!forzar && guardado && Date.now() - guardado.cuando < VIDA_CACHE) return guardado.datos;
  const calendarios = (await listarCalendarios()).filter((c) => c.activo);
  hayCalendarios = calendarios.length > 0;
  if (!hayCalendarios) return { eventos: [], errores: [], calendarios: 0 };
  let datos;
  try {
    const r = await invocar('calendario', { desde, hasta });
    datos = { eventos: r?.eventos || [], errores: r?.errores || [], calendarios: calendarios.length };
  } catch (e) {
    // Sin la función desplegada (404) o sin conexión: la semana sigue funcionando.
    const mensaje = e.estado === 404 ? 'Falta instalar la función «calendario» en Supabase' : `No se pudo leer tu calendario: ${e.message}`;
    datos = { eventos: [], errores: [{ mensaje }], calendarios: calendarios.length };
    return datos; // no se guarda: se reintenta en el siguiente repintado
  }
  cache.set(clave, { cuando: Date.now(), datos });
  return datos;
}

/** Reparte los eventos por día: un evento de varios días aparece en cada uno. */
export function eventosPorDia(eventos, dias) {
  const porDia = Object.fromEntries(dias.map((d) => [d, []]));
  for (const e of eventos) {
    const ini = e.inicio.slice(0, 10);
    let fin;
    if (e.todoElDia) fin = sumarDias(e.fin.slice(0, 10), -1);
    else {
      fin = e.fin.slice(0, 10);
      if (e.fin.slice(11) === '00:00' && fin > ini) fin = sumarDias(fin, -1); // acaba justo a medianoche
    }
    for (const d of dias) if (d >= ini && d <= (fin < ini ? ini : fin)) porDia[d].push({ ...e, continua: d !== ini });
  }
  for (const d of dias) porDia[d].sort((a, b) => (b.todoElDia - a.todoElDia) || (a.continua === b.continua ? 0 : a.continua ? -1 : 1) || a.inicio.localeCompare(b.inicio));
  return porDia;
}

export const horaDe = (e) => (e.todoElDia ? 'Todo el día' : e.continua ? `Hasta ${e.fin.slice(11, 16)}` : e.inicio.slice(11, 16));

/** Detalle de un evento (solo lectura). */
export function abrirHojaEvento(e) {
  const { cuerpo } = abrirHojaBase(e.titulo, { mundo: 'accion' });
  const ini = e.inicio.slice(0, 10), finDia = e.todoElDia ? sumarDias(e.fin.slice(0, 10), -1) : e.fin.slice(0, 10);
  const cap = (t) => t.replace(/^./, (c) => c.toUpperCase());
  let cuando;
  if (e.todoElDia) cuando = ini === finDia ? `${cap(etiquetaDia(ini, { relativo: false }))}, todo el día` : `Del ${etiquetaDia(ini, { relativo: false })} al ${etiquetaDia(finDia, { relativo: false })}`;
  else cuando = ini === finDia ? `${cap(etiquetaDia(ini, { relativo: false }))}, de ${e.inicio.slice(11, 16)} a ${e.fin.slice(11, 16)}` : `Del ${etiquetaDia(ini, { relativo: false })} a las ${e.inicio.slice(11, 16)} al ${etiquetaDia(finDia, { relativo: false })} a las ${e.fin.slice(11, 16)}`;
  cuerpo.innerHTML = `
    <div class="evento-detalle">
      <p class="evento-cuando">${escapar(cuando)}</p>
      ${e.lugar ? `<p><span class="suave">Dónde</span><br>${escapar(e.lugar)}</p>` : ''}
      <p class="evento-calendario"><span class="punto" style="--c:${escapar(e.color || '#7aa2f7')}"></span>${escapar(e.calendario || 'Calendario')}</p>
      <p class="ayuda">Viene de tu calendario del iPhone. Para cambiarlo, hazlo allí: Orvia solo lo lee.</p>
    </div>`;
}

// ---------- Gestionar calendarios ----------

const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

/** Panel para conectar, cambiar o quitar calendarios. */
export async function abrirHojaCalendarios() {
  const { cuerpo, cerrar } = abrirHojaBase('Tu calendario', { mundo: 'accion' });
  let lista = [];
  let editando = null; // calendario que se edita, o 'nuevo'
  const estado = { color: COLORES[0][0] };

  const pintar = () => {
    const formulario = editando ? `
      <form class="hoja-form" id="form-calendario" novalidate>
        <div class="campo">
          <label for="cal-nombre">Nombre</label>
          <input id="cal-nombre" maxlength="80" autocomplete="off" placeholder="Personal" value="${escapar(editando === 'nuevo' ? '' : editando.nombre)}">
        </div>
        <div class="campo">
          <label for="cal-url">Enlace del calendario público</label>
          <input id="cal-url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="webcal://p00-caldav.icloud.com/published/2/…" value="${escapar(editando === 'nuevo' ? '' : editando.url)}">
          <p class="ayuda">Solo lo verás tú. Orvia lo usa para leer tus eventos, nunca para cambiarlos.</p>
        </div>
        <div class="campo">
          <span class="etiqueta-campo" id="et-color">Color</span>
          <div class="chips-elegir" role="group" aria-labelledby="et-color">
            ${COLORES.map(([c, n]) => `<button type="button" class="chip-color" data-color="${c}" style="--c:${c}" aria-label="${n}"></button>`).join('')}
          </div>
        </div>
        <button class="boton ancho" type="submit" id="cal-guardar">${editando === 'nuevo' ? 'Conectar calendario' : 'Guardar cambios'}</button>
        ${editando !== 'nuevo' ? '<button class="boton peligro ancho" type="button" id="cal-quitar">Quitar de Orvia</button>' : ''}
        <button class="boton secundario ancho" type="button" id="cal-cancelar">Cancelar</button>
      </form>` : '';

    cuerpo.innerHTML = `
      ${lista.length ? `
        <ul class="lista-calendarios">
          ${lista.map((c) => `
            <li>
              <span class="punto" style="--c:${escapar(c.color)}"></span>
              <span class="lista-calendarios-nombre">${escapar(c.nombre)}${c.activo ? '' : ' <span class="suave">(oculto)</span>'}</span>
              <button class="enlace" type="button" data-alternar="${c.id}">${c.activo ? 'Ocultar' : 'Mostrar'}</button>
              <button class="enlace" type="button" data-editar="${c.id}">Editar</button>
            </li>`).join('')}
        </ul>` : ''}
      ${editando ? formulario : `
        ${lista.length ? '' : '<p class="calendario-intro">Ve tus eventos del iPhone en tu semana, junto a tus tareas. Orvia solo los lee: no cambia nada de tu calendario.</p>'}
        <button class="boton ancho" type="button" id="cal-nuevo">${lista.length ? 'Conectar otro calendario' : 'Conectar un calendario'}</button>
        <details class="calendario-pasos"${lista.length ? '' : ' open'}>
          <summary>Cómo sacar el enlace en el iPhone</summary>
          <ol>
            <li>Abre <strong>Calendario</strong> y toca <strong>Calendarios</strong>, abajo.</li>
            <li>Toca la <strong>ⓘ</strong> del calendario que quieras ver en Orvia.</li>
            <li>Activa <strong>Calendario público</strong>.</li>
            <li>Toca <strong>Compartir enlace</strong> ${ICONO_COMPARTIR} → <strong>Copiar</strong>, y pégalo aquí.</li>
          </ol>
          <p class="ayuda">El enlace es secreto, pero cualquiera que lo tenga puede ver ese calendario: no lo compartas con nadie. Si algún día lo desactivas en el iPhone, Orvia deja de verlo.</p>
        </details>`}`;
    cuerpo.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === estado.color)));
    if (editando) setTimeout(() => cuerpo.querySelector(editando === 'nuevo' ? '#cal-nombre' : '#cal-url')?.focus(), 60);
  };

  const recargar = async () => {
    try { lista = await listarCalendarios(); } catch (e) { aviso(e.message, { error: true }); }
    pintar();
  };
  const cambio = () => { olvidar(); dispatchEvent(new CustomEvent('orvia:accion')); };

  cuerpo.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'cal-nuevo') { editando = 'nuevo'; estado.color = COLORES[lista.length % COLORES.length][0]; pintar(); }
    else if (b.id === 'cal-cancelar') { editando = null; pintar(); }
    else if (b.dataset.editar) { editando = lista.find((c) => c.id === b.dataset.editar); estado.color = editando.color; pintar(); }
    else if (b.dataset.color) { estado.color = b.dataset.color; cuerpo.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
    else if (b.dataset.alternar) {
      const c = lista.find((x) => x.id === b.dataset.alternar);
      try { await actualizar('calendarios', c.id, { activo: !c.activo }); cambio(); await recargar(); } catch (err) { aviso(err.message, { error: true }); }
    } else if (b.id === 'cal-quitar') {
      if (b.dataset.confirmar !== '1') { b.dataset.confirmar = '1'; b.textContent = 'Pulsa otra vez para quitarlo'; return; }
      try {
        await archivar('calendarios', editando.id);
        aviso('Calendario quitado de Orvia');
        editando = null;
        cambio();
        await recargar();
      } catch (err) { aviso(err.message, { error: true }); }
    }
  });

  cuerpo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = cuerpo.querySelector('#cal-nombre').value.trim() || 'Calendario';
    const url = cuerpo.querySelector('#cal-url').value.trim().replace(/\s+/g, '');
    if (!/^(webcal|https):\/\/[^/]*icloud\.com\//i.test(url)) {
      aviso('Pega el enlace de «Calendario público» del iPhone (empieza por webcal://)', { error: true });
      cuerpo.querySelector('#cal-url').focus();
      return;
    }
    const boton = cuerpo.querySelector('#cal-guardar');
    boton.disabled = true;
    try {
      if (editando === 'nuevo') await crear('calendarios', { nombre, url, color: estado.color, activo: true, orden: lista.length });
      else await actualizar('calendarios', editando.id, { nombre, url, color: estado.color });
      aviso(editando === 'nuevo' ? `Calendario conectado: ${nombre}` : 'Cambios guardados');
      editando = null;
      cambio();
      await recargar();
      if (lista.length === 1) cerrar('guardado');
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });

  cuerpo.innerHTML = '<p class="suave">Cargando…</p>';
  await recargar();
}

