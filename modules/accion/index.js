import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'accion',
  nombre: 'Acción',
  estado: 'pronto',
  async montar(contenedor) {
    contenedor.innerHTML = moduloPendiente({
      fase: 'Llega en enero y febrero de 2027',
      descripcion: 'Aquí organizarás qué quieres conseguir y qué vas a hacer cada semana para lograrlo.',
      incluye: [
        'Objetivos a corto, medio y largo plazo',
        'Proyectos: también viajes, formaciones y proyectos laborales',
        'Tareas y hábitos',
        'Planificador semanal',
      ],
    });
  },
};
