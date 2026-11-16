// Navegación del Segundo cerebro. Igual que en Acción y Finanzas: barra flotante abajo en el
// móvil y columna lateral en el ordenador.

const icono = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const SECCIONES_NAV = [
  ['biblioteca', 'Biblioteca', '#/cerebro', icono('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M9 4h4v16H9zM14.5 5.2l3.3-.9 2.9 15.2-3.3.9z"/>')],
  ['ideas', 'Ideas', '#/cerebro/ideas', icono('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>')],
  ['aprendizajes', 'Aprendizajes', '#/cerebro/aprendizajes', icono('<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5"/>')],
  ['sobre-ti', 'Sobre ti', '#/cerebro/sobre-ti', icono('<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>')],
];

export const navCerebro = (actual) => `
  <nav class="pestanas barra-inferior" aria-label="Secciones del Segundo cerebro">
    ${SECCIONES_NAV.map(([id, nombre, ruta, svg]) => `<a href="${ruta}"${id === actual ? ' aria-current="page"' : ''}>${svg}<span>${nombre}</span></a>`).join('')}
  </nav>`;
