// Panel para crear o editar una tarea: título, día, prioridad, área y notas.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import { listarAreas } from '../../core/areas.js';
import { crearTarea, guardarTarea, eliminarTarea, hoy, sumarDias, etiquetaDia, avisarCambio } from './datos.js';

const PRIORIDADES = [[1, 'Alta'], [2, 'Normal'], [3, 'Baja']];

/**
 * @param {object} [o]
 * @param {object} [o.tarea]  la tarea a editar (si no, se crea una)
 * @param {string|null} [o.fecha]  día propuesto para una tarea nueva (null = sin fecha)
 */
export async function abrirHojaTarea({ tarea = null, fecha } = {}) {
  const areas = await listarAreas().catch(() => []);
  const editando = !!tarea;
  const estado = {
    fecha: editando ? tarea.fecha : fecha === undefined ? hoy() : fecha,
    prioridad: editando ? tarea.prioridad : 2,
    area: editando ? tarea.area_id : null,
  };
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar tarea' : 'Nueva tarea', { mundo: 'accion' });
  const h = hoy();
  const atajos = [[h, 'Hoy'], [sumarDias(h, 1), 'Mañana'], [null, 'Sin fecha']];

  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-tarea" novalidate>
      <div class="campo">
        <label for="tarea-titulo">Qué tienes que hacer</label>
        <input id="tarea-titulo" maxlength="300" autocomplete="off" placeholder="Llamar al banco" value="${escapar(tarea?.titulo || '')}">
      </div>
      <div class="campo">
        <span class="etiqueta-campo" id="et-dia">Día</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-dia">
          ${atajos.map(([v, l]) => `<button type="button" class="chip-opcion" data-dia="${v ?? ''}">${l}</button>`).join('')}
          <input type="date" id="tarea-fecha" class="chip-fecha" aria-label="Otro día" value="${estado.fecha || ''}">
        </div>
        <p class="ayuda" id="tarea-dia-texto" aria-live="polite"></p>
      </div>
      <div class="campo">
        <span class="etiqueta-campo" id="et-prio">Prioridad</span>
        <div class="segmentos" role="group" aria-labelledby="et-prio">
          ${PRIORIDADES.map(([v, l]) => `<button type="button" class="segmento" data-prioridad="${v}">${l}</button>`).join('')}
        </div>
      </div>
      ${areas.length ? `<div class="campo">
        <span class="etiqueta-campo" id="et-area">Área de tu vida (opcional)</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-area">
          ${areas.map((a) => `<button type="button" class="chip-opcion chip-area" data-area="${a.id}" style="--c:var(--area-${a.color})"><span class="punto" style="--c:var(--area-${a.color})"></span>${escapar(a.nombre)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="campo">
        <label for="tarea-notas">Notas (opcional)</label>
        <textarea id="tarea-notas" rows="2" maxlength="2000">${escapar(tarea?.notas || '')}</textarea>
      </div>
      <button class="boton ancho" type="submit" id="tarea-guardar">${editando ? 'Guardar cambios' : 'Añadir tarea'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="tarea-eliminar">Eliminar tarea</button>' : ''}
    </form>`;

  const $ = (s) => cuerpo.querySelector(s);
  const pintarEstado = () => {
    cuerpo.querySelectorAll('[data-dia]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.dia || null) === estado.fecha)));
    $('#tarea-fecha').value = estado.fecha || '';
    $('#tarea-dia-texto').textContent = estado.fecha ? etiquetaDia(estado.fecha, { relativo: false }).replace(/^./, (c) => c.toUpperCase()) : 'Irá a la bandeja «Sin fecha»';
    cuerpo.querySelectorAll('[data-prioridad]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.prioridad === estado.prioridad)));
    cuerpo.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.area === estado.area)));
  };
  pintarEstado();
  setTimeout(() => { if (!editando) $('#tarea-titulo').focus(); }, 80);

  cuerpo.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dia !== undefined) { estado.fecha = b.dataset.dia || null; pintarEstado(); }
    else if (b.dataset.prioridad) { estado.prioridad = +b.dataset.prioridad; pintarEstado(); }
    else if (b.dataset.area) { estado.area = estado.area === b.dataset.area ? null : b.dataset.area; pintarEstado(); }
    else if (b.id === 'tarea-eliminar') {
      if (b.dataset.confirmar !== '1') {
        b.dataset.confirmar = '1';
        b.textContent = 'Pulsa otra vez para eliminar';
        setTimeout(() => { if (b.isConnected) { b.dataset.confirmar = ''; b.textContent = 'Eliminar tarea'; } }, 4000);
        return;
      }
      b.disabled = true;
      try {
        await eliminarTarea(tarea.id);
        aviso('Tarea eliminada');
        cerrar('guardado');
        avisarCambio();
      } catch (err) {
        aviso(err.message, { error: true });
        b.disabled = false;
      }
    }
  });
  $('#tarea-fecha').addEventListener('change', (e) => { estado.fecha = e.target.value || null; pintarEstado(); });

  $('#form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = $('#tarea-titulo').value.trim();
    if (!titulo) { aviso('Escribe qué tienes que hacer', { error: true }); $('#tarea-titulo').focus(); return; }
    const datos = { titulo, fecha: estado.fecha, prioridad: estado.prioridad, area_id: estado.area, notas: $('#tarea-notas').value.trim() || null };
    const boton = $('#tarea-guardar');
    boton.disabled = true;
    try {
      if (editando) await guardarTarea(tarea.id, datos);
      else await crearTarea(datos);
      aviso(editando ? 'Cambios guardados' : datos.fecha ? `Tarea añadida: ${etiquetaDia(datos.fecha).toLowerCase()}` : 'Tarea añadida a «Sin fecha»');
      cerrar('guardado');
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });
}
