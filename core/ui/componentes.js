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
export function marcaOrvia() {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="44" fill="none" stroke="#8ab4ff" stroke-width="6" opacity=".5"/>
    <circle cx="60" cy="60" r="15" fill="#f2f4f7"/>
    <circle cx="91" cy="29" r="10" fill="#8ab4ff"/>
  </svg>`;
}

/** Globo 3D de líneas. El tamaño se pasa en píxeles. */
export function globo(tamano = 120) {
  return `<div class="globo-escena" style="--globo:${Number(tamano)}px" aria-hidden="true">
    <div class="globo"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
  </div>`;
}

/** Iconos de trazo, 24×24, que heredan el color del texto. */
const trazo = (d, grosor = 1.8) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONOS = {
  volver: trazo('<path d="M15 5l-7 7 7 7"/>', 2),
  mas: trazo('<path d="M12 5v14M5 12h14"/>', 2.4),
  ajustes: trazo('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>'),
};

/** Estado vacío para módulos que aún no se han construido. */
export function moduloPendiente({ fase, descripcion, incluye }) {
  return `
    <section class="cristal vacio">
      <span class="fase">${escapar(fase)}</span>
      <p>${escapar(descripcion)}</p>
      <ul>${incluye.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
    </section>`;
}
