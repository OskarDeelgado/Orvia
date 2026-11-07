import { montarConfiguracion } from './configuracion.js';

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
  // Bloque 1: configuración inicial. Las pantallas del día a día llegan en los bloques siguientes.
  async montar(contenedor) {
    await montarConfiguracion(contenedor);
  },
};
