// Datos del Segundo cerebro: notas (tabla del núcleo + supabase/007_cerebro.sql) y grupos de aprendizajes.

import { listar, crear, actualizar, archivar } from '../../core/db.js';
import { listarAreas } from '../../core/areas.js';
import { hoy, sumarDias, fechaCorta } from '../accion/fechas.js';

export const TIPOS = {
  idea: { nombre: 'Idea', plural: 'Ideas', color: '#fcd34d' },
  aprendizaje: { nombre: 'Aprendizaje', plural: 'Aprendizajes', color: '#5eead4' },
  sobre_mi: { nombre: 'Sobre ti', plural: 'Sobre ti', color: '#c4b5fd' },
};
export const ESTADOS = [['bruto', 'En bruto'], ['madurando', 'Madurando'], ['lanzada', 'Lanzada'], ['descartada', 'Descartada']];
export const SECCIONES = [
  ['perfil', 'Perfil', 'Quién eres: formación, trabajo, lo que se te da bien.'],
  ['valores', 'Valores', 'Lo que no negocias y por qué.'],
  ['metas', 'Metas a largo plazo', 'Dónde quieres estar dentro de 3, 5 o 10 años.'],
  ['reflexiones', 'Reflexiones', 'Lo que piensas cuando paras: se guarda con su fecha.'],
];
export const TIPOS_GRUPO = [['curso', 'Curso'], ['libro', 'Libro'], ['tema', 'Tema'], ['otro', 'Otro']];
export const nombreDe = (lista, valor) => (lista.find(([v]) => v === valor) || [null, ''])[1];

/** Todo lo que pinta el Segundo cerebro. Las notas llegan de la más reciente a la más antigua. */
export async function leerCerebro() {
  const [notas, grupos, areas, proyectos] = await Promise.all([
    listar('notas'),
    listar('notas_grupos', { orden: 'orden' }),
    listarAreas().catch(() => []),
    listar('proyectos').catch(() => []),
  ]);
  notas.sort((a, b) => String(b.modificado || b.creado).localeCompare(String(a.modificado || a.creado)));
  return {
    notas, grupos, areas, proyectos,
    porGrupo: Object.fromEntries(grupos.map((g) => [g.id, g])),
    porArea: Object.fromEntries(areas.map((a) => [a.id, a])),
    porProyecto: Object.fromEntries(proyectos.map((p) => [p.id, p])),
  };
}

/** Deja solo los campos que tocan a cada tipo de nota. */
function limpiar({ titulo, contenido = '', tipo = 'idea', estado, seccion, grupo_id, area_id = null, etiquetas = [], fijada = false, proyecto_id = null }) {
  return {
    titulo, contenido, tipo, area_id, etiquetas, fijada, proyecto_id,
    estado: tipo === 'idea' ? estado || 'bruto' : null,
    seccion: tipo === 'sobre_mi' ? seccion || 'reflexiones' : null,
    grupo_id: tipo === 'aprendizaje' ? grupo_id || null : null,
  };
}
export const crearNota = (nota) => crear('notas', limpiar(nota));
export const guardarNota = (id, nota) => actualizar('notas', id, limpiar(nota));
export const cambiarNota = (id, cambios) => actualizar('notas', id, cambios);
export const eliminarNota = (id) => archivar('notas', id);

export const crearGrupo = ({ nombre, tipo = 'tema', proyecto_id = null, orden = 0 }) => crear('notas_grupos', { nombre, tipo, proyecto_id, orden });
export const guardarGrupo = (id, cambios) => actualizar('notas_grupos', id, cambios);
/** Quita el grupo; sus notas se quedan en «Sin grupo». */
export async function eliminarGrupo(id) {
  const notas = await listar('notas', { filtros: { grupo_id: id } });
  for (const n of notas) await actualizar('notas', n.id, { grupo_id: null });
  await archivar('notas_grupos', id);
}

/** «#Excel, tablas dinámicas» → ['excel', 'tablas-dinamicas'] */
export function leerEtiquetas(texto) {
  const vistas = new Set();
  for (const parte of String(texto || '').split(/[,#\n]+/)) {
    const e = parte.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 30);
    if (e) vistas.add(e);
  }
  return [...vistas].slice(0, 12);
}

/** «hoy», «ayer», «hace 3 días» o «5 nov». */
export function hace(marca) {
  const d = new Date(marca);
  if (Number.isNaN(d.getTime())) return '';
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const h = hoy();
  if (dia === h) return 'hoy';
  if (dia === sumarDias(h, -1)) return 'ayer';
  for (let n = 2; n < 7; n++) if (dia === sumarDias(h, -n)) return `hace ${n} días`;
  return fechaCorta(dia);
}

export const avisarCerebro = () => dispatchEvent(new CustomEvent('orvia:cerebro'));
