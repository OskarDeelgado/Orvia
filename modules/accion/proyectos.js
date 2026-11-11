// Proyectos (Acción, bloque 3): cosas con un final, divididas en hitos y tareas.
// #/accion/proyectos         lista por estado (en marcha, ideas, en pausa, terminados)
// #/accion/proyectos/<id>    la ficha: hitos con sus tareas y las tareas «sin hito»
// Las tareas con fecha salen además en tu semana, con el nombre del proyecto.
// Las tareas de proyecto sin fecha viven solo aquí (no llenan la bandeja «Sin fecha»).

import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import {
  leerProyectos, crearProyecto, guardarProyecto, eliminarProyecto,
  crearHito, guardarHito, eliminarHito, crearTarea, marcarTarea, avisarCambio,
  hoy, aFecha, MESES, diaCorto,
} from './datos.js';
import { abrirHojaTarea } from './hoja.js';

export const TIPOS = [
  ['emprendimiento', 'Emprendimiento'],
  ['formacion', 'Formación'],
  ['general', 'Personal'],
];
const nombreTipo = (t) => (TIPOS.find(([v]) => v === t) || [null, t === 'laboral' ? 'Trabajo' : t === 'viaje' ? 'Viaje' : 'Personal'])[1];
const ESTADOS = [
  ['activo', 'En marcha'],
  ['idea', 'Idea'],
  ['pausado', 'En pausa'],
  ['terminado', 'Terminado'],
];
const GRUPOS = [
  ['activo', 'En marcha'],
  ['idea', 'Ideas'],
  ['pausado', 'En pausa'],
];

const ICONO_NOTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg>';

