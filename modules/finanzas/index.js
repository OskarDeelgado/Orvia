import { moduloPendiente } from '../../core/ui/componentes.js';

export default {
  id: 'finanzas',
  nombre: 'Finanzas',
  // 'activo': módulo en marcha o en construcción. 'pronto': aún en preparación.
  estado: 'activo',
  // Responsable del módulo en la oficina y en el panel del móvil.
  agente: {
    nombre: 'Zack',
    puesto: 'Director financiero',
    color: '#818cf8',
    tarea: 'Lleva tus sobres, el Sobrante, el ahorro y las inversiones.',
    situacion: 'En construcción · lista en diciembre',
  },
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
