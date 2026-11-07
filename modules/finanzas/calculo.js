// Cálculos de Finanzas, iguales que en Sobrea. Funciones puras: no tocan la base de datos.
// Un "mes" es siempre el texto 'AAAA-MM-01'.

const dos = (n) => String(n).padStart(2, '0');

/** '2027-03-14' → '2027-03-01' */
export const mesDe = (fecha) => fecha.slice(0, 7) + '-01';

/** Suma n meses a un mes ('2027-11-01' + 3 → '2028-02-01'). */
export function sumarMeses(mes, n) {
  const a = +mes.slice(0, 4), m = +mes.slice(5, 7) - 1 + n;
  return `${a + Math.floor(m / 12)}-${dos((((m % 12) + 12) % 12) + 1)}-01`;
}

/** Meses entre dos meses (b − a). */
export const distanciaMeses = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));

export const diasDelMes = (mes) => new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();

/** Fecha de hoy en hora local, 'AAAA-MM-DD'. */
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Lo que un movimiento cuenta en un mes. Si se reparte en N meses, cada mes cuenta
 * una parte y la primera se queda los céntimos que sobran (como en Sobrea).
 */
export function cuotaDelMes(mov, mes) {
  const meses = mov.meses > 1 ? mov.meses : 1;
  const importe = Number(mov.importe);
  if (meses === 1) return mesDe(mov.fecha) === mes ? importe : 0;
  const j = distanciaMeses(mesDe(mov.fecha), mes);
  if (j < 0 || j >= meses) return 0;
  const centimos = Math.round(importe * 100), base = Math.trunc(centimos / meses);
  return (base + (j === 0 ? centimos - base * meses : 0)) / 100;
}

/**
 * Los movimientos que se ven en un mes: los de ese mes y, de los repartidos,
 * la cuota que toca (con la fecha trasladada a ese mes y el número de cuota).
 */
export function movimientosDelMes(movimientos, mes) {
  const lista = [];
  for (const m of movimientos) {
    const cuota = cuotaDelMes(m, mes);
    if (!cuota) continue;
    if (!(m.meses > 1)) {
      lista.push({ ...m, cuenta: cuota });
      continue;
    }
    const j = distanciaMeses(mesDe(m.fecha), mes);
    const dia = Math.min(+m.fecha.slice(8, 10), diasDelMes(mes));
    lista.push({ ...m, cuenta: cuota, cuota: j + 1, fechaEnMes: j > 0 ? `${mes.slice(0, 8)}${dos(dia)}` : m.fecha });
  }
  return lista.sort((a, b) => (b.fechaEnMes || b.fecha).localeCompare(a.fechaEnMes || a.fecha) || String(b.creado || '').localeCompare(String(a.creado || '')));
}

/** Fecha de la repetición número k de un recurrente (la 0 es la fecha de inicio). */
export function fechaRepeticion(rec, k) {
  const y = +rec.fecha_inicio.slice(0, 4), m = +rec.fecha_inicio.slice(5, 7) - 1, d = +rec.fecha_inicio.slice(8, 10);
  const cada = rec.cada || 1;
  if (rec.unidad === 'mes') {
    const t = m + k * cada, yy = y + Math.floor(t / 12), mo = ((t % 12) + 12) % 12;
    const dim = new Date(Date.UTC(yy, mo + 1, 0)).getUTCDate();
    return `${yy}-${dos(mo + 1)}-${dos(Math.min(d, dim))}`;
  }
  return new Date(Date.UTC(y, m, d + k * cada * (rec.unidad === 'semana' ? 7 : 1))).toISOString().slice(0, 10);
}

/** Texto de la frecuencia: "cada mes", "cada 2 semanas"… */
export function frecuencia(rec) {
  const uno = { dia: 'día', semana: 'semana', mes: 'mes' }, varios = { dia: 'días', semana: 'semanas', mes: 'meses' };
  return rec.cada === 1 ? `cada ${uno[rec.unidad]}` : `cada ${rec.cada} ${varios[rec.unidad]}`;
}

/** Formato de Sobrea: 2.400 € o 32,50 € (punto de miles siempre, céntimos solo si los hay). */
export function euros(v) {
  const centimos = Math.round((+v || 0) * 100);
  const signo = centimos < 0 ? '−' : '';
  const abs = Math.abs(centimos);
  const entero = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = abs % 100;
  return `${signo}${entero}${resto ? ',' + dos(resto) : ''} €`;
}

/** Lee un importe escrito a mano: "12,5", "1.200,50", "1200.5" → número; NaN si no vale. */
export function leerImporte(texto) {
  let t = String(texto).trim().replace(/\s|€/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Math.round(parseFloat(t) * 100) / 100 : NaN;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (mes, { anio = true } = {}) => {
  const t = MESES[+mes.slice(5, 7) - 1];
  return anio ? `${t} ${mes.slice(0, 4)}` : t;
};

/** "Hoy", "Ayer" o "lun 3 ene". */
export function etiquetaDia(fecha) {
  const h = hoy();
  if (fecha === h) return 'Hoy';
  const ayer = new Date(Date.UTC(+h.slice(0, 4), +h.slice(5, 7) - 1, +h.slice(8, 10) - 1)).toISOString().slice(0, 10);
  if (fecha === ayer) return 'Ayer';
  const d = new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)));
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`;
}
