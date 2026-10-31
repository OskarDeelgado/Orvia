import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'finanzas',
  nombre: 'Finanzas',
  icono: 'finanzas',
  async montar(contenedor) {
    contenedor.innerHTML = moduloPendiente({
      titulo: 'Finanzas',
      fase: 'Fase 1a · antes del 20 de diciembre',
      descripcion: 'Tu presupuesto por sobres, el mismo método de Sobrea, sincronizado entre el móvil y el ordenador.',
      incluye: [
        'Sobres, categorías y reparto del sueldo',
        'Movimientos y gastos recurrentes',
        'Huchas, objetivos de ahorro e inversiones',
        'Gráficos y exportación a Excel y PDF',
      ],
    });
  },
};
