// Exportar tus notas a Markdown (bloque 5): un .zip con un archivo .md por nota, ordenado en
// carpetas (Ideas, Aprendizajes/<grupo>, Sobre ti/<sección>). Lo abre cualquier app de notas.
// El .zip se monta aquí mismo, sin comprimir y sin librerías.

import { TIPOS, ESTADOS, SECCIONES, nombreDe, plazoDe, leerCerebro } from './datos.js';

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** .zip sin compresión. @param {{nombre: string, texto: string}[]} archivos */
export function crearZip(archivos, fecha = new Date()) {
  const cod = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const partes = [], central = [];
  let pos = 0;
  for (const a of archivos) {
    const nombre = cod.encode(a.nombre), datos = cod.encode(a.texto), crc = crc32(datos);
    const cab = new DataView(new ArrayBuffer(30));
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); // nombres en UTF-8
    cab.setUint16(8, 0, true); cab.setUint16(10, hora, true); cab.setUint16(12, dia, true);
    cab.setUint32(14, crc, true); cab.setUint32(18, datos.length, true); cab.setUint32(22, datos.length, true);
    cab.setUint16(26, nombre.length, true); cab.setUint16(28, 0, true);
    partes.push(new Uint8Array(cab.buffer), nombre, datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, dia, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true);
    cen.setUint16(28, nombre.length, true); cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    pos += 30 + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
}

const limpio = (t) => String(t || '').replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sin título';
const yaml = (t) => `"${String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Una nota → texto Markdown con su ficha arriba. */
export function notaAMarkdown(n, datos) {
  const ficha = [`titulo: ${yaml(n.titulo)}`, `tipo: ${TIPOS[n.tipo]?.nombre || n.tipo}`];
  if (n.tipo === 'idea') ficha.push(`estado: ${nombreDe(ESTADOS, n.estado || 'bruto')}`);
  if (n.tipo === 'aprendizaje' && datos.porGrupo[n.grupo_id]) ficha.push(`grupo: ${yaml(datos.porGrupo[n.grupo_id].nombre)}`);
  if (n.tipo === 'sobre_mi') ficha.push(`seccion: ${nombreDe(SECCIONES, n.seccion || 'reflexiones')}`);
  if (n.horizonte) ficha.push(`plazo: ${plazoDe(n.horizonte)}`);
  if (datos.porArea[n.area_id]) ficha.push(`area: ${yaml(datos.porArea[n.area_id].nombre)}`);
  if (datos.porProyecto[n.proyecto_id]) ficha.push(`proyecto: ${yaml(datos.porProyecto[n.proyecto_id].titulo)}`);
  if (n.etiquetas?.length) ficha.push(`etiquetas: [${n.etiquetas.join(', ')}]`);
  if (n.fijada) ficha.push('fijada: true');
  ficha.push(`creada: ${String(n.creado || '').slice(0, 10)}`, `modificada: ${String(n.modificado || n.creado || '').slice(0, 10)}`);
  return `---\n${ficha.join('\n')}\n---\n\n# ${n.titulo}\n\n${n.contenido || ''}\n`;
}

/** Archivos de la exportación, con sus carpetas. */
export function archivosDe(datos) {
  const usados = new Set();
  return datos.notas.map((n) => {
    const carpeta = n.tipo === 'idea' ? 'Ideas'
      : n.tipo === 'aprendizaje' ? `Aprendizajes/${limpio(datos.porGrupo[n.grupo_id]?.nombre || 'Sin grupo')}`
        : `Sobre ti/${nombreDe(SECCIONES, n.seccion || 'reflexiones')}`;
    let nombre = `${carpeta}/${limpio(n.titulo)}`;
    for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${carpeta}/${limpio(n.titulo)} (${i})`;
    usados.add(nombre.toLowerCase());
    return { nombre: `${nombre}.md`, texto: notaAMarkdown(n, datos) };
  });
}

/** Descarga (o comparte, en el iPhone) el .zip con todas tus notas. Devuelve cuántas van. */
export async function exportarNotas() {
  const datos = await leerCerebro();
  if (!datos.notas.length) return 0;
  const zip = crearZip(archivosDe(datos));
  const { entregar } = await import('../finanzas/informes.js');
  const d = new Date();
  await entregar(`orvia-notas-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`, zip, 'application/zip');
  return datos.notas.length;
}
