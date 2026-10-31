// Relaciones libres entre dos elementos cualesquiera del ecosistema
// (una nota con un objetivo, una tarea con una nota…).
// Las relaciones habituales usan campos fijos (tarea.proyecto_id); esto es para el resto.

import { cliente, crear } from './db.js';

// Tipos de elemento que se pueden enlazar. Se amplía cuando llegue Finanzas.
export const TIPOS = ['area', 'objetivo', 'proyecto', 'tarea', 'habito', 'nota'];

function validar({ tipo, id }) {
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo de elemento desconocido: ${tipo}`);
  if (!id) throw new Error('Falta el identificador del elemento');
}

/** Enlaza dos elementos: enlazar({tipo:'nota', id}, {tipo:'objetivo', id}) */
export async function enlazar(origen, destino) {
  validar(origen);
  validar(destino);
  return crear('enlaces', {
    origen_tipo: origen.tipo,
    origen_id: origen.id,
    destino_tipo: destino.tipo,
    destino_id: destino.id,
  });
}

/** Devuelve los elementos enlazados con uno dado, en cualquier dirección. */
export async function enlacesDe({ tipo, id }) {
  validar({ tipo, id });
  const { data, error } = await cliente
    .from('enlaces')
    .select('*')
    .eq('archivado', false)
    .or(
      `and(origen_tipo.eq.${tipo},origen_id.eq.${id}),and(destino_tipo.eq.${tipo},destino_id.eq.${id})`,
    );
  if (error) throw new Error(`No se pudieron leer los enlaces: ${error.message}`);
  return data.map((e) =>
    e.origen_tipo === tipo && e.origen_id === id
      ? { enlace: e.id, tipo: e.destino_tipo, id: e.destino_id }
      : { enlace: e.id, tipo: e.origen_tipo, id: e.origen_id },
  );
}

export async function desenlazar(idEnlace) {
  const { error } = await cliente.from('enlaces').update({ archivado: true }).eq('id', idEnlace);
  if (error) throw new Error(`No se pudo quitar el enlace: ${error.message}`);
}
