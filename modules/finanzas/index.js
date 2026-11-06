import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'finanzas',
  nombre: 'Finanzas',
  // 'activo': bola brillante en la órbita. 'pronto': bola atenuada.
  estado: 'activo',
  async montar(contenedor) {
    contenedor.innerHTML = moduloPendiente({
      fase: 'En construcción · listo antes del 20 de diciembre',
      descripcion: 'Tu presupuesto por sobres, el mismo método de Sobrea, sincronizado entre el móvil y el ordenador.',
      incluye: [
        'Te queda para gastar este mes, con su anillo',
        'Sobres, categorías y reparto del sueldo',
        'Movimientos, recurrentes y Sobrante común',
        'Huchas, objetivos de ahorro e inversiones',
        'Exportación de los movimientos del mes a tu plantilla Excel',
      ],
    });
  },
};
