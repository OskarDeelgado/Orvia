// Resumen del Segundo cerebro para el Panel y la oficina (bloque 5). Solo lee.

import { listar } from '../../core/db.js';

/** @returns {Promise<{notas:number, ideas:number, madurando:number, aprendizajes:number, ultima:object|null}>} */
export async function leerResumenCerebro() {
  const notas = await listar('notas');
  notas.sort((a, b) => String(b.modificado || b.creado).localeCompare(String(a.modificado || a.creado)));
  const ideas = notas.filter((n) => n.tipo === 'idea');
  return {
    notas: notas.length,
    ideas: ideas.filter((n) => !['descartada', 'lanzada'].includes(n.estado)).length,
    madurando: ideas.filter((n) => n.estado === 'madurando').length,
    aprendizajes: notas.filter((n) => n.tipo === 'aprendizaje').length,
    ultima: notas[0] ? { titulo: notas[0].titulo, tipo: notas[0].tipo } : null,
  };
}

/** Frase corta para la ficha de Jude: «12 notas · 2 ideas madurando». */
export function situacionCerebro(r) {
  if (!r.notas) return 'Tu biblioteca está abierta';
  const partes = [`${r.notas} ${r.notas === 1 ? 'nota' : 'notas'}`];
  if (r.madurando) partes.push(`${r.madurando} ${r.madurando === 1 ? 'idea' : 'ideas'} madurando`);
  else if (r.ideas) partes.push(`${r.ideas} ${r.ideas === 1 ? 'idea viva' : 'ideas vivas'}`);
  return partes.join(' · ');
}
