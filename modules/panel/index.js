// Panel global: la visión de conjunto. Solo lee de los demás módulos.
// En la fase 0 muestra tus áreas de vida, que llegan de la base de datos:
// si se ven, la conexión con Supabase funciona.

import { listarAreas } from '../../core/areas.js';
import { escapar } from '../../core/ui/componentes.js';

function saludo() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaLarga() {
  const texto = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Dibuja las áreas como planetas alrededor de ti.
function orbitaAreas(areas) {
  const c = 110;
  const r = 82;
  const planetas = areas
    .map((a, i) => {
      const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / areas.length;
      const x = (c + r * Math.cos(angulo)).toFixed(1);
      const y = (c + r * Math.sin(angulo)).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="11" fill="var(--area-${escapar(a.color)}, var(--primario))" stroke="var(--papel)" stroke-width="4"><title>${escapar(a.nombre)}</title></circle>`;
    })
    .join('');
  return `<svg viewBox="0 0 220 220" role="img" aria-label="Tus ${areas.length} áreas de vida">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--linea)" stroke-width="2"/>
    <circle cx="${c}" cy="${c}" r="34" fill="var(--primario-suave)"/>
    <text x="${c}" y="${c + 6}" text-anchor="middle" font-family="var(--fuente-titulos)" font-weight="700" font-size="18" fill="var(--primario)">Tú</text>
    ${planetas}
  </svg>`;
}

export default {
  id: 'panel',
  nombre: 'Panel',
  icono: 'panel',
  async montar(contenedor) {
    contenedor.innerHTML = `
      <header class="titulo-modulo">
        <h1>${saludo()}</h1>
        <p class="suave">${fechaLarga()}</p>
      </header>
      <section class="bloque" aria-labelledby="t-areas">
        <h2 id="t-areas">Tus áreas de vida</h2>
        <div id="areas" class="cargando">Cargando tus áreas…</div>
      </section>
      <section class="bloque">
        <h2>Lo siguiente</h2>
        <p class="suave">Finanzas llega antes del 20 de diciembre, con todo lo que hace Sobrea y sincronizado entre tus dispositivos.</p>
      </section>`;

    const destino = contenedor.querySelector('#areas');
    try {
      const areas = await listarAreas();
      destino.className = '';
      if (areas.length === 0) {
        destino.innerHTML = '<p class="suave">Aún no tienes áreas. Recarga la página para crear las iniciales.</p>';
        return;
      }
      destino.innerHTML = `
        <div class="mapa-areas">
          ${orbitaAreas(areas)}
          <ul class="areas">
            ${areas
              .map((a) => `<li class="area" style="--color-area: var(--area-${escapar(a.color)})">${escapar(a.nombre)}</li>`)
              .join('')}
          </ul>
        </div>`;
    } catch (e) {
      destino.className = '';
      destino.innerHTML = `<p class="suave">${escapar(e.message)}</p>`;
    }
  },
};
