// Vista principal de Acción: tu semana.
// - Móvil: tira con los 7 días y la lista del día elegido.
// - Ordenador: los 7 días en columnas; las tareas se pueden arrastrar de un día a otro.
// Debajo, la bandeja «Sin fecha». Las tareas atrasadas aparecen al principio de hoy.

import { escapar, aviso } from '../../core/ui/componentes.js';
import {
  leerSemana, crearTarea, moverTarea, marcarTarea, avisarCambio,
  hoy, lunesDe, sumarDias, diasDeLaSemana, diaCorto, etiquetaDia, rangoSemana, aFecha,
} from './datos.js';
import { abrirHojaTarea } from './hoja.js';
import { pintarHabitosSemana, alClicHabitos } from './habitos.js';

const ICONO_ANTERIOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICONO_SIGUIENTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICONO_NOTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg>';

// Semana y día que estás viendo (se conservan al volver a Acción).
const visto = { lunes: null, dia: null, vista: null };

/** Día que propone el + al crear una tarea: el que estás viendo en Acción, o hoy. */
export const diaPropuesto = () => (visto.vista?.isConnected && visto.dia ? visto.dia : hoy());

export async function montarSemana(contenedor) {
  if (!visto.lunes) { visto.dia = hoy(); visto.lunes = lunesDe(visto.dia); }
  visto.vista = contenedor;
  let datos = null;

  const cargar = async () => {
    try {
      datos = await leerSemana(visto.lunes);
      if (contenedor.isConnected) pintar(contenedor, datos);
    } catch (e) {
      contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
    }
  };
  contenedor.innerHTML = `<p class="suave">Cargando tu semana…</p>`;
  await cargar();

  const irASemana = (lunes, dia) => {
    visto.lunes = lunes;
    visto.dia = dia || lunes;
    cargar();
  };
  const buscar = (id) => {
    if (!datos) return null;
    const todas = [...Object.values(datos.dias).flat(), ...datos.sinFecha, ...datos.atrasadas];
    return todas.find((t) => t.id === id) || null;
  };

  contenedor.addEventListener('click', async (e) => {
    if (e.target.closest('.habitos-semana-caja') && (await alClicHabitos(e))) return;
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.semana) {
      const n = +d.semana;
      if (n === 0) irASemana(lunesDe(hoy()), hoy());
      else irASemana(sumarDias(visto.lunes, 7 * n), sumarDias(visto.dia, 7 * n)); // mismo día de la semana
      return;
    }
    if (d.verDia) {
      visto.dia = d.verDia;
      pintar(contenedor, datos);
      return;
    }
    if (d.marcar) {
      const t = buscar(d.marcar);
      if (!t) return;
      const hecha = t.estado !== 'hecha';
      // Respuesta inmediata en pantalla; después se guarda.
      b.setAttribute('aria-checked', String(hecha));
      b.closest('.tarea')?.classList.toggle('hecha', hecha);
      try {
        await marcarTarea(t, hecha);
        if (hecha) aviso('Hecha ✓');
        avisarCambio();
      } catch (err) {
        aviso(err.message, { error: true });
        avisarCambio();
      }
      return;
    }
    if (d.tarea) {
      const t = buscar(d.tarea);
      if (t) abrirHojaTarea({ tarea: t });
      return;
    }
    if (d.aHoy != null) {
      b.disabled = true;
      try {
        for (const t of datos.atrasadas) await moverTarea(t.id, hoy());
        aviso(`${datos.atrasadas.length === 1 ? 'Tarea pasada' : 'Tareas pasadas'} a hoy`);
        avisarCambio();
      } catch (err) {
        aviso(err.message, { error: true });
        b.disabled = false;
      }
    }
  });

  // Añadir rápido: escribir y pulsar Intro, en un día o en la bandeja.
  contenedor.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-anadir]');
    if (!form) return;
    e.preventDefault();
    const campo = form.querySelector('input');
    const titulo = campo.value.trim();
    if (!titulo) return;
    campo.disabled = true;
    try {
      await crearTarea({ titulo, fecha: form.dataset.anadir || null });
      campo.value = '';
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
    }
    campo.disabled = false;
    // Tras repintar, el foco vuelve al mismo campo para seguir añadiendo.
    setTimeout(() => contenedor.querySelector(`[data-anadir="${form.dataset.anadir}"] input`)?.focus({ preventScroll: true }), 350);
  });

  // Arrastrar y soltar entre días (ordenador).
  contenedor.addEventListener('dragstart', (e) => {
    const t = e.target.closest?.('.tarea[draggable]');
    if (!t) return;
    e.dataTransfer.setData('text/plain', t.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    t.classList.add('arrastrando');
  });
  contenedor.addEventListener('dragend', (e) => e.target.closest?.('.tarea')?.classList.remove('arrastrando'));
  contenedor.addEventListener('dragover', (e) => {
    const zona = e.target.closest('[data-soltar]');
    if (!zona) return;
    e.preventDefault();
    contenedor.querySelectorAll('.soltar-aqui').forEach((z) => z !== zona && z.classList.remove('soltar-aqui'));
    zona.classList.add('soltar-aqui');
  });
  contenedor.addEventListener('dragleave', (e) => {
    const zona = e.target.closest('[data-soltar]');
    if (zona && !zona.contains(e.relatedTarget)) zona.classList.remove('soltar-aqui');
  });
  contenedor.addEventListener('drop', async (e) => {
    const zona = e.target.closest('[data-soltar]');
    if (!zona) return;
    e.preventDefault();
    zona.classList.remove('soltar-aqui');
    const id = e.dataTransfer.getData('text/plain');
    const fecha = zona.dataset.soltar || null;
    const t = buscar(id);
    if (!t || t.fecha === fecha) return;
    try {
      await moverTarea(id, fecha);
      aviso(fecha ? `Movida a ${etiquetaDia(fecha).toLowerCase()}` : 'Movida a «Sin fecha»');
      avisarCambio();
    } catch (err) {
      aviso(err.message, { error: true });
    }
  });

  const alCambiar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:accion', alCambiar);
    cargar();
  };
  addEventListener('orvia:accion', alCambiar);
}

