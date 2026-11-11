// Módulo Acción (Endrick): lo que haces.
// Bloque 1: tu semana con tareas y la bandeja «Sin fecha».
// Llegan después: hábitos, proyectos (con presupuesto enlazado a Finanzas) y tu calendario.

import { montarSemana, diaPropuesto } from './semana.js';

export default {
  id: 'accion',
  nombre: 'Acción',
  estado: 'activo',
  // Responsable del módulo en la oficina y en el panel del móvil.
  agente: {
    nombre: 'Endrick',
    puesto: 'Jefe de operaciones',
    color: '#4ade80',
    tarea: 'Organiza tu semana: tareas, hábitos y proyectos.',
    situacion: 'Tu semana ya está en marcha',
  },
  // Lo que ofrece el botón + desde cualquier pantalla.
  accionRapida: {
    etiqueta: 'Nueva tarea',
    ruta: 'tarea',
    ejecutar: () => import('./hoja.js').then((h) => h.abrirHojaTarea({ fecha: diaPropuesto() })),
  },
  async montar(contenedor) {
    await montarSemana(contenedor);
  },
};
