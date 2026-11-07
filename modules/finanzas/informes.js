// Informe del mes en PDF y exportación de movimientos a Excel, como en Sobrea.
// Las librerías (jsPDF y SheetJS) se cargan solo al pulsar el botón.

import { aviso } from '../../core/ui/componentes.js';
import { euros, mesDe, nombreMes, movimientosDelMes } from './calculo.js';

const cargadas = {};
function cargarScript(ruta, global) {
  if (window[global]) return Promise.resolve(window[global]);
  cargadas[ruta] ||= new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = new URL(`../../vendor/${ruta}`, import.meta.url).href;
    s.onload = () => (window[global] ? ok(window[global]) : mal(new Error('No se pudo cargar ' + ruta)));
    s.onerror = () => { delete cargadas[ruta]; mal(new Error('No se pudo cargar ' + ruta + '. Revisa tu conexión.')); };
    document.head.append(s);
  });
  return cargadas[ruta];
}

/** Guarda o comparte el archivo (en el iPhone abre el menú de compartir, como Sobrea). */
async function entregar(nombre, datos, tipo) {
  const archivo = new File([datos], nombre, { type: tipo });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(archivo), a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const Mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------- PDF ----------

export async function informePdf(motor, k) {
  let jspdf;
  try {
    jspdf = await cargarScript('jspdf.umd.min.js', 'jspdf');
  } catch {
    return aviso('No se pudo cargar el generador de PDF', { error: true });
  }
  try {
    const { jsPDF } = jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 16, CW = W - 2 * M;
    const INK = '#141b2b', MU = '#5d6678', AC = '#3f3aa8', BD = '#e0e5ee', TR = '#e6eaf1', BA = '#c4453a', OK = '#1f7a5a', WA = '#8f5f00';
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const fc = (h) => d.setFillColor(...rgb(h)), dc = (h) => d.setDrawColor(...rgb(h));
    const E = (x) => euros(x).replace(/\s/g, ' ');
    const tx = (t, x, y, o = {}) => { d.setFont('helvetica', o.b ? 'bold' : 'normal'); d.setFontSize(o.s || 10); d.setTextColor(...rgb(o.c || INK)); d.text(String(t), x, y, { align: o.a || 'left', maxWidth: o.w }); };
    const ln = (y, c) => { dc(c || BD); d.setLineWidth(0.2); d.line(M, y, W - M, y); };
    const mes = motor.mesK(k), titulo = Mayus(nombreMes(mes));
    let y = 0;
    const pagina = () => {
      // Marca de Orvia: círculo con su órbita
      fc('#1c1f26'); d.roundedRect(M, 14, 10, 10, 2.5, 2.5, 'F');
      d.setDrawColor(138, 180, 255); d.setLineWidth(0.6); d.circle(M + 5, 19, 2.9, 'S');
      fc('#8ab4ff'); d.circle(M + 7.6, 17.2, 0.9, 'F');
      tx('Orvia', M + 13.5, 21.6, { b: 1, s: 19 });
      tx('Finanzas · Informe mensual', W - M, 18, { a: 'right', s: 9, c: MU });
      tx(titulo, W - M, 24.4, { a: 'right', b: 1, s: 14 });
      ln(30, AC); y = 38;
    };
    const hace = (h) => { if (y + h > 278) { d.addPage(); pagina(); } };

    const r = motor.resumenMes(k), S = r.sobres;
    const pat = motor.patrimonio(k).total;
    pagina();
    const bw = (CW - 12) / 4;
    const kp = [['Presupuesto del mes', E(r.total), INK], ['Gastado', E(r.gastado), INK], [r.queda < -0.004 ? 'Te has pasado' : 'Te queda', E(Math.abs(r.queda)), r.queda < -0.004 ? BA : INK], ['Patrimonio total', E(pat), INK]];
    kp.forEach((c, i) => { const x = M + i * (bw + 4); fc('#ffffff'); dc(BD); d.setLineWidth(0.3); d.roundedRect(x, y, bw, 22, 2.5, 2.5, 'FD'); tx(c[0], x + 4, y + 7, { s: 7.5, c: MU }); tx(c[1], x + 4, y + 16.5, { b: 1, s: 13, c: c[2] }); });
    y += 29;
    const pasados = S.filter((x) => x.gastado > x.presupuesto + 0.004);
    const msg = r.queda < -0.004 ? ['Has superado el presupuesto del mes en ' + E(-r.queda), BA]
      : pasados.length ? [pasados.length > 1 ? `${pasados.length} categorías se han pasado de su presupuesto` : `${pasados[0].sobre.nombre} se ha pasado ${E(pasados[0].gastado - pasados[0].presupuesto)}`, WA]
        : ['El mes se mantiene dentro del presupuesto', OK];
    tx(msg[0], M, y, { b: 1, s: 10, c: msg[1] });
    if (r.ingresosExtra) tx('Incluye ' + E(r.ingresosExtra) + ' de ingresos extra', W - M, y, { a: 'right', s: 8.5, c: MU });
    y += 10;
    tx('Gasto por categoría', M, y, { b: 1, s: 11.5 }); y += 6;
    const cx = { n: M + 6, bar: M + 56, g: M + 121, p: M + 146, q: W - M };
    [['CATEGORÍA', cx.n, 'left'], ['PROGRESO', cx.bar, 'left'], ['GASTADO', cx.g, 'right'], ['PRESUPUESTO', cx.p, 'right'], ['QUEDA', cx.q, 'right']].forEach((h) => tx(h[0], h[1], y, { s: 7, c: MU, b: 1, a: h[2] }));
    y += 2.5; ln(y); y += 7.5;
    for (const { sobre, gastado: gs, presupuesto: bs } of S) {
      hace(11);
      const o = bs > 0 ? gs / bs : gs > 0 ? 1 : 0, over = gs > bs + 0.004, gone = !over && bs > 0 && bs - gs < 0.005, col = /^#[0-9a-f]{6}$/i.test(sobre.color) ? sobre.color : AC;
      fc(col); d.circle(M + 1.6, y - 1.1, 1.3, 'F'); tx(sobre.nombre, cx.n, y, { s: 10, w: 48 });
      fc(TR); d.roundedRect(cx.bar, y - 2.6, 46, 2.6, 1.3, 1.3, 'F');
      if (o > 0) { fc(col); d.roundedRect(cx.bar, y - 2.6, Math.max(2.6, 46 * Math.min(1, o)), 2.6, 1.3, 1.3, 'F'); }
      tx(E(gs), cx.g, y, { a: 'right', s: 10 }); tx(E(bs), cx.p, y, { a: 'right', s: 10, c: MU });
      tx(over ? '-' + E(gs - bs) : gone ? 'Agotado' : E(bs - gs), cx.q, y, { a: 'right', s: 10, b: over || gone, c: over ? BA : gone ? WA : INK });
      y += 3; ln(y); y += 7.5;
    }
    hace(11);
    fc(MU); d.circle(M + 1.6, y - 1.1, 1.3, 'F'); tx('Extraordinarios', cx.n, y, { s: 10 });
    tx(E(r.extraordinarios), cx.g, y, { a: 'right', s: 10 }); tx('sale del fondo', cx.q, y, { a: 'right', s: 9, c: MU });
    y += 3; ln(y); y += 10;

    const top = movimientosDelMes(motor.libro.movimientos, mes)
      .filter((m) => motor.porId[m.sobre_id]?.tipo !== 'ingreso')
      .sort((a, b) => b.cuenta - a.cuenta).slice(0, 5);
    if (top.length) {
      hace(14 + top.length * 7);
      tx('Mayores gastos del mes', M, y, { b: 1, s: 11.5 }); y += 6;
      top.forEach((m) => {
        const f = m.fechaEnMes || m.fecha;
        tx(f.slice(8) + '/' + f.slice(5, 7), M, y, { s: 9.5, c: MU });
        tx(m.concepto || motor.porId[m.sobre_id]?.nombre || '', M + 16, y, { s: 10, w: 70 });
        tx(motor.porId[m.sobre_id]?.nombre || '', M + 96, y, { s: 9.5, c: MU, w: 48 });
        tx(E(m.cuenta), W - M, y, { a: 'right', s: 10, b: 1 });
        y += 3; ln(y); y += 6.5;
      });
      y += 4;
    }
    hace(46);
    tx('Ahorro e inversión', M, y, { b: 1, s: 11.5 }); y += 7;
    const indicado = Number(motor.libro.config.inversion_valor) || 0, conValor = indicado > 0 && k === motor.kInicial();
    const filas = [
      ['Entra a ahorro este mes', E(motor.traspaso(k))],
      ['Cuenta de ahorro', E(motor.ahorroCuenta(k)) + '  (fondo de emergencia ' + E(motor.fondoEn(k).f) + ')'],
      ['Cuenta diaria', E(motor.saldo(k))],
      ['Invertido', E(motor.invertido(k))],
      [conValor ? 'Valor actual de la cartera' : 'Valor de las inversiones', E(conValor ? indicado : motor.invertido(k))],
    ];
    filas.forEach((f) => { tx(f[0], M, y, { s: 10, c: MU }); tx(f[1], W - M, y, { a: 'right', s: 10, b: 1 }); y += 3; ln(y, TR); y += 6.2; });
    const np = d.getNumberOfPages(), hoyTxt = new Date().toLocaleDateString('es-ES');
    for (let i = 1; i <= np; i++) { d.setPage(i); ln(285); tx('Generado el ' + hoyTxt + ' con Orvia', M, 290, { s: 8, c: MU }); tx('Página ' + i + ' de ' + np, W - M, 290, { s: 8, c: MU, a: 'right' }); }
    await entregar(`Orvia_Informe_${mes.slice(0, 7)}.pdf`, d.output('arraybuffer'), 'application/pdf');
    aviso('Informe PDF generado');
  } catch (e) {
    aviso('No se pudo generar el informe' + (e?.message ? ': ' + e.message : ''), { error: true });
  }
}

// ---------- Excel ----------

/** Movimientos apuntados en el mes (con las mismas columnas que tu plantilla de Sobrea). */
export async function exportarExcel(motor, k) {
  const mes = motor.mesK(k);
  const lista = motor.libro.movimientos.filter((m) => mesDe(m.fecha) === mes)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado || '').localeCompare(String(b.creado || '')));
  if (!lista.length) return aviso(`No hay movimientos en ${nombreMes(mes)}`);
  let X;
  try {
    X = await cargarScript('xlsx.full.min.js', 'XLSX');
  } catch (e) {
    return aviso(e.message, { error: true });
  }
  try {
    const fecha = (f) => ({ t: 'n', v: Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5) + 25569, z: 'dd/mm/yyyy' });
    const ws = X.utils.aoa_to_sheet([
      ['Fecha', 'Categoría', 'Concepto', 'Importe', 'Nota', 'Repartir en (meses)'],
      ...lista.map((m) => [fecha(m.fecha), motor.porId[m.sobre_id]?.nombre || '', m.concepto || '', Number(m.importe), m.nota || '', m.meses > 1 ? m.meses : '']),
    ]);
    ws['!cols'] = [12, 18, 20, 12, 30, 12].map((w) => ({ wch: w }));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, 'Movimientos');
    await entregar(`Orvia_movimientos_${mes.slice(0, 7)}.xlsx`, X.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    aviso(`${lista.length} movimientos exportados`);
  } catch (e) {
    aviso('No se pudo exportar' + (e?.message ? ': ' + e.message : ''), { error: true });
  }
}