/** «20 nov», o «20 nov 2027» si no es de este año. */
export function fechaCorta(t) {
  const d = aFecha(t);
  const anio = d.getFullYear() !== aFecha(hoy()).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}${anio}`;
}

// Proyecto que estás viendo: el + crea la tarea dentro de él.
const visto = { id: null, vista: null };
export const proyectoVisto = () => (visto.vista?.isConnected ? visto.id : null);

// ---------- Cálculos ----------

const hitosDe = (datos, p) => datos.hitos
  .filter((h) => h.proyecto_id === p.id)
  .sort((a, b) => a.orden - b.orden || String(a.fecha || '9').localeCompare(String(b.fecha || '9')) || String(a.creado).localeCompare(String(b.creado)));

const ordenTareas = (a, b) => (a.estado === 'hecha') - (b.estado === 'hecha')
  || String(a.fecha || '9').localeCompare(String(b.fecha || '9')) || a.prioridad - b.prioridad
  || String(a.creado).localeCompare(String(b.creado));

function resumenProyecto(datos, p) {
  const hitos = hitosDe(datos, p);
  const idsHitos = new Set(hitos.map((h) => h.id));
  const tareas = datos.tareas.filter((t) => t.proyecto_id === p.id);
  const hechas = tareas.filter((t) => t.estado === 'hecha').length;
  const h0 = hoy();
  const atrasadas = tareas.filter((t) => t.estado !== 'hecha' && t.fecha && t.fecha < h0).length;
  const porHito = hitos.map((h) => {
    const ts = tareas.filter((t) => t.hito_id === h.id).sort(ordenTareas);
    return { hito: h, tareas: ts, hechas: ts.filter((t) => t.estado === 'hecha').length, logrado: !!h.completado_en };
  });
  const sinHito = tareas.filter((t) => !t.hito_id || !idsHitos.has(t.hito_id)).sort(ordenTareas);
  const proximo = porHito.find((x) => !x.logrado) || null;
  const logrados = porHito.filter((x) => x.logrado).length;
  // El progreso cuenta tareas; si aún no hay tareas, cuenta hitos logrados.
  const progreso = tareas.length ? hechas / tareas.length : hitos.length ? logrados / hitos.length : 0;
  return { proyecto: p, hitos, tareas, hechas, atrasadas, porHito, sinHito, proximo, logrados, progreso };
}

// ---------- Montar ----------

export async function montarProyectos(contenedor, id = null) {
  visto.id = id;
  visto.vista = contenedor;
  let datos = null;
  const cargar = async () => {
    try {
      datos = await leerProyectos();
    } catch (e) {
      contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
      return;
    }
    if (!contenedor.isConnected) return;
    const p = id && datos.proyectos.find((x) => x.id === id);
    if (id && !p) {
      contenedor.innerHTML = `<p class="suave">Este proyecto ya no existe.</p><a class="enlace" href="#/accion/proyectos">Ver tus proyectos</a>`;
      return;
    }
    if (p) pintarFicha(contenedor, datos, resumenProyecto(datos, p));
    else pintarLista(contenedor, datos);
  };
  contenedor.innerHTML = `<p class="suave">Cargando tus proyectos…</p>`;
  await cargar();

  const buscarTarea = (tid) => datos?.tareas.find((t) => t.id === tid);
  const buscarHito = (hid) => datos?.hitos.find((h) => h.id === hid);
  const proyecto = () => datos?.proyectos.find((x) => x.id === id);

  contenedor.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.nuevoProyecto != null) return abrirHojaProyecto({ datos });
    if (d.editarProyecto != null) return abrirHojaProyecto({ proyecto: proyecto(), datos });
    if (d.editarHito) return abrirHojaHito(buscarHito(d.editarHito));
    if (d.tarea) {
      const t = buscarTarea(d.tarea);
      if (t) abrirHojaTarea({ tarea: t });
      return;
    }
    if (d.marcar) {
      const t = buscarTarea(d.marcar);
      if (!t) return;
      const hecha = t.estado !== 'hecha';
      b.setAttribute('aria-checked', String(hecha));
      b.closest('.tarea')?.classList.toggle('hecha', hecha);
      try {
        await marcarTarea(t, hecha);
        // ¿Era la última del hito? Se propone darlo por logrado.
        const h = t.hito_id && buscarHito(t.hito_id);
        const quedan = h && datos.tareas.filter((x) => x.hito_id === h.id && x.id !== t.id && x.estado !== 'hecha').length;
        if (hecha && h && !h.completado_en && quedan === 0) aviso(`Todo hecho en «${h.titulo}». Márcalo como logrado ✓`);
        else if (hecha) aviso('Hecha ✓');
      } catch (err) {
        aviso(err.message, { error: true });
      }
      avisarCambio();
      return;
    }
    if (d.hitoLogrado) {
      const h = buscarHito(d.hitoLogrado);
      if (!h) return;
      const logrado = !h.completado_en;
      b.setAttribute('aria-checked', String(logrado));
      try {
        await guardarHito(h.id, { completado_en: logrado ? new Date().toISOString() : null });
        if (logrado) aviso(`Hito logrado: ${h.titulo} ✓`);
      } catch (err) {
        aviso(err.message, { error: true });
      }
      avisarCambio();
      return;
    }
    if (d.estadoProyecto) {
      try {
        await guardarProyecto(id, { estado: d.estadoProyecto });
        aviso(d.estadoProyecto === 'terminado' ? 'Proyecto terminado. ¡Bien hecho!' : 'Proyecto en marcha de nuevo');
      } catch (err) {
        aviso(err.message, { error: true });
      }
      avisarCambio();
    }
  });

  // Añadir rápido: tarea en un hito (o sin hito) y hito nuevo.
  contenedor.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-anadir-tarea], [data-anadir-hito]');
    if (!form) return;
    e.preventDefault();
    const campo = form.querySelector('input');
    const titulo = campo.value.trim();
    if (!titulo) return;
    campo.disabled = true;
    const clave = form.dataset.anadirTarea != null ? `[data-anadir-tarea="${form.dataset.anadirTarea}"]` : '[data-anadir-hito]';
    try {
      if (form.dataset.anadirHito != null) {
        const orden = Math.max(0, ...datos.hitos.filter((h) => h.proyecto_id === id).map((h) => h.orden + 1));
        await crearHito({ proyecto_id: id, titulo, orden });
      } else {
        await crearTarea({ titulo, proyecto_id: id, hito_id: form.dataset.anadirTarea || null });
      }
      campo.value = '';
    } catch (err) {
      aviso(err.message, { error: true });
    }
    campo.disabled = false;
    avisarCambio();
    setTimeout(() => contenedor.querySelector(`${clave} input`)?.focus({ preventScroll: true }), 350);
  });

  const alCambiar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:accion', alCambiar);
    cargar();
  };
  addEventListener('orvia:accion', alCambiar);
}

// ---------- Lista ----------

function pintarLista(contenedor, datos) {
  const resumenes = datos.proyectos.map((p) => resumenProyecto(datos, p));
  const grupo = (estado) => resumenes.filter((r) => r.proyecto.estado === estado);
  const terminados = resumenes.filter((r) => ['terminado', 'cancelado'].includes(r.proyecto.estado));

  contenedor.innerHTML = `
        <div class="titulo-con-enlace proyectos-cabecera">
      <h2>Tus proyectos</h2>
      <button class="boton boton-pequeno" type="button" data-nuevo-proyecto>Nuevo proyecto</button>
    </div>
    ${!resumenes.length ? `
      <section class="cristal proyectos-vacio">
        <h3>Algo con un final</h3>
        <p class="suave">Un proyecto es lo que quieres terminar: lanzar Sobrea, sacarte el curso de Excel… Divídelo en 2–5 hitos y apunta tareas en cada uno. Las que tengan fecha aparecerán en tu semana.</p>
        <button class="boton" type="button" data-nuevo-proyecto>Crear tu primer proyecto</button>
      </section>` : ''}
    ${GRUPOS.map(([estado, titulo]) => {
      const rs = grupo(estado);
      return rs.length ? `
        <section class="grupo-proyectos" aria-labelledby="g-${estado}">
          <h3 id="g-${estado}" class="grupo-titulo">${titulo} <span class="suave">${rs.length}</span></h3>
          <div class="proyectos-rejilla">${rs.map(tarjetaProyecto).join('')}</div>
        </section>` : '';
    }).join('')}
    ${terminados.length ? `
      <details class="grupo-proyectos terminados">
        <summary class="grupo-titulo">Terminados <span class="suave">${terminados.length}</span></summary>
        <div class="proyectos-rejilla">${terminados.map(tarjetaProyecto).join('')}</div>
      </details>` : ''}`;
}

function tarjetaProyecto(r) {
  const p = r.proyecto;
  const pct = Math.round(r.progreso * 100);
  const pie = [];
  if (r.tareas.length) pie.push(`${r.hechas} de ${r.tareas.length} tareas`);
  else if (r.hitos.length) pie.push(`${r.logrados} de ${r.hitos.length} hitos`);
  else pie.push('Sin hitos todavía');
  if (r.atrasadas) pie.push(`<span class="atrasada">${r.atrasadas} ${r.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>`);
  return `
    <a class="cristal proyecto-tarjeta tipo-${escapar(p.tipo)}" href="#/accion/proyectos/${p.id}">
      <div class="proyecto-tarjeta-cabeza">
        <span class="chip-tipo">${escapar(nombreTipo(p.tipo))}</span>
        ${p.fecha_fin ? `<span class="suave">Hasta el ${fechaCorta(p.fecha_fin)}</span>` : ''}
      </div>
      <h4>${escapar(p.titulo)}</h4>
      ${r.proximo ? `<p class="proyecto-proximo"><span class="suave">Siguiente hito</span> ${escapar(r.proximo.hito.titulo)}${r.proximo.hito.fecha ? ` · <span class="${r.proximo.hito.fecha < hoy() ? 'atrasada' : ''}">${fechaCorta(r.proximo.hito.fecha)}</span>` : ''}</p>` : ''}
      <div class="barra-proyecto" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso"><i style="width:${pct}%"></i></div>
      <div class="proyecto-pie"><span>${pie.join(' · ')}</span><strong>${pct}%</strong></div>
    </a>`;
}

// ---------- Ficha ----------

function pintarFicha(contenedor, datos, r) {
  const p = r.proyecto;
  const pct = Math.round(r.progreso * 100);
  const area = p.area_id ? datos.porArea[p.area_id] : null;
  const fechas = [p.fecha_inicio && `Desde el ${fechaCorta(p.fecha_inicio)}`, p.fecha_fin && `hasta el ${fechaCorta(p.fecha_fin)}`].filter(Boolean).join(' ');
  const terminado = p.estado === 'terminado';
  const todoHecho = r.tareas.length > 0 && r.hechas === r.tareas.length && r.porHito.every((x) => x.logrado || !x.tareas.length);

  contenedor.innerHTML = `
        <a class="volver-semana" href="#/accion/proyectos">‹ Proyectos</a>

    <section class="cristal proyecto-ficha tipo-${escapar(p.tipo)}" aria-labelledby="p-titulo">
      <div class="proyecto-ficha-cabeza">
        <div class="proyecto-chips">
          <span class="chip-tipo">${escapar(nombreTipo(p.tipo))}</span>
          <span class="chip-estado estado-${escapar(p.estado)}">${escapar((ESTADOS.find(([v]) => v === p.estado) || [0, p.estado])[1])}</span>
          ${area ? `<span class="tarea-detalle"><span class="punto" style="--c:var(--area-${area.color})"></span>${escapar(area.nombre)}</span>` : ''}
        </div>
        <button class="enlace" type="button" data-editar-proyecto>Editar</button>
      </div>
      <h2 id="p-titulo">${escapar(p.titulo)}</h2>
      ${p.descripcion ? `<p class="proyecto-descripcion">${escapar(p.descripcion)}</p>` : ''}
      ${fechas ? `<p class="suave">${fechas.replace(/^./, (c) => c.toUpperCase())}</p>` : ''}
      <div class="proyecto-progreso">
        <div class="barra-proyecto grande" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso del proyecto"><i style="width:${pct}%"></i></div>
        <strong>${pct}%</strong>
      </div>
      <p class="suave">${r.hitos.length ? `${r.logrados} de ${r.hitos.length} hitos logrados · ` : ''}${r.hechas} de ${r.tareas.length} tareas${r.atrasadas ? ` · <span class="atrasada">${r.atrasadas} ${r.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}</p>
      ${todoHecho && !terminado ? '<button class="boton ancho" type="button" data-estado-proyecto="terminado">Dar el proyecto por terminado</button>' : ''}
      ${terminado ? '<button class="boton secundario ancho" type="button" data-estado-proyecto="activo">Volver a ponerlo en marcha</button>' : ''}
    </section>

    <div class="hitos">
      ${r.porHito.map((x, i) => bloqueHito(x, i)).join('')}
      ${r.sinHito.length || !r.hitos.length ? `
        <section class="cristal hito sin-hito" aria-labelledby="h-sin">
          <header class="hito-cabecera"><div class="hito-info"><h3 id="h-sin">${r.hitos.length ? 'Sin hito' : 'Tareas'}</h3>
            <span class="suave">${r.hitos.length ? 'Tareas del proyecto que no van en ningún hito' : 'Añade tareas aquí o divide el proyecto en hitos'}</span></div></header>
          <ul class="lista-tareas">${r.sinHito.map(filaTarea).join('')}</ul>
          ${formAnadir('', 'Añadir tarea')}
        </section>` : ''}
    </div>

    <form class="anadir-rapido anadir-hito" data-anadir-hito autocomplete="off">
      <span aria-hidden="true">+</span>
      <input type="text" maxlength="200" placeholder="Añadir hito" aria-label="Nuevo hito" enterkeyhint="done">
    </form>`;
}

function bloqueHito(x, i) {
  const h = x.hito;
  const pct = x.tareas.length ? Math.round((x.hechas / x.tareas.length) * 100) : x.logrado ? 100 : 0;
  const h0 = hoy();
  const vencido = !x.logrado && h.fecha && h.fecha < h0;
  const detalle = [
    h.fecha ? `<span class="${vencido ? 'atrasada' : ''}">${vencido ? 'Era para el' : 'Para el'} ${fechaCorta(h.fecha)}</span>` : '',
    x.tareas.length ? `${x.hechas} de ${x.tareas.length} tareas` : 'Sin tareas',
  ].filter(Boolean).join(' · ');
  return `
    <section class="cristal hito${x.logrado ? ' logrado' : ''}" aria-labelledby="h-${h.id}">
      <header class="hito-cabecera">
        <button class="casilla casilla-hito" type="button" role="checkbox" aria-checked="${x.logrado}" data-hito-logrado="${h.id}" aria-label="Marcar el hito «${escapar(h.titulo)}» como ${x.logrado ? 'pendiente' : 'logrado'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg></button>
        <div class="hito-info">
          <h3 id="h-${h.id}"><span class="hito-numero" aria-hidden="true">${i + 1}</span>${escapar(h.titulo)}</h3>
          <span class="suave">${detalle}</span>
        </div>
        <button class="enlace" type="button" data-editar-hito="${h.id}">Editar</button>
      </header>
      ${x.tareas.length ? `<div class="barra-proyecto fina" aria-hidden="true"><i style="width:${pct}%"></i></div>` : ''}
      <ul class="lista-tareas">${x.tareas.map(filaTarea).join('')}</ul>
      ${x.logrado ? '' : formAnadir(h.id, 'Añadir tarea a este hito')}
    </section>`;
}

function filaTarea(t) {
  const hecha = t.estado === 'hecha';
  const h0 = hoy();
  const detalles = [];
  if (t.fecha) detalles.push(`<span class="${!hecha && t.fecha < h0 ? 'atrasada' : ''}">${t.fecha === h0 ? 'Hoy' : `${diaCorto(t.fecha)} ${fechaCorta(t.fecha)}`}</span>`);
  return `
    <li class="tarea${hecha ? ' hecha' : ''}${t.prioridad === 1 ? ' alta' : ''}" data-id="${t.id}">
      <button class="casilla" type="button" role="checkbox" aria-checked="${hecha}" data-marcar="${t.id}" aria-label="Marcar «${escapar(t.titulo)}» como ${hecha ? 'pendiente' : 'hecha'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg></button>
      <button class="tarea-texto" type="button" data-tarea="${t.id}">
        <span class="tarea-titulo">${t.prioridad === 1 ? '<span class="tarea-alta" aria-label="Prioridad alta">!</span>' : ''}${escapar(t.titulo)}${t.notas ? ` <span class="tarea-nota" aria-label="Tiene notas">${ICONO_NOTA}</span>` : ''}</span>
        <span class="tarea-detalle">${detalles.length ? detalles.join(' · ') : 'Sin fecha · tócala para planificarla'}</span>
      </button>
    </li>`;
}

const formAnadir = (hito, texto) => `
  <form class="anadir-rapido" data-anadir-tarea="${hito}" autocomplete="off">
    <span aria-hidden="true">+</span>
    <input type="text" maxlength="300" placeholder="${escapar(texto)}" aria-label="${escapar(texto)}" enterkeyhint="done">
  </form>`;

// ---------- Paneles ----------

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

/** Crear o editar un proyecto. Al crearlo se pueden escribir sus hitos, uno por línea. */
export function abrirHojaProyecto({ proyecto = null, datos } = {}) {
  const editando = !!proyecto;
  const areas = datos?.areas || [];
  const estado = { tipo: proyecto?.tipo || 'emprendimiento', estado: proyecto?.estado || 'activo', area: proyecto?.area_id || null };
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar proyecto' : 'Nuevo proyecto', { mundo: 'accion' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-proyecto" novalidate>
      <div class="campo">
        <label for="pr-titulo">Nombre</label>
        <input id="pr-titulo" maxlength="200" autocomplete="off" placeholder="Lanzar Sobrea" value="${escapar(proyecto?.titulo || '')}">
      </div>
      <div class="campo">
        <span class="etiqueta-campo" id="et-tipo">Tipo</span>
        <div class="segmentos" role="group" aria-labelledby="et-tipo">
          ${TIPOS.map(([v, l]) => `<button type="button" class="segmento" data-tipo="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="campo">
        <span class="etiqueta-campo" id="et-estado">Estado</span>
        <div class="segmentos" role="group" aria-labelledby="et-estado">
          ${ESTADOS.map(([v, l]) => `<button type="button" class="segmento" data-estado="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="campo">
        <label for="pr-desc">Qué quieres conseguir (opcional)</label>
        <textarea id="pr-desc" rows="2" maxlength="2000" placeholder="Tener la app publicada y 10 personas usándola">${escapar(proyecto?.descripcion || '')}</textarea>
      </div>
      <div class="dos-campos">
        <div class="campo"><label for="pr-inicio">Empieza (opcional)</label><input type="date" id="pr-inicio" value="${proyecto?.fecha_inicio || ''}"></div>
        <div class="campo"><label for="pr-fin">Fecha límite (opcional)</label><input type="date" id="pr-fin" value="${proyecto?.fecha_fin || ''}"></div>
      </div>
      ${areas.length ? `<div class="campo">
        <span class="etiqueta-campo" id="et-parea">Área de tu vida (opcional)</span>
        <div class="chips-elegir" role="group" aria-labelledby="et-parea">
          ${areas.map((a) => `<button type="button" class="chip-opcion chip-area" data-area="${a.id}"><span class="punto" style="--c:var(--area-${a.color})"></span>${escapar(a.nombre)}</button>`).join('')}
        </div>
      </div>` : ''}
      ${editando ? '' : `<div class="campo">
        <label for="pr-hitos">Hitos (opcional, uno por línea)</label>
        <textarea id="pr-hitos" rows="4" maxlength="2000" placeholder="Diseño cerrado&#10;Primera versión&#10;Publicada en la web"></textarea>
        <p class="ayuda">Las etapas del proyecto. Luego puedes añadir más, ponerles fecha y meter tareas en cada una.</p>
      </div>`}
      <button class="boton ancho" type="submit" id="pr-guardar">${editando ? 'Guardar cambios' : 'Crear proyecto'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="pr-eliminar">Eliminar proyecto</button>' : ''}
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  const pintarEstado = () => {
    cuerpo.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === estado.tipo)));
    cuerpo.querySelectorAll('[data-estado]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.estado === estado.estado)));
    cuerpo.querySelectorAll('[data-area]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.area === estado.area)));
  };
  pintarEstado();
  setTimeout(() => { if (!editando) $('#pr-titulo').focus(); }, 80);

  cuerpo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tipo) { estado.tipo = b.dataset.tipo; pintarEstado(); }
    else if (b.dataset.estado) { estado.estado = b.dataset.estado; pintarEstado(); }
    else if (b.dataset.area) { estado.area = estado.area === b.dataset.area ? null : b.dataset.area; pintarEstado(); }
    else if (b.id === 'pr-eliminar') {
      confirmarBorrado(b, 'Pulsa otra vez: se borran sus hitos y tareas', async () => {
        await eliminarProyecto(proyecto.id);
        aviso('Proyecto eliminado');
        cerrar('guardado');
        location.hash = '#/accion/proyectos';
        avisarCambio();
      });
    }
  });

  $('#form-proyecto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = $('#pr-titulo').value.trim();
    if (!titulo) { aviso('Ponle un nombre al proyecto', { error: true }); $('#pr-titulo').focus(); return; }
    const inicio = $('#pr-inicio').value || null;
    const fin = $('#pr-fin').value || null;
    if (inicio && fin && fin < inicio) { aviso('La fecha límite no puede ser anterior al inicio', { error: true }); return; }
    const cambios = { titulo, tipo: estado.tipo, estado: estado.estado, descripcion: $('#pr-desc').value.trim() || null, fecha_inicio: inicio, fecha_fin: fin, area_id: estado.area };
    const boton = $('#pr-guardar');
    boton.disabled = true;
    try {
      if (editando) {
        await guardarProyecto(proyecto.id, cambios);
        aviso('Cambios guardados');
        cerrar('guardado');
        avisarCambio();
      } else {
        const orden = Math.max(0, ...(datos?.proyectos || []).map((p) => (p.orden || 0) + 1));
        const nuevo = await crearProyecto({ ...cambios, orden });
        const fila = Array.isArray(nuevo) ? nuevo[0] : nuevo;
        const hitos = $('#pr-hitos').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20);
        for (const [i, t] of hitos.entries()) await crearHito({ proyecto_id: fila.id, titulo: t.slice(0, 200), orden: i });
        aviso(`Proyecto creado: ${titulo}`);
        cerrar('guardado');
        location.hash = `#/accion/proyectos/${fila.id}`;
      }
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });
}

