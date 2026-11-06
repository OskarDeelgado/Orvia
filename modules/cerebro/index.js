import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'cerebro',
  nombre: 'Segundo cerebro',
  estado: 'pronto',
  async montar(contenedor) {
    contenedor.innerHTML = moduloPendiente({
      fase: 'Llega en marzo y abril de 2027',
      descripcion: 'Tu biblioteca personal: todo lo que sabes, piensas y quieres recordar sobre ti, tus ideas, tus proyectos y tus negocios.',
      incluye: [
        'Sobre ti: quién eres, qué valoras, tu historia y tus preferencias',
        'Ideas y negocios, desde la primera chispa hasta que se convierten en proyecto',
        'Notas, aprendizajes, referencias y diario',
        'Todo enlazado con tus objetivos, proyectos y finanzas',
      ],
    });
  },
};
