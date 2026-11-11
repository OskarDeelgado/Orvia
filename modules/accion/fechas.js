// Fechas de Acción: días como 'AAAA-MM-DD' en hora local. Sin dependencias, para poder probarlas fuera del navegador.

const dosCifras = (n) => String(n).padStart(2, '0');
export const aTexto = (d) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`;
export const aFecha = (t) => new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10));
export const hoy = () => aTexto(new Date());
export const sumarDias = (t, n) => { const d = aFecha(t); d.setDate(d.getDate() + n); return aTexto(d); };
/** Lunes de la semana de un día. */
export const lunesDe = (t) => { const d = aFecha(t); return sumarDias(t, -((d.getDay() + 6) % 7)); };
export const diasDeLaSemana = (lunes) => [0, 1, 2, 3, 4, 5, 6].map((i) => sumarDias(lunes, i));

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreDia = (t) => DIAS[aFecha(t).getDay()];
export const diaCorto = (t) => DIAS[aFecha(t).getDay()].slice(0, 3);
export const nombreMes = (t) => MESES[aFecha(t).getMonth()];
/** "lunes 9 de noviembre", o "Hoy", "Mañana", "Ayer". */
export function etiquetaDia(t, { relativo = true } = {}) {
  const h = hoy();
  if (relativo && t === h) return 'Hoy';
  if (relativo && t === sumarDias(h, 1)) return 'Mañana';
  if (relativo && t === sumarDias(h, -1)) return 'Ayer';
  const d = aFecha(t);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
/** "9 – 15 de noviembre" o "30 nov – 6 dic". */
export function rangoSemana(lunes) {
  const a = aFecha(lunes), b = aFecha(sumarDias(lunes, 6));
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} ${MESES[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MESES[b.getMonth()].slice(0, 3)}`;
}

/** «20 nov», o «20 nov 2027» si no es de este año. */
export function fechaCorta(t) {
  const d = aFecha(t);
  const anio = d.getFullYear() !== aFecha(hoy()).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}${anio}`;
}
