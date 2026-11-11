// Navegación de Acción: tu semana, proyectos y hábitos.

const SECCIONES = [
  ['semana', 'Semana', '#/accion'],
  ['proyectos', 'Proyectos', '#/accion/proyectos'],
  ['habitos', 'Hábitos', '#/accion/habitos'],
];

export const navAccion = (actual) => `
  <nav class="nav-accion" aria-label="Secciones de Acción">
    ${SECCIONES.map(([id, nombre, ruta]) => `<a href="${ruta}"${id === actual ? ' aria-current="page"' : ''}>${nombre}</a>`).join('')}
  </nav>`;
