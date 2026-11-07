import { escapar, aviso } from '../../core/ui/componentes.js';
import { listar } from '../../core/db.js';
import { montarConfiguracion } from './configuracion.js';
import { montarMes, fechaPropuesta } from './mes.js';
import { generarRecurrentes } from './datos.js';

// Pestañas de Finanzas, en el orden de Sobrea. Inicio, Sobrante, Ahorro y Análisis
// llegan en los bloques 4 y 5; Configuración pasará a ser Ajustes en el bloque 6.
const PESTANAS = [
  { id: 'mes', nombre: 'Mes', montar: montarMes },
  { id: 'configuracion', nombre: 'Configuración', montar: montarConfiguracion },
];
let pestanaActual = 'mes';

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
  // Lo que hace el botón + desde cualquier pantalla de Orvia.
  accionRapida: {
    etiqueta: 'Apuntar un movimiento',
    // Como en Sobrea: si estás viendo un mes, propone su fecha (hoy si es el actual).
    ejecutar: () => import('./hoja.js').then((h) => h.abrirHojaGasto({ fecha: fechaPropuesta() })),
  },

  async montar(contenedor) {
    contenedor.innerHTML = '<p class="suave">Cargando Finanzas…</p>';
    let hayConfig = false;
    try {
      hayConfig = (await listar('fin_config')).length > 0;
    } catch {
      // Si la tabla aún no existe, la pantalla de configuración explica qué hacer.
    }
    if (!hayConfig) {
      await montarConfiguracion(contenedor);
      return;
    }

    // Apunta los recurrentes que tocan desde la última vez.
    generarRecurrentes()
      .then((n) => n && aviso(n === 1 ? 'Se ha apuntado 1 gasto recurrente' : `Se han apuntado ${n} gastos recurrentes`))
      .catch(() => {});

    contenedor.innerHTML = `
      <div class="pestanas" role="tablist" aria-label="Secciones de Finanzas">
        ${PESTANAS.map((p) => `<button role="tab" type="button" id="pestana-${p.id}" data-pestana="${p.id}" aria-selected="${p.id === pestanaActual}" aria-controls="panel-finanzas">${escapar(p.nombre)}</button>`).join('')}
      </div>
      <div id="panel-finanzas" role="tabpanel" aria-labelledby="pestana-${pestanaActual}"></div>`;
    let panel = contenedor.querySelector('#panel-finanzas');
    const mostrar = (id) => {
      pestanaActual = id;
      contenedor.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pestana === id)));
      // Cada pestaña recibe un contenedor nuevo, así lo que escuchaba la anterior se suelta.
      const nuevo = panel.cloneNode(false);
      panel.replaceWith(nuevo);
      panel = nuevo;
      panel.setAttribute('aria-labelledby', `pestana-${id}`);
      PESTANAS.find((p) => p.id === id).montar(panel);
    };
    contenedor.querySelector('.pestanas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pestana]');
      if (b && b.dataset.pestana !== pestanaActual) mostrar(b.dataset.pestana);
    });
    mostrar(pestanaActual);
  },
};