// ---------- Pintar ----------

function pintar(contenedor, datos) {
  const h = hoy();
  const dias = diasDeLaSemana(datos.lunes);
  if (!dias.includes(visto.dia)) visto.dia = dias.includes(h) ? h : dias[0];
  const esEstaSemana = dias.includes(h);
  const pendientes = (d) => datos.dias[d].filter((t) => t.estado !== 'hecha').length + (d === h ? datos.atrasadas.length : 0);
  const totalSemana = dias.reduce((a, d) => a + datos.dias[d].length, 0);
  const hechasSemana = dias.reduce((a, d) => a + datos.dias[d].filter((t) => t.estado === 'hecha').length, 0);
  const desplazamiento = contenedor.querySelector('.tira-dias')?.scrollLeft;

  contenedor.innerHTML = `
        <div class="semana-cabecera">
      <div class="selector-mes selector-semana">
        <button class="boton-icono" type="button" data-semana="-1" aria-label="Semana anterior">${ICONO_ANTERIOR}</button>
        <div class="semana-titulo">
          <h2 aria-live="polite">${escapar(rangoSemana(datos.lunes))}</h2>
          <p class="suave">${totalSemana ? `${hechasSemana} de ${totalSemana} ${totalSemana === 1 ? 'tarea hecha' : 'tareas hechas'}` : esEstaSemana ? 'Esta semana' : 'Sin tareas'}</p>
        </div>
        <button class="boton-icono" type="button" data-semana="1" aria-label="Semana siguiente">${ICONO_SIGUIENTE}</button>
      </div>
      ${esEstaSemana ? '' : '<button class="boton secundario boton-pequeno boton-hoy" type="button" data-semana="0">Volver a hoy</button>'}
    </div>

    <div class="habitos-semana-caja">${contenedor.querySelector('.habitos-semana-caja')?.innerHTML || ''}</div>

    <div class="tira-dias" role="group" aria-label="Días de la semana">
      ${dias.map((d) => {
        const n = pendientes(d);
        return `<button type="button" class="dia-boton${d === h ? ' es-hoy' : ''}" data-ver-dia="${d}" aria-pressed="${d === visto.dia}" aria-label="${escapar(etiquetaDia(d, { relativo: false }))}${n ? `, ${n} pendientes` : ''}">
          <span class="dia-boton-nombre">${diaCorto(d)}</span>
          <span class="dia-boton-numero">${aFecha(d).getDate()}</span>
          <span class="dia-boton-marca">${n ? '<i></i>' : ''}</span>
        </button>`;
      }).join('')}
    </div>

    <div class="semana-dias">
      ${dias.map((d) => columnaDia(d, datos, h)).join('')}
    </div>

    <section class="cristal bandeja" data-soltar="" aria-labelledby="t-bandeja">
      <div class="titulo-con-enlace"><h2 id="t-bandeja">Sin fecha</h2><span class="suave">${datos.sinFecha.length || ''}</span></div>
      <p class="suave">Lo que tienes que hacer pero aún no sabes cuándo. Tócalo para darle un día${matchMedia('(pointer: fine)').matches ? ' o arrástralo a uno' : ''}.</p>
      <ul class="lista-tareas">${datos.sinFecha.map((t) => filaTarea(t, datos)).join('')}</ul>
      ${formAnadir('', 'Añadir a «Sin fecha»')}
    </section>`;

  if (desplazamiento != null) contenedor.querySelector('.tira-dias').scrollLeft = desplazamiento;
  // Los hábitos de la semana se marcan el día que estás viendo (si ya ha llegado).
  pintarHabitosSemana(contenedor.querySelector('.habitos-semana-caja'), { dia: visto.dia });
}

