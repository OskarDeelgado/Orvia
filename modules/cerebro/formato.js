// Formato sencillo de las notas: se escribe texto plano con unas pocas marcas y se pinta bonito.
//   **negrita**   *cursiva*   # Título   ## Subtítulo   - lista   1. lista numerada   enlaces https://
// El texto se escapa siempre antes de pintarlo.

import { escapar } from '../../core/ui/componentes.js';

function enLinea(texto) {
  return escapar(texto)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
}

/** Texto de una nota → HTML seguro. */
export function pintarTexto(texto) {
  const salida = [];
  let lista = null; // 'ul' | 'ol'
  let parrafo = [];
  const cerrarParrafo = () => { if (parrafo.length) { salida.push(`<p>${parrafo.join('<br>')}</p>`); parrafo = []; } };
  const cerrarLista = () => { if (lista) { salida.push(`</${lista}>`); lista = null; } };
  for (const cruda of String(texto || '').replace(/\r/g, '').split('\n')) {
    const l = cruda.trim();
    let m;
    if (!l) { cerrarParrafo(); cerrarLista(); continue; }
    if ((m = l.match(/^(#{1,2})\s+(.+)$/))) {
      cerrarParrafo(); cerrarLista();
      salida.push(m[1].length === 1 ? `<h3>${enLinea(m[2])}</h3>` : `<h4>${enLinea(m[2])}</h4>`);
    } else if ((m = l.match(/^[-•*]\s+(.+)$/)) || (m = l.match(/^\d+[.)]\s+(.+)$/))) {
      const tipo = /^\d/.test(l) ? 'ol' : 'ul';
      cerrarParrafo();
      if (lista !== tipo) { cerrarLista(); salida.push(`<${tipo}>`); lista = tipo; }
      salida.push(`<li>${enLinea(m[1])}</li>`);
    } else {
      cerrarLista();
      parrafo.push(enLinea(l));
    }
  }
  cerrarParrafo(); cerrarLista();
  return salida.join('');
}

/** Primeras palabras de una nota, sin marcas, para las tarjetas. */
export function extracto(texto, largo = 150) {
  const plano = String(texto || '').replace(/^#{1,2}\s+/gm, '').replace(/^[-•*]\s+/gm, '').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
  return plano.length > largo ? `${plano.slice(0, largo).replace(/\s+\S*$/, '')}…` : plano;
}
