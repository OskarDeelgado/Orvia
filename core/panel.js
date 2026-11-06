// Panel: el centro de Orvia. Globo en el medio, módulos en órbita y,
// debajo, los datos clave. Solo lee; no guarda datos propios.

import { escapar, marcaOrvia, globo, ICONOS } from './ui/componentes.js';
import { MODULOS } from '../modules/registro.js';

const DURACION_ORBITA = 27; // segundos por vuelta; igual que en estilos.css

function saludo() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaLarga() {
  const texto = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function mesActual() {
  return new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());
}

function bolas() {
  const n = MODULOS.length;
  return MODULOS.map((m, i) => {
    const pronto = m.estado !== 'activo';
    // Reparte las bolas por la órbita. Sin animación, se quedan en estas posiciones.
    const posicion = (12 + (i * 100) / n).toFixed(1);
    const retraso = (-(i * DURACION_ORBITA) / n).toFixed(2);
    const etiqueta = pronto ? `${m.nombre}, todavía en preparación` : `Abrir ${m.nombre}`;
    return `<a class="bola${pronto ? ' pronto' : ''}" href="#/${m.id}" data-mundo="${m.id}"
        aria-label="${escapar(etiqueta)}"
        style="offset-distance:${posicion}%;animation-delay:${retraso}s">
      <span class="esfera"></span>
      <span class="nombre">${escapar(m.nombre)}</span>
    </a>`;
  }).join('');
}

/** Pinta el Panel. Devuelve la posición de la bola pulsada para el zoom de entrada. */
export function pintarPanel(raiz, { sesion, alEntrarEnModulo }) {
  const nombre = sesion?.user?.user_metadata?.nombre;
  raiz.innerHTML = `
    <main class="panel volviendo">
      <header class="panel-cabecera">
        <span class="marca">${marcaOrvia()}Orvia</span>
        <a class="boton-icono" href="#/ajustes" aria-label="Ajustes">${ICONOS.ajustes}</a>
      </header>

      <div class="panel-saludo">
        <p>${fechaLarga()}</p>
        <h1>${saludo()}${nombre ? ', ' + escapar(nombre) : ''}</h1>
      </div>

      <nav class="hub" aria-label="Módulos">
        <svg width="350" height="300" viewBox="0 0 350 300" aria-hidden="true">
          <ellipse cx="175" cy="150" rx="150" ry="58" fill="none" stroke="rgb(138 180 255 / .18)"/>
        </svg>
        ${globo(120)}
        ${bolas()}
      </nav>

      <section class="datos-clave" aria-label="Datos clave">
        <div class="bloque dato">
          <span class="etiqueta">Te quedan en ${mesActual()}</span>
          <span class="cifra">—</span>
          <span class="nota">Cuando esté Finanzas</span>
        </div>
        <div class="bloque dato">
          <span class="etiqueta">Patrimonio</span>
          <span class="cifra">—</span>
          <span class="nota">Cuando esté Finanzas</span>
        </div>
      </section>

      <section class="bloque" aria-labelledby="t-hoy">
        <h2 id="t-hoy">Hoy</h2>
        <div class="lista-hoy">
          <p class="vacia">Tus tareas del día aparecerán aquí cuando llegue Acción.</p>
        </div>
      </section>
    </main>`;

  // Guarda desde qué punto de la pantalla se entra, para que el zoom salga de la bola.
  raiz.querySelectorAll('.bola').forEach((bola) => {
    bola.addEventListener('click', () => {
      const r = bola.querySelector('.esfera').getBoundingClientRect();
      alEntrarEnModulo({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  });
}