/** Editar un hito: nombre, fecha objetivo o eliminarlo (sus tareas pasan a «Sin hito»). */
function abrirHojaHito(hito) {
  if (!hito) return;
  const { cuerpo, cerrar } = abrirHojaBase('Editar hito', { mundo: 'accion' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-hito" novalidate>
      <div class="campo">
        <label for="hi-titulo">Hito</label>
        <input id="hi-titulo" maxlength="200" autocomplete="off" value="${escapar(hito.titulo)}">
      </div>
      <div class="campo">
        <label for="hi-fecha">Para cuándo (opcional)</label>
        <input type="date" id="hi-fecha" value="${hito.fecha || ''}">
      </div>
      <button class="boton ancho" type="submit">Guardar cambios</button>
      <button class="boton peligro ancho" type="button" id="hi-eliminar">Eliminar hito</button>
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  $('#hi-eliminar').addEventListener('click', (e) => confirmarBorrado(e.currentTarget, 'Pulsa otra vez: sus tareas pasan a «Sin hito»', async () => {
    await eliminarHito(hito.id);
    aviso('Hito eliminado');
    cerrar('guardado');
    avisarCambio();
  }));
  $('#form-hito').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = $('#hi-titulo').value.trim();
    if (!titulo) { aviso('Escribe el nombre del hito', { error: true }); return; }
    try {
      await guardarHito(hito.id, { titulo, fecha: $('#hi-fecha').value || null });
      aviso('Cambios guardados');
      cerrar('guardado');
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
    }
  });
}
