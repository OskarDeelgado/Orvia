// Una nota abierta: se lee con su formato, se fija y, si es una idea, se cambia su estado
// con un toque. Para cambiar el texto, «Editar» abre el panel de la nota.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { TIPOS, ESTADOS, SECCIONES, nombreDe, cambiarNota, avisarCerebro, hace, plazoDe, tareasDeNota, enlazarTarea } from './datos.js';
import { fechaCorta, hoy } from '../accion/fechas.js';
import { pintarTexto } from './formato.js';
import { abrirHojaNota } from './hoja.js';

const ICONO_FIJAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 .5 4.5L13 20l-3.5-3.5L4 22l-.5-.5 5.5-5.5L5.5 12.5 7 11l4.5.5 4-4z"/></svg>';
const VOLVER = { idea: ['#/cerebro/ideas', 'Ideas'], aprendizaje: ['#/cerebro/aprendizajes', 'Aprendizajes'], sobre_mi: ['#/cerebro/sobre-ti', 'Sobre ti'] };

export function pintarNota(contenedor, n, datos) {
  const t = TIPOS[n.tipo] || TIPOS.idea;
  const [ruta, nombre] = VOLVER[n.tipo] || ['#/cerebro', 'Biblioteca'];
  const grupo = datos.porGrupo[n.grupo_id];
  const area = datos.porArea[n.area_id];
  const proyecto = datos.porProyecto[n.proyecto_id];
  const subtitulo = n.tipo === 'aprendizaje' ? (grupo ? escapar(grupo.nombre) : 'Sin grupo')
    : n.tipo === 'sobre_mi' ? `${nombreDe(SECCIONES, n.seccion || 'reflexiones')}${n.horizonte ? ` · a ${plazoDe(n.horizonte)}` : ''}` : '';
  contenedor.innerHTML = `
    <article class="nota-abierta" style="--tipo:${t.color}">
      <div class="nota-barra">
        <a class="volver-semana" href="${ruta}">‹ ${nombre}</a>
        <div class="nota-barra-botones">
          <button class="boton-icono${n.fijada ? ' activo' : ''}" type="button" data-fijar aria-pressed="${!!n.fijada}" aria-label="${n.fijada ? 'Quitar de fijadas' : 'Fijar arriba en la biblioteca'}">${ICONO_FIJAR}</button>
          <button class="boton secundario boton-pequeno" type="button" data-editar-nota>Editar</button>
        </div>
      </div>
      <p class="nota-tipo">${t.nombre}${subtitulo ? ` · ${subtitulo}` : ''}</p>
      <h2 class="nota-abierta-titulo">${escapar(n.titulo)}</h2>
      ${n.tipo === 'idea' ? `
        <div class="filtros-tipo" role="group" aria-label="Estado de la idea">
          ${ESTADOS.map(([v, l]) => `<button type="button" class="chip-filtro" data-estado-idea="${v}" aria-pressed="${(n.estado || 'bruto') === v}">${l}</button>`).join('')}
        </div>` : ''}
      ${n.contenido ? `<div class="nota-texto">${pintarTexto(n.contenido)}</div>` : '<p class="suave">Sin texto todavía. Pulsa «Editar» para escribir.</p>'}
      <div class="nota-pie">
        ${(n.etiquetas || []).map((e) => `<span class="etiqueta">#${escapar(e)}</span>`).join('')}
        ${area ? `<span class="nota-area"><span class="punto" style="--c:var(--area-${area.color})"></span>${escapar(area.nombre)}</span>` : ''}
      </div>
      ${proyecto ? `<a class="grupo-proyecto" href="#/accion/proyectos/${proyecto.id}">Proyecto en Acción: ${escapar(proyecto.titulo)}</a>` : ''}
      ${n.tipo === 'idea' && !proyecto && n.estado !== 'descartada' ? `
        <div class="nota-convertir">
          <button class="boton ancho boton-convertir" type="button" data-convertir>Convertir en proyecto</button>
          <p class="suave">Se crea en Acción con este texto como descripción. La idea queda como «Lanzada» y enlazada al proyecto.</p>
        </div>` : ''}
      <section class="nota-tareas" aria-labelledby="t-nota-tareas">
        <div class="titulo-con-enlace">
          <h3 id="t-nota-tareas">Tareas de esta nota</h3>
          <button class="enlace" type="button" data-crear-tarea>+ Crear tarea</button>
        </div>
        <div id="nota-tareas-lista"></div>
      </section>
      <p class="suave nota-fechas">Creada ${hace(n.creado)}${n.modificado && String(n.modificado).slice(0, 16) !== String(n.creado).slice(0, 16) ? ` · cambiada ${hace(n.modificado)}` : ''}</p>
    </article>`;
  pintarTareas(contenedor, n.id);
}

// Las tareas llegan después que la nota, para no retrasar la lectura.
async function pintarTareas(contenedor, notaId) {
  const caja = contenedor.querySelector('#nota-tareas-lista');
  if (!caja) return;
  let tareas = [];
  try { tareas = await tareasDeNota(notaId); } catch { /* sin enlaces: se queda vacío */ }
  if (!caja.isConnected) return;
  const h = hoy();
  caja.innerHTML = tareas.length ? tareas.map((t) => `
    <a class="fila-nota tarea-de-nota${t.estado === 'hecha' ? ' hecha' : ''}" href="${t.proyecto_id ? `#/accion/proyectos/${t.proyecto_id}` : '#/accion'}">
      <span class="fila-nota-titulo">${escapar(t.titulo)}</span>
      <span class="suave">${t.estado === 'hecha' ? 'Hecha ✓' : t.fecha ? (t.fecha === h ? 'Para hoy' : `${t.fecha < h ? 'Era para el' : 'Para el'} ${fechaCorta(t.fecha)}`) : 'Sin fecha'}</span>
    </a>`).join('') : '<p class="suave">¿Esta nota pide hacer algo? Crea la tarea y aparecerá en Acción.</p>';
}

/** Clics dentro de una nota abierta. Devuelve true si lo ha atendido. */
export async function alClicNota(e, datos, id) {
  const b = e.target.closest('button');
  const n = datos?.notas.find((x) => x.id === id);
  if (!b || !n) return false;
  const d = b.dataset;
  try {
    if (d.editarNota != null) { abrirHojaNota({ nota: n }); return true; }
    if (d.crearTarea != null) {
      const { abrirHojaTarea } = await import('../accion/hoja.js');
      // Si la nota ya tiene proyecto (una idea lanzada, o un aprendizaje de un curso), se propone.
      const proyecto = datos.porProyecto[n.proyecto_id]?.id || datos.porProyecto[datos.porGrupo[n.grupo_id]?.proyecto_id]?.id || null;
      abrirHojaTarea({
        proyecto,
        inicial: { notas: `De tu nota «${n.titulo}»`, area_id: n.area_id },
        alCrear: async (tarea) => { await enlazarTarea(n.id, tarea.id); avisarCerebro(); },
      });
      return true;
    }
    if (d.convertir != null) {
      const { abrirHojaProyecto } = await import('../accion/proyectos.js');
      abrirHojaProyecto({
        datos: { areas: datos.areas, proyectos: datos.proyectos },
        inicial: { titulo: n.titulo, descripcion: String(n.contenido || '').replace(/\*\*/g, '').replace(/^#{1,2}\s+/gm, '').slice(0, 1900).trim(), tipo: 'emprendimiento', area_id: n.area_id },
        alCrear: (proyecto) => cambiarNota(n.id, { proyecto_id: proyecto.id, estado: 'lanzada' }),
      });
      return true;
    }
    if (d.fijar != null) {
      const fijar = !n.fijada;
      await cambiarNota(n.id, { fijada: fijar });
      aviso(fijar ? 'Fijada arriba en tu biblioteca' : 'Ya no está fijada');
      avisarCerebro();
      return true;
    }
    if (d.estadoIdea) {
      if (d.estadoIdea !== (n.estado || 'bruto')) {
        await cambiarNota(n.id, { estado: d.estadoIdea });
        aviso(`Idea: ${nombreDe(ESTADOS, d.estadoIdea).toLowerCase()}`);
        avisarCerebro();
      }
      return true;
    }
  } catch (err) {
    aviso(err.message, { error: true });
    return true;
  }
  return false;
}
