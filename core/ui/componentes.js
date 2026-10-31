// Piezas de interfaz compartidas por todos los módulos.

/** Escapa texto para insertarlo con seguridad en HTML. */
export function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let temporizadorAviso = null;
/** Muestra un aviso breve en la parte baja de la pantalla. */
export function aviso(mensaje, { error = false } = {}) {
  let el = document.getElementById('aviso');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aviso';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.className = 'aviso' + (error ? ' error' : '');
  el.textContent = mensaje;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.hidden = true), error ? 6000 : 3200);
}

/** Marca de Orvia: un núcleo y un planeta en órbita. */
export function marcaOrvia({ animada = false } = {}) {
  return `<svg viewBox="0 0 120 120" aria-hidden="true" class="${animada ? 'orbita' : ''}">
    <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" stroke-width="6" opacity=".35"/>
    <circle cx="60" cy="60" r="16" fill="currentColor"/>
    <g class="planeta"><circle cx="91.1" cy="28.9" r="10" fill="currentColor" stroke="var(--papel)" stroke-width="5"/></g>
  </svg>`;
}

/** Iconos de trazo, 24×24, que heredan el color del texto. */
const trazo = (d) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONOS = {
  panel: trazo('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="18" cy="6" r="1.8" fill="currentColor"/>'),
  accion: trazo('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'),
  finanzas: trazo('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8.5A2.5 2.5 0 0 0 6.5 11H20"/><circle cx="16" cy="15" r="1" fill="currentColor"/>'),
  conocimiento: trazo('<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3"/><path d="M9 8.5h5"/>'),
  ajustes: trazo('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>'),
};

/** Estado vacío para módulos que aún no se han construido. */
export function moduloPendiente({ titulo, descripcion, fase, incluye }) {
  return `
    <header class="titulo-modulo"><h1>${escapar(titulo)}</h1></header>
    <section class="vacio">
      <span class="fase">${escapar(fase)}</span>
      <p>${escapar(descripcion)}</p>
      <ul>${incluye.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
    </section>`;
}
