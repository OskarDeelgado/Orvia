// Paneles del Segundo cerebro: escribir o editar una nota, y crear o editar un grupo de aprendizajes.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import {
  TIPOS, ESTADOS, SECCIONES, TIPOS_GRUPO, leerCerebro, crearNota, guardarNota, eliminarNota,
  crearGrupo, guardarGrupo, eliminarGrupo, leerEtiquetas, avisarCerebro,
} from './datos.js';

function confirmarBorrado(b, texto, accion) {
  if (b.dataset.confirmar !== '1') {
    b.dataset.confirmar = '1';
    const antes = b.textContent;
    b.textContent = texto;
    setTimeout(() => { if (b.isConnected) { b.dataset.confirmar = ''; b.textContent = antes; } }, 4000);
    return;
  }
  b.disabled = true;
  accion().catch((err) => { aviso(err.message, { error: true }); b.disabled = false; });
}

/**
 * Escribir una nota nueva o editar una.
 * @param {object} [o]
 * @param {object} [o.nota]     nota a editar
 * @param {string} [o.tipo]     tipo propuesto para una nueva
 * @param {string} [o.grupo]    grupo propuesto (aprendizajes)
 * @param {string} [o.seccion]  sección propuesta (sobre ti)
 */
export async function abrirHojaNota({ nota = null, tipo = 'idea', grupo = null, seccion = 'reflexiones' } = {}) {
  const datos = await leerCerebro().catch(() => ({ grupos: [], areas: [] }));
  const editando = !!nota;
  const estado = {
    tipo: nota?.tipo || tipo,
    estado: nota?.estado || 'bruto',
    seccion: nota?.seccion || seccion,
    grupo: nota ? nota.grupo_id : grupo,
    area: nota?.area_id || null,
    grupoNuevo: false,
    tipoGrupo: 'curso',
  };
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar nota' : 'Nueva nota', { mundo: 'cerebro' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-nota" novalidate>
      <div class="campo">
        <span class="etiqueta-campo" id="et-ntipo">Tipo</span>
        <div class="segmentos" role="group" aria-labelledby="et-ntipo">
          ${Object.entries(TIPOS).map(([v, t]) => `<button type="button" class="segmento" data-tipo="${v}"><span class="punto" style="--c:${t.color}"></span>${t.nombre}</button>`).join('')}
        </div>
      </div>
      <div class="campo">
        <label for="nota-titulo">Título</label>
        <input id="nota-titulo" maxlength="200" autocomplete="off" value="${escapar(nota?.titulo || '')}">
      </div>
      <div class="campo">
        <label for="nota-contenido">Texto</label>
        <div class="barra-formato" role="group" aria-label="Formato">
          <button type="button" data-formato="negrita"><strong>N</strong><span class="visualmente-oculto"> Negrita</span></button>
          <button type="button" data-formato="lista">• Lista</button>
          <button type="button" data-formato="titulo">Título</button>
        </div>
        <textarea id="nota-contenido" rows="9" maxlength="50000" placeholder="Escribe sin preocuparte del formato.">${escapar(nota?.contenido || '')}</textarea>
      </div>

      <div class="campo" data-solo="idea">
        <span class="etiqueta-campo" id="et-nestado">Estado de la idea</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-nestado">
          ${ESTADOS.map(([v, l]) => `<button type="button" class="chip-opcion" data-estado="${v}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="campo" data-solo="aprendizaje">
        <span class="etiqueta-campo" id="et-ngrupo">Grupo (curso, libro o tema)</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-ngrupo">
          <button type="button" class="chip-opcion" data-grupo="">Sin grupo</button>
          ${datos.grupos.map((g) => `<button type="button" class="chip-opcion" data-grupo="${g.id}">${escapar(g.nombre)}</button>`).join('')}
          <button type="button" class="chip-opcion" data-grupo-nuevo>+ Nuevo grupo</button>
        </div>
        <div class="grupo-nuevo" id="grupo-nuevo" hidden>
          <label for="grupo-nombre" class="visualmente-oculto">Nombre del grupo nuevo</label>
          <input id="grupo-nombre" maxlength="120" autocomplete="off" placeholder="Nombre: Excel Intermedio, Inversión…">
          <div class="segmentos" role="group" aria-label="Tipo de grupo">
            ${TIPOS_GRUPO.map(([v, l]) => `<button type="button" class="segmento" data-tipo-grupo="${v}">${l}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="campo" data-solo="sobre_mi">
        <span class="etiqueta-campo" id="et-nseccion">Sección</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-nseccion">
          ${SECCIONES.map(([v, l]) => `<button type="button" class="chip-opcion" data-seccion="${v}">${l}</button>`).join('')}
        </div>
      </div>

      <div class="campo">
        <label for="nota-etiquetas">Etiquetas (opcional, separadas por comas)</label>
        <input id="nota-etiquetas" autocomplete="off" autocapitalize="off" placeholder="negocio, excel" value="${escapar((nota?.etiquetas || []).join(', '))}">
      </div>
      ${datos.areas.length ? `<div class="campo">
        <span class="etiqueta-campo" id="et-narea">Área de tu vida (opcional)</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-narea">
          ${datos.areas.map((a) => `<button type="button" class="chip-opcion chip-area" data-area="${a.id}"><span class="punto" style="--c:var(--area-${a.color})"></span>${escapar(a.nombre)}</button>`).join('')}
        </div>
      </div>` : ''}
      <button class="boton ancho" type="submit" id="nota-guardar">${editando ? 'Guardar cambios' : 'Guardar nota'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="nota-eliminar">Eliminar nota</button>' : ''}
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  const marcar = (sel, clave, valor) => cuerpo.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset[clave] || null) === (valor || null))));
  const pintar = () => {
    marcar('[data-tipo]', 'tipo', estado.tipo);
    marcar('[data-estado]', 'estado', estado.estado);
    marcar('[data-seccion]', 'seccion', estado.seccion);
    marcar('[data-area]', 'area', estado.area);
    marcar('[data-tipo-grupo]', 'tipoGrupo', estado.tipoGrupo);
    cuerpo.querySelectorAll('[data-grupo]').forEach((b) => b.setAttribute('aria-pressed', String(!estado.grupoNuevo && (b.dataset.grupo || null) === (estado.grupo || null))));
    $('[data-grupo-nuevo]').setAttribute('aria-pressed', String(estado.grupoNuevo));
    $('#grupo-nuevo').hidden = !estado.grupoNuevo;
    cuerpo.querySelectorAll('[data-solo]').forEach((c) => { c.hidden = c.dataset.solo !== estado.tipo; });
  };
  pintar();
  setTimeout(() => { if (!editando) $('#nota-titulo').focus(); }, 80);

  // Botones de formato: escriben las marcas en el texto.
  const formato = (cual) => {
    const t = $('#nota-contenido');
    const { selectionStart: a, selectionEnd: b, value: v } = t;
    const sel = v.slice(a, b);
    let nuevo, cursorA, cursorB;
    if (cual === 'negrita') {
      nuevo = `**${sel || 'texto'}**`;
      cursorA = a + 2; cursorB = a + 2 + (sel || 'texto').length;
    } else {
      const marca = cual === 'lista' ? '- ' : '# ';
      const inicio = v.lastIndexOf('\n', a - 1) + 1;
      const bloque = v.slice(inicio, b) || '';
      const cambiado = bloque.split('\n').map((l) => marca + l.replace(/^(#{1,2}|[-•*])\s+/, '')).join('\n');
      t.setRangeText(cambiado, inicio, b, 'end');
      t.focus();
      return;
    }
    t.setRangeText(nuevo, a, b, 'select');
    t.setSelectionRange(cursorA, cursorB);
    t.focus();
  };

  cuerpo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.formato) return formato(d.formato);
    if (d.tipo) estado.tipo = d.tipo;
    else if (d.estado) estado.estado = d.estado;
    else if (d.seccion) estado.seccion = d.seccion;
    else if (d.tipoGrupo) estado.tipoGrupo = d.tipoGrupo;
    else if (d.area) estado.area = estado.area === d.area ? null : d.area;
    else if (d.grupoNuevo != null) { estado.grupoNuevo = true; pintar(); $('#grupo-nombre').focus(); return; }
    else if (d.grupo != null) { estado.grupo = d.grupo || null; estado.grupoNuevo = false; }
    else if (b.id === 'nota-eliminar') {
      return confirmarBorrado(b, 'Pulsa otra vez para eliminarla', async () => {
        await eliminarNota(nota.id);
        aviso('Nota eliminada');
        cerrar('guardado');
        if (/^#\/cerebro\/nota\//.test(location.hash)) history.back();
        avisarCerebro();
      });
    } else return;
    pintar();
  });

  $('#form-nota').addEventListener('submit', async (e) => {
    e.preventDefault();
    const contenido = $('#nota-contenido').value.trim();
    // Sin título, vale la primera línea del texto.
    const titulo = $('#nota-titulo').value.trim() || contenido.split('\n')[0].replace(/^(#{1,2}|[-•*])\s+/, '').replace(/\*\*/g, '').slice(0, 80).trim();
    if (!titulo) { aviso('Escribe un título o algo de texto', { error: true }); $('#nota-titulo').focus(); return; }
    const boton = $('#nota-guardar');
    boton.disabled = true;
    try {
      let grupoId = estado.grupo;
      if (estado.tipo === 'aprendizaje' && estado.grupoNuevo) {
        const nombre = $('#grupo-nombre').value.trim();
        if (!nombre) { aviso('Ponle nombre al grupo nuevo', { error: true }); $('#grupo-nombre').focus(); boton.disabled = false; return; }
        const repetido = datos.grupos.find((g) => g.nombre.toLowerCase() === nombre.toLowerCase());
        grupoId = repetido ? repetido.id : (await crearGrupo({ nombre, tipo: estado.tipoGrupo, orden: datos.grupos.length })).id;
      }
      const campos = {
        titulo, contenido, tipo: estado.tipo, estado: estado.estado, seccion: estado.seccion, grupo_id: grupoId,
        area_id: estado.area, etiquetas: leerEtiquetas($('#nota-etiquetas').value),
        fijada: nota?.fijada || false, proyecto_id: nota?.proyecto_id || null,
      };
      if (editando) await guardarNota(nota.id, campos);
      else await crearNota(campos);
      aviso(editando ? 'Cambios guardados' : `${TIPOS[estado.tipo].nombre} guardada en tu biblioteca`.replace('Aprendizaje guardada', 'Aprendizaje guardado').replace('Sobre ti guardada', 'Nota guardada'));
      cerrar('guardado');
      avisarCerebro();
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });
}

/** Crear o editar un grupo de aprendizajes (un curso, un libro, un tema). */
export async function abrirHojaGrupo({ grupo = null } = {}) {
  const datos = await leerCerebro().catch(() => ({ grupos: [], proyectos: [] }));
  const editando = !!grupo;
  const estado = { tipo: grupo?.tipo || 'curso', proyecto: grupo?.proyecto_id || null };
  const proyectos = datos.proyectos.filter((p) => p.estado !== 'cancelado');
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar grupo' : 'Nuevo grupo', { mundo: 'cerebro' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-grupo" novalidate>
      <div class="campo">
        <label for="gr-nombre">Nombre</label>
        <input id="gr-nombre" maxlength="120" autocomplete="off" placeholder="Excel Intermedio" value="${escapar(grupo?.nombre || '')}">
      </div>
      <div class="campo">
        <span class="etiqueta-campo" id="et-gtipo">Qué es</span>
        <div class="segmentos" role="group" aria-labelledby="et-gtipo">
          ${TIPOS_GRUPO.map(([v, l]) => `<button type="button" class="segmento" data-tipo="${v}">${l}</button>`).join('')}
        </div>
      </div>
      ${proyectos.length ? `<div class="campo">
        <span class="etiqueta-campo" id="et-gproyecto">Proyecto de Acción (opcional)</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-gproyecto">
          ${proyectos.map((p) => `<button type="button" class="chip-opcion" data-proyecto="${p.id}">${escapar(p.titulo)}</button>`).join('')}
        </div>
        <p class="ayuda">Si este grupo es de un curso que llevas como proyecto, enlázalo para saltar de uno a otro.</p>
      </div>` : ''}
      <button class="boton ancho" type="submit" id="gr-guardar">${editando ? 'Guardar cambios' : 'Crear grupo'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="gr-eliminar">Eliminar grupo</button>' : ''}
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  const pintar = () => {
    cuerpo.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === estado.tipo)));
    cuerpo.querySelectorAll('[data-proyecto]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.proyecto === estado.proyecto)));
  };
  pintar();
  setTimeout(() => { if (!editando) $('#gr-nombre').focus(); }, 80);
  cuerpo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tipo) { estado.tipo = b.dataset.tipo; pintar(); }
    else if (b.dataset.proyecto) { estado.proyecto = estado.proyecto === b.dataset.proyecto ? null : b.dataset.proyecto; pintar(); }
    else if (b.id === 'gr-eliminar') {
      confirmarBorrado(b, 'Pulsa otra vez: sus notas pasan a «Sin grupo»', async () => {
        await eliminarGrupo(grupo.id);
        aviso('Grupo eliminado');
        cerrar('guardado');
        avisarCerebro();
      });
    }
  });
  $('#form-grupo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#gr-nombre').value.trim();
    if (!nombre) { aviso('Ponle nombre al grupo', { error: true }); $('#gr-nombre').focus(); return; }
    $('#gr-guardar').disabled = true;
    try {
      if (editando) await guardarGrupo(grupo.id, { nombre, tipo: estado.tipo, proyecto_id: estado.proyecto });
      else await crearGrupo({ nombre, tipo: estado.tipo, proyecto_id: estado.proyecto, orden: datos.grupos.length });
      aviso(editando ? 'Cambios guardados' : `Grupo creado: ${nombre}`);
      cerrar('guardado');
      avisarCerebro();
    } catch (err) {
      aviso(err.message, { error: true });
      $('#gr-guardar').disabled = false;
    }
  });
}
