import { escapar, aviso } from '../../core/ui/componentes.js';
import { listar } from '../../core/db.js';
import { montarConfiguracion } from './configuracion.js';
import { montarMes, fechaPropuesta } from './mes.js';
import { montarInicio } from './inicio.js';
import { montarAnalisis } from './analisis.js';
import { montarSobrante } from './sobrante.js';
import { montarAjustes } from './ajustes.js';
import { montarAhorro } from './ahorro.js';
import { revisarCierres } from './objetivos.js';
import { generarRecurrentes } from './datos.js';

// Pestañas de Finanzas, en el orden de Sobrea.
const PESTANAS = [
  { id: 'inicio', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="8" rx="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2"/><rect x="3.5" y="14.5" width="7" height="6" rx="2"/></svg>', nombre: 'Inicio', montar: montarInicio },
  { id: 'mes', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>', nombre: 'Mes', montar: montarMes },
  { id: 'sobrante', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg>', nombre: 'Sobrante', montar: montarSobrante },
  { id: 'ahorro', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 17l5.5-6 4 3.5 7-8"/><path d="M15 6.5h5.5V12"/></svg>', nombre: 'Ahorro', montar: montarAhorro },
  { id: 'analisis', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V12M12 20V5M19 20v-5"/></svg>', nombre: 'Análisis', montar: montarAnalisis },
  { id: 'ajustes', icono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>', nombre: 'Ajustes', montar: montarAjustes },
];
let pestanaActual = 'inicio';

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
      <div class="pestanas barra-inferior" role="tablist" aria-label="Secciones de Finanzas">
        ${PESTANAS.map((p) => `<button role="tab" type="button" id="pestana-${p.id}" data-pestana="${p.id}" aria-selected="${p.id === pestanaActual}" aria-controls="panel-finanzas">${p.icono}<span>${escapar(p.nombre)}</span></button>`).join('')}
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
      panel.dataset.vista = id; // el diseño de ordenador reparte cada pestaña en columnas
      PESTANAS.find((p) => p.id === id).montar(panel);
    };
    contenedor.querySelector('.pestanas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pestana]');
      if (b && b.dataset.pestana !== pestanaActual) mostrar(b.dataset.pestana);
    });
    mostrar(pestanaActual);

    // Los enlaces de Inicio ("Ver el mes", "Gestionar"…) cambian de pestaña.
    const alIr = (e) => {
      if (!contenedor.isConnected) return removeEventListener('orvia:finanzas-pestana', alIr);
      if (PESTANAS.some((p) => p.id === e.detail)) {
        mostrar(e.detail);
        scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    addEventListener('orvia:finanzas-pestana', alIr);

    // Como Sobrea: si algún objetivo tiene un mes terminado sin cerrar, lo pregunta.
    setTimeout(revisarCierres, 500);
  },
};
