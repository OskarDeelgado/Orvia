// Módulo Segundo cerebro (Jude): lo que piensas y lo que sabes.
// Bloque 1: biblioteca con buscador, notas de tres tipos (idea, aprendizaje, sobre ti),
// etiquetas, notas fijadas y aprendizajes agrupados por curso, libro o tema.
// Llegan después: convertir una idea en proyecto, enlazar aprendizajes con Acción,
// la página «Sobre ti», Jude en el Panel y la oficina, y exportar a Markdown.

import { navCerebro } from './nav.js';

const SECCIONES = ['ideas', 'aprendizajes', 'sobre-ti', 'nota'];

export default {
  id: 'cerebro',
  nombre: 'Segundo cerebro',
  estado: 'activo',
  // Responsable del módulo en la oficina y en el panel del móvil.
  agente: {
    nombre: 'Jude',
    puesto: 'Bibliotecario',
    color: '#fbbf24',
    tarea: 'Guarda lo que piensas y lo que sabes: ideas, aprendizajes y todo sobre ti.',
    situacion: 'Tu biblioteca está abierta',
  },
  // Lo que ofrece el botón + desde cualquier pantalla (#/nota desde un atajo del iPhone).
  accionRapida: {
    etiqueta: 'Nueva nota',
    ruta: 'nota',
    // Dentro del Segundo cerebro, propone el tipo (y el grupo) de la pantalla en la que estás.
    ejecutar: async () => {
      const [{ abrirHojaNota }, { propuestaNota }] = await Promise.all([import('./hoja.js'), import('./biblioteca.js')]);
      return abrirHojaNota(propuestaNota());
    },
  },
  async montar(contenedor, { sub } = {}) {
    const seccion = SECCIONES.includes(sub) ? sub : 'biblioteca';
    const id = seccion === 'nota' ? location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[2] || null : null;
    contenedor.innerHTML = `${navCerebro(seccion === 'nota' ? null : seccion)}<div id="panel-cerebro" data-vista="${seccion}"></div>`;
    const { montarCerebro } = await import('./biblioteca.js');
    await montarCerebro(contenedor.querySelector('#panel-cerebro'), seccion, id);
  },
};
