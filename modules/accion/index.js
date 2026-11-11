// Módulo Acción (Endrick): lo que haces.
// Bloque 1: tu semana con tareas y la bandeja «Sin fecha».
// Bloque 2: hábitos con XP, niveles, rachas por semanas, comodín y logros.
// Bloque 3: proyectos con hitos y tareas (las que tienen fecha salen en tu semana).
// Llega después: tu calendario del iPhone.

import { montarSemana, diaPropuesto } from './semana.js';
import { navAccion } from './nav.js';

export default {
  id: 'accion',
  nombre: 'Acción',
  estado: 'activo',
  // Responsable del módulo en la oficina y en el panel del móvil.
  agente: {
    nombre: 'Endrick',
    puesto: 'Jefe de operaciones',
    color: '#4ade80',
    tarea: 'Organiza tu semana: tareas, proyectos y hábitos con niveles.',
    situacion: 'Tu semana ya está en marcha',
  },
  // Lo que ofrece el botón + desde cualquier pantalla.
  accionRapida: {
    etiqueta: 'Nueva tarea',
    ruta: 'tarea',
    // Dentro de un proyecto, la tarea nueva va a ese proyecto.
    ejecutar: async () => {
      const [{ abrirHojaTarea }, { proyectoVisto }] = await Promise.all([import('./hoja.js'), import('./proyectos.js')]);
      const proyecto = proyectoVisto();
      return proyecto ? abrirHojaTarea({ proyecto }) : abrirHojaTarea({ fecha: diaPropuesto() });
    },
  },
  // Atajos del iPhone que guardan algo y abren Orvia: #/pasos?n=8432 (desde la app Salud).
  atajos: {
    pasos: async (params) => {
      const { apuntarPasosDesdeAtajo } = await import('./habitos.js');
      await apuntarPasosDesdeAtajo(params);
      return '#/accion/habitos';
    },
  },
  // #/accion → tu semana · #/accion/habitos → hábitos · #/accion/proyectos[/<id>] → proyectos
  async montar(contenedor, { sub } = {}) {
    const seccion = sub === 'proyectos' || sub === 'habitos' ? sub : 'semana';
    contenedor.innerHTML = `${navAccion(seccion)}<div id="panel-accion" data-vista="${seccion}"></div>`;
    const panel = contenedor.querySelector('#panel-accion');
    if (seccion === 'proyectos') {
      const id = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[2] || null;
      const { montarProyectos } = await import('./proyectos.js');
      await montarProyectos(panel, id);
    } else if (seccion === 'habitos') {
      const { montarHabitos } = await import('./habitos.js');
      await montarHabitos(panel);
    } else {
      await montarSemana(panel);
    }
  },
};
