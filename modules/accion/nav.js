// Navegación de Acción: tu semana, proyectos y hábitos.
// Igual que en Finanzas: barra inferior con icono en el móvil y columna lateral en el ordenador.

const icono = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const SECCIONES = [
  ['semana', 'Semana', '#/accion', icono('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0"/>')],
  ['proyectos', 'Proyectos', '#/accion/proyectos', icono('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M8.5 14l2.2 2.2 4.8-4.7"/>')],
  ['habitos', 'Hábitos', '#/accion/habitos', icono('<path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.3 2.4-5.2 3.9-7.4.4 1.7 1.5 2.9 2.6 3.4.3-2.9 1.6-5.4 3.5-7.4.6 3.6 4 5.8 4 10.9C19 18.2 15.9 21 12 21z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.8 1.6-2.7 2.8-4.4 1.2 1.7 2.8 2.6 2.8 4.4 0 1.6-1.2 2.8-2.8 2.8z"/>')],
];

export const navAccion = (actual) => `
  <nav class="pestanas barra-inferior" aria-label="Secciones de Acción">
    ${SECCIONES.map(([id, nombre, ruta, svg]) => `<a href="${ruta}"${id === actual ? ' aria-current="page"' : ''}>${svg}<span>${nombre}</span></a>`).join('')}
  </nav>`;
