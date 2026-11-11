// Módulo Acción (Endrick): lo que haces.
// Bloque 1: tu semana con tareas y la bandeja «Sin fecha».
// Bloque 2: hábitos con XP, niveles, rachas por semanas, comodín y logros.
// Llegan después: proyectos (con presupuesto enlazado a Finanzas) y tu calendario.

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
    tarea: 'Organiza tu semana: tareas y hábitos con niveles.',
    situacion: 'Tu semana ya está en marcha',
  },
  // Lo que ofrece el botón + desde cualquier pantalla.
  accionRapida: {
    etiqueta: 'Nueva tarea',
    ruta: 'tarea',
    ejecutar: () => import('./hoja.js').then((h) => h.abrirHojaTarea({ fecha: diaPropuesto() })),
  },
  // Atajos del iPhone que guardan algo y abren Orvia: #/pasos?n=8432 (desde la app Salud).
  atajos: {
    pasos: async (params) => {
      const { apuntarPasosDesdeAtajo } = await import('./habitos.js');
      await apuntarPasosDesdeAtajo(params);
      return '#/accion/habitos';
    },
  },
  // #/accion → tu semana · #/accion/habitos → hábitos con niveles
  async montar(contenedor, { sub } = {}) {
    if (sub === 'habitos') {
      const { montarHabitos } = await import('./habitos.js');
      await montarHabitos(contenedor);
    } else {
      await montarSemana(contenedor);
    }
  },
};
