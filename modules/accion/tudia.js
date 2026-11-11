// Tarjeta «Tu día» de Endrick, para el Panel (móvil) y el lateral de la oficina (ordenador).
// Próximo evento, tareas de hoy (se marcan aquí mismo) y hábitos de la semana (también).

import { escapar, aviso } from '../../core/ui/componentes.js';
import { marcarTarea, avisarCambio, fechaCorta } from './datos.js';
import { leerResumenDia, situacionDe } from './resumen.js';
import { horaDe, abrirHojaEvento } from './calendario.js';
import { pintarHabitosSemana, alClicHabitos } from './habitos.js';

const MAX_TAREAS = 4;

/**
 * Monta la tarjeta en `caja` y la mantiene al día.
 * @param {HTMLElement} caja
 * @param {{alResumen?: (resumen) => void}} [o]  recibe el resumen cada vez que cambia (oficina y ficha)
 */
export function montarTuDia(caja, { alResumen } = {}) {
  let resumen = null;

  const pintar = async () => {
    try {
      resumen = await leerResumenDia();
    } catch (e) {
      caja.innerHTML = `<p class="suave">No se pudo leer tu día: ${escapar(e.message)}</p>`;
      return;
    }
    if (!caja.isConnected) return;
    alResumen?.(resumen);
    const r = resumen;
    const vistas = r.tareas.slice(0, MAX_TAREAS);
    const resto = r.tareas.length - vistas.length;
    const p = r.proximo;
    caja.innerHTML = `
      <div class="tu-dia-cabecera">
        <span class="avatar-mini" aria-hidden="true">E</span>
        <div><h2 id="t-tu-dia">Tu día</h2><span class="suave">Endrick · ${escapar(situacionDe(r))}</span></div>
        ${r.nivel && r.habitos.length ? `<a class="chip-nivel" href="#/accion/habitos" aria-label="Hábitos: nivel ${r.nivel.nivel}"><span>${r.nivel.nivel}</span>Nivel</a>` : ''}
      </div>

      ${p ? `
        <button type="button" class="tu-dia-evento" data-evento-hoy style="--c:${escapar(p.color || '#7aa2f7')}">
          <span class="tu-dia-evento-hora">${escapar(p.todoElDia ? 'Hoy' : p.inicio.slice(11, 16) <= new Date().toTimeString().slice(0, 5) ? 'Ahora' : p.inicio.slice(11, 16))}</span>
          <span class="tu-dia-evento-texto"><strong>${escapar(p.titulo)}</strong><span class="suave">${escapar([horaDe(p) === 'Todo el día' ? 'Todo el día' : `${p.inicio.slice(11, 16)}–${p.fin.slice(11, 16)}`, p.lugar].filter(Boolean).join(' · '))}</span></span>
          ${r.masEventos ? `<span class="suave tu-dia-mas" aria-label="y ${r.masEventos} más hoy">+${r.masEventos}</span>` : ''}
        </button>` : r.conCalendario ? '<p class="suave tu-dia-nada">No te quedan eventos hoy.</p>' : ''}

      <div class="tu-dia-tareas">
        ${vistas.length ? `<ul class="lista-tareas">${vistas.map((t) => `
          <li class="tarea${t.prioridad === 1 ? ' alta' : ''}">
            <button class="casilla" type="button" role="checkbox" aria-checked="false" data-marcar-hoy="${t.id}" aria-label="Marcar «${escapar(t.titulo)}» como hecha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg></button>
            <a class="tarea-texto" href="#/accion">
              <span class="tarea-titulo">${t.prioridad === 1 ? '<span class="tarea-alta" aria-label="Prioridad alta">!</span>' : ''}${escapar(t.titulo)}</span>
              ${t.atrasada || t.proyecto ? `<span class="tarea-detalle">${[t.atrasada ? `<span class="atrasada">Era para el ${fechaCorta(t.fecha)}</span>` : '', t.proyecto ? `<span class="tarea-proyecto">${escapar(t.proyecto)}</span>` : ''].filter(Boolean).join(' · ')}</span>` : ''}
            </a>
          </li>`).join('')}</ul>` : `<p class="suave tu-dia-nada">${r.hechasHoy ? `Todo hecho hoy (${r.hechasHoy}) ✓` : 'Nada pendiente para hoy.'}</p>`}
        ${resto > 0 ? `<a class="enlace" href="#/accion">Ver ${resto} más en tu semana</a>` : ''}
      </div>

      <div class="tu-dia-habitos"></div>`;
    pintarHabitosSemana(caja.querySelector('.tu-dia-habitos'), { incrustado: true });
  };

  caja.addEventListener('click', async (e) => {
    if (e.target.closest('.tu-dia-habitos') && (await alClicHabitos(e))) return;
    const b = e.target.closest('button');
    if (!b || !resumen) return;
    if (b.dataset.eventoHoy != null && resumen.proximo) return abrirHojaEvento(resumen.proximo);
    if (b.dataset.marcarHoy) {
      const t = resumen.tareas.find((x) => x.id === b.dataset.marcarHoy);
      if (!t) return;
      b.setAttribute('aria-checked', 'true');
      b.closest('.tarea')?.classList.add('hecha');
      try {
        await marcarTarea(t, true);
        aviso('Hecha ✓');
      } catch (err) {
        aviso(err.message, { error: true });
      }
      avisarCambio();
    }
  });

  const alCambiar = () => {
    if (!caja.isConnected) return removeEventListener('orvia:accion', alCambiar);
    pintar();
  };
  addEventListener('orvia:accion', alCambiar);
  pintar();
}
