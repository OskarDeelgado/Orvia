import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'conocimiento',
  nombre: 'Conocimiento',
  icono: 'conocimiento',
  async montar(contenedor) {
    contenedor.innerHTML = moduloPendiente({
      titulo: 'Conocimiento',
      fase: 'Fase 2 · marzo y abril de 2027',
      descripcion: 'Tu Second Brain: lo que aprendes y lo que se te ocurre, enlazado con tus objetivos y proyectos.',
      incluye: [
        'Notas, ideas y aprendizajes',
        'Referencias y diario',
        'Enlaces con cualquier objetivo, proyecto o tarea',
      ],
    });
  },
};