function columnaDia(d, datos, h) {
  // Lo pendiente de días pasados se ve una sola vez: en «Atrasadas», dentro de hoy.
  const pasadoPendiente = d < h ? datos.dias[d].filter((t) => t.estado !== 'hecha').length : 0;
  const tareas = d < h ? datos.dias[d].filter((t) => t.estado === 'hecha') : datos.dias[d];
  const atrasadas = d === h ? datos.atrasadas : [];
  const titulo = etiquetaDia(d);
  const subtitulo = ['Hoy', 'Mañana', 'Ayer'].includes(titulo) ? etiquetaDia(d, { relativo: false }) : '';
  return `
    <section class="cristal dia-columna${d === h ? ' es-hoy' : ''}${d < h ? ' pasado' : ''}" data-dia="${d}" data-soltar="${d}" ${d === visto.dia ? 'data-visible' : ''} aria-label="${escapar(etiquetaDia(d, { relativo: false }))}">
      <header class="dia-columna-cabecera">
        <h3>${escapar(titulo.replace(/^./, (c) => c.toUpperCase()))}</h3>
        ${subtitulo ? `<span class="suave">${escapar(subtitulo)}</span>` : ''}
      </header>
      <header class="dia-columna-cabecera-corta" aria-hidden="true">
        <strong>${diaCorto(d)} ${aFecha(d).getDate()}</strong>${subtitulo ? `<span class="etiqueta-dia">${escapar(titulo)}</span>` : ''}
      </header>
      ${atrasadas.length ? `
        <div class="atrasadas">
          <div class="titulo-con-enlace"><strong>Atrasadas</strong><button class="enlace" type="button" data-a-hoy>Pasar a hoy</button></div>
          <ul class="lista-tareas">${atrasadas.map((t) => filaTarea(t, datos, { conFecha: true })).join('')}</ul>
        </div>` : ''}
      <ul class="lista-tareas">${tareas.map((t) => filaTarea(t, datos)).join('')}</ul>
      ${pasadoPendiente ? `<p class="suave vacio-dia">${pasadoPendiente === 1 ? 'Lo pendiente está' : 'Lo pendiente está'} en «Atrasadas», en hoy</p>`
        : !tareas.length && !atrasadas.length ? `<p class="suave vacio-dia">${d < h ? 'Sin tareas' : 'Nada por ahora'}</p>` : ''}
      ${formAnadir(d, 'Añadir tarea')}
    </section>`;
}

function filaTarea(t, datos, { conFecha = false } = {}) {
  const hecha = t.estado === 'hecha';
  const area = t.area_id ? datos.porArea[t.area_id] : null;
  const detalles = [];
  if (conFecha && t.fecha) detalles.push(`${diaCorto(t.fecha)} ${aFecha(t.fecha).getDate()}`);
  const proyecto = t.proyecto_id ? datos.porProyecto?.[t.proyecto_id] : null;
  if (proyecto) detalles.push(`<span class="tarea-proyecto">${escapar(proyecto.titulo)}</span>`);
  if (area) detalles.push(`<span class="punto" style="--c:var(--area-${area.color})"></span>${escapar(area.nombre)}`);
  return `
    <li class="tarea${hecha ? ' hecha' : ''}${t.prioridad === 1 ? ' alta' : ''}" data-id="${t.id}" draggable="true">
      <button class="casilla" type="button" role="checkbox" aria-checked="${hecha}" data-marcar="${t.id}" aria-label="Marcar «${escapar(t.titulo)}» como ${hecha ? 'pendiente' : 'hecha'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg></button>
      <button class="tarea-texto" type="button" data-tarea="${t.id}">
        <span class="tarea-titulo">${t.prioridad === 1 ? '<span class="tarea-alta" aria-label="Prioridad alta">!</span>' : ''}${escapar(t.titulo)}${t.notas ? ` <span class="tarea-nota" aria-label="Tiene notas">${ICONO_NOTA}</span>` : ''}</span>
        ${detalles.length ? `<span class="tarea-detalle">${detalles.join(' · ')}</span>` : ''}
      </button>
    </li>`;
}

const formAnadir = (fecha, texto) => `
  <form class="anadir-rapido" data-anadir="${fecha}" autocomplete="off">
    <span aria-hidden="true">+</span>
    <input type="text" maxlength="300" placeholder="${escapar(texto)}" aria-label="${escapar(texto)}${fecha ? ' el ' + escapar(etiquetaDia(fecha, { relativo: false })) : ''}" enterkeyhint="done">
  </form>`;
