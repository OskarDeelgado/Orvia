// Áreas de vida: el eje común con el que se etiqueta todo lo demás.

import { cliente, listar } from './db.js';
import { AREAS_INICIALES } from './config.js';

// Colores disponibles para áreas; cada uno tiene su variable en estilos.css.
export const COLORES_AREA = ['azul', 'verde', 'violeta', 'ambar', 'coral', 'cian'];

/** La primera vez que entras, crea las áreas iniciales. Después no hace nada. */
export async function asegurarAreasIniciales() {
  const todas = await listar('areas', { incluirArchivados: true });
  if (todas.length > 0) return;
  const filas = AREAS_INICIALES.map((a, i) => ({ ...a, orden: i }));
  const { error } = await cliente
    .from('areas')
    .upsert(filas, { onConflict: 'propietario,nombre', ignoreDuplicates: true });
  if (error) throw new Error(`No se pudieron crear las áreas iniciales: ${error.message}`);
}

export async function listarAreas() {
  return listar('areas', { orden: 'orden' });
}
