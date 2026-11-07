// Guía de uso de Finanzas (la de Sobrea, adaptada a Orvia) y su versión en PDF.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { cargarScript, entregar } from './informes.js';

export const GUIA = [
  ['Qué es Finanzas y cómo piensa el dinero', [
    'Finanzas organiza tu dinero por sobres, igual que Sobrea. Cada mes, tu sueldo se reparte en porcentajes: una parte para cada categoría de gasto (gastos fijos, compras, ocio...), otra para el fondo de emergencia y el resto para ahorro e inversión.',
    'Cada categoría tiene así un presupuesto mensual. Tú apuntas lo que gastas dentro de su categoría y Finanzas te dice cuánto te queda. Lo que no gastas no se pierde: se suma al Sobrante, una bolsa común.',
    'Finanzas arranca en enero de 2027 y todas las cantidades están en euros. Las seis pestañas, arriba, son:',
    '• Inicio: el panel principal, con lo que te queda este mes, tu patrimonio, el estado de cada sobre, tus últimos 5 movimientos, los gráficos, tus objetivos y los avisos.',
    '• Mes: lo que te queda para gastar este mes y tus movimientos.',
    '• Sobrante: lo que te ha ido sobrando, tus objetivos y el fondo de emergencia.',
    '• Ahorro: tu cuenta de ahorro, tus inversiones y el patrimonio total.',
    '• Análisis: la evolución de tu patrimonio y de tu gasto.',
    '• Ajustes: todo lo que puedes configurar.']],
  ['Primeros pasos: el inicio guiado', [
    'Al empezar con la configuración básica, un asistente te pide los saldos con los que partes (cuenta diaria, cuenta de ahorro e inversiones), tu sueldo mensual neto, tus pagas extra y el reparto del sueldo entre categorías. Puedes partir de una plantilla de reparto y ajustarla después.',
    'Puedes repetirlo cuando quieras desde Ajustes, en Inicio guiado. Repetirlo actualiza tus saldos, tu sueldo y tus pagas, y no borra ningún movimiento.']],
  ['Apuntar un gasto o un ingreso', [
    'Pulsa el botón + de abajo a la derecha, desde cualquier pantalla de Orvia. Se abre un panel donde indicas el importe, eliges la categoría, el concepto, la fecha y, si quieres, una nota.',
    'Los conceptos son opciones dentro de cada categoría (por ejemplo, en Ocio: Cena, Copas, Eventos). Puedes añadir y quitar conceptos en Ajustes, en Conceptos por categoría.',
    'Si estás viendo otro mes, el + te propone el día 1 de ese mes; si es el mes en curso, hoy.',
    'Repartir en meses: en gastos de una categoría puedes pulsar Repartir en meses e indicar en cuántos meses repartirlo (12 para una suscripción anual, 3 para una trimestral...). Cada mes, desde el de la fecha, cuenta solo su parte en su categoría y en el Sobrante. Tu cuenta diaria sí refleja el pago completo el día que lo haces, como en tu banco. Las cuotas futuras aparecen en sus meses con la marca ↻. Para cambiarlo o quitarlo, toca el movimiento. No está disponible para ingresos ni extraordinarios.',
    'Repetir: pulsa Repetir e indica cada cuántos días, semanas o meses se te cobra (por ejemplo, cada 1 mes para una suscripción, cada 2 semanas para un recibo quincenal). Finanzas apunta sola cada cobro, con su fecha, cuando la abres; si pasan varios días sin abrirla, apunta todos los que hayan vencido. Gestiónalos en Ajustes, Gastos recurrentes: cambiar el importe, pausar o eliminar. Eliminar una regla no borra los cobros ya apuntados, y borrar un cobro apuntado no hace que se vuelva a crear.',
    'Para corregir un movimiento, tócalo en la lista de Movimientos del mes: se abre el mismo panel con sus datos y, al final, un botón para eliminarlo. También puedes borrarlo con la ✕ de su fila.']],
  ['La pestaña Mes', [
    '• Arriba, Te queda para gastar: el presupuesto total del mes menos lo que has gastado en tus categorías. La barra muestra cuánto llevas gastado y, en el mes en curso, una marca indica cuánto del mes ha pasado. Debajo, un mensaje te dice si vas bien, si vas más rápido que el mes o si alguna categoría se ha pasado.',
    '• Sueldo, Cuenta diaria y A ahorro: lo que entra este mes, lo que tienes en la cuenta diaria y lo que pasa a ahorro.',
    '• Sobres: un anillo por categoría con el porcentaje gastado y lo que te queda. Desde el 80 % verás Casi al límite; con 0 € disponibles, Agotado; y si te pasas, Te has pasado en rojo.',
    '• Extraordinarios: gastos imprevistos (salud, coche...) que no cuentan contra tus categorías, sino que salen del fondo de emergencia.',
    '• Movimientos del mes: agrupados por día, con el total gastado cada día.',
    'Las flechas de arriba cambian de mes. Puedes consultar meses pasados y futuros.']],
  ['Sobres y reparto del sueldo', [
    'El presupuesto de una categoría es el sueldo del mes por su porcentaje. Por ejemplo, con un sueldo de 2.000 € y un 13,5 % para Ocio, tendrás 270 € para Ocio ese mes. Las pagas extra suben el sueldo del mes en que caen.',
    'Lo que no repartes entre categorías va a ahorro e inversión. En Ajustes, en Reparto del sueldo, ves el porcentaje que te queda libre; si los porcentajes suman más del 100 %, Finanzas te lo avisa.',
    'Cambiar un porcentaje (o el sueldo) rige desde el mes siguiente: el mes en curso se queda como estaba. Antes de enero de 2027 el cambio se aplica directamente.',
    'En Ajustes, en Categorías de gastos, puedes crear, renombrar, eliminar y colorear categorías. Una categoría nueva empieza con un 0 %: asígnale su porcentaje en Reparto del sueldo.',
    'Para eliminar una categoría, antes tienes que pasar a otra categoría, o borrar, los gastos que tenga desde el mes siguiente. La eliminación rige desde el mes siguiente, tu historial anterior no cambia y puedes cancelarla mientras tanto.']],
  ['Sugerencias de reajuste', [
    'Con el tiempo, tu gasto real puede alejarse del porcentaje que fijaste a cada categoría. Desde el cuarto mes (abril de 2027), en Ajustes, Sugerencias de reajuste, Finanzas compara tu gasto medio de los últimos tres meses con el porcentaje de cada categoría y te propone un cambio si la diferencia es notable.',
    'Nunca cambia nada sola: cada sugerencia tiene un botón Aplicar y otro Ignorar este mes. Si aplicas, el nuevo porcentaje rige desde el mes siguiente y los meses pasados no se tocan. El cambio se limita a 2 puntos por mes y no cuentan los gastos extraordinarios.',
    'Cada sugerencia te enseña cómo cambiaría tu ahorro e inversión, que es lo que queda después de repartir el sueldo: si subes una categoría, baja el ahorro. Así puedes decidir si compensa. Ten en cuenta que ajustar el presupuesto a lo que ya gastas hace que sobre menos en el Sobrante; úsalo cuando el porcentaje original se haya quedado corto o largo, no para dar por bueno un exceso.']],
  ['Sobrante y fondo de emergencia', [
    'El Sobrante es una sola bolsa con todo lo que te ha sobrado desde el principio: cada mes, la suma de presupuesto menos gasto de todas las categorías, más el saldo inicial que hayas indicado. Si en Compras gastas 200 € de 270 €, el Sobrante sube 70 €; si en Ocio te pasas 30 €, baja 30 €. Así lo que sobra en una categoría compensa lo que te pasas en otra. Si queda negativo se marca en rojo.',
    'El Sobrante es un indicador: no mueve dinero entre cuentas. Lo que no gastas sigue en tu cuenta diaria.',
    'El fondo de emergencia recibe cada mes el porcentaje que fijes en Reparto del sueldo, hasta alcanzar el tope que indiques en Saldos iniciales de partida. Una vez alcanzado, ese dinero pasa a ahorro e inversión. Los gastos extraordinarios salen del fondo.']],
  ['Objetivos', [
    'Un objetivo es una meta de ahorro con importe y fechas: por ejemplo, 3.000 € para un viaje entre enero y julio. Lo creas en la pestaña Sobrante, en Objetivos, con nombre, meta y los meses de inicio y fin.',
    'Finanzas calcula la cuota mensual (3.000 € entre 7 meses son 428,57 €) y te dice si vas por delante o por detrás de ese ritmo. Si te atrasas, la cuota de los meses que quedan sube.',
    'Cuando acaba cada mes, al abrir Finanzas te pregunta cuánto destinas al objetivo. Te enseña lo que te sobró ese mes y lo que hay en el Sobrante, y tú indicas cuánto destinas. También puedes pulsar Rellenar con la cuota sugerida, o Aportar en cualquier momento. Si no quieres aportar ese mes, pulsa Omitir este mes; si no es buen momento, Ahora no.',
    'Lo que destinas sale del Sobrante y suma al objetivo. Es una reserva dentro de Finanzas: el dinero sigue en tu cuenta, por lo que no cambian tus saldos ni tu patrimonio. En Detalles puedes cambiar el nombre, la meta o la fecha final, deshacer una aportación (el dinero vuelve al Sobrante) o eliminar el objetivo.']],
  ['Ahorro e inversiones', [
    'Cada mes, la parte del sueldo que no repartes en categorías pasa de la cuenta diaria a la cuenta de ahorro. La cuenta de ahorro incluye el fondo de emergencia; Finanzas te muestra también cuánto hay libre.',
    'Los gastos extraordinarios se restan de la cuenta de ahorro y del fondo, no de la cuenta diaria.',
    'En Mover dinero a inversiones registras lo que inviertes (sale de la cuenta de ahorro) o lo que retiras (vuelve a ella). Para ver tu rentabilidad, indica el valor actual de tu cartera durante el mes en curso. Toca un movimiento de inversión para editarlo o usa su ✕ para borrarlo.']],
  ['Análisis', [
    'El patrimonio total es tu cuenta diaria más tu ahorro más tus inversiones, al cierre del mes más reciente con datos.',
    'Debajo hay dos gráficos, con un filtro de 6 meses, 12 meses o Todo: la evolución del patrimonio y el gasto por mes apilado por categoría. Toca o desliza el dedo sobre un gráfico para ver el detalle de cada mes, y usa Ver como tabla para ver las cifras. Mientras no haya datos verás un ejemplo.']],
  ['Análisis del mes frente a tu media', [
    'En Inicio, el apartado Análisis compara el mes con tu media de los últimos 6 meses cerrados con gastos (necesita al menos 2). No cuenta los extraordinarios, y los gastos repartidos en meses cuentan por su cuota mensual.',
    'En el mes en curso compara lo que llevas gastado con lo que sueles llevar a esa misma fecha, no con el mes entero, y proyecta cuánto cerrarías el mes: lo gastado más lo que sueles gastar en el resto del mes. Con menos de 7 días de mes avisa de que aún no es fiable.',
    'Arriba ves un titular (por encima, por debajo o en línea con tu media), la curva de gasto acumulado del mes frente a tu media y tu presupuesto, y lo más destacado. Debajo, cada categoría tiene una barra con tu gasto y una marca vertical con tu media. Toca una categoría para ver sus conceptos.',
    'Solo se marca una diferencia si supera el 20 % de la media y 15 €, para evitar falsas alarmas con gastos irregulares. Un concepto sin historial aparece como Sin histórico. Si prefieres ver los números, usa Ver como tabla.']],
  ['Informe del mes y exportación', [
    '• Informe del mes (PDF): al final de la pestaña Mes. Genera una página con las cifras clave, el gasto por categoría, los mayores gastos y el resumen de ahorro del mes que estás viendo.',
    '• Exportar movimientos a Excel (pestaña Mes): crea un Excel con los movimientos del mes que estás viendo, en el orden de columnas de la hoja Movimientos de la plantilla, para copiarlos y pegarlos.']],
  ['Ajustes y tus datos', [
    '• Cuentas e ingresos: saldos iniciales, sueldo mensual neto y pagas extra.',
    '• Categorías de ingreso: para ingresos que no son sueldo (devoluciones, regalos...). Suman al dinero disponible del mes y a tu cuenta diaria, pero no se reparten entre sobres ni cambian el Sobrante.',
    '• Saldos iniciales de partida: fondo de emergencia, su tope y el Sobrante con el que empiezas.',
    '• Gastos recurrentes: la lista de cobros que se apuntan solos, para cambiar su importe o frecuencia, pausarlos o eliminarlos.',
    '• Borrar todos los movimientos: pide confirmación y no se puede deshacer. No toca tu configuración.',
    'Todo se guarda automáticamente en tu cuenta de Orvia, y lo ves igual en el móvil y en el ordenador.']],
  ['Preguntas frecuentes', [
    '¿Qué pasa si me paso en una categoría? Se marca en rojo, el Sobrante baja y el Te queda para gastar del mes también. El dinero sale de tu cuenta diaria, sin más consecuencias.',
    '¿Por qué un gasto extraordinario no baja mi cuenta diaria? Porque sale del fondo de emergencia y de la cuenta de ahorro.',
    'He cambiado un porcentaje y este mes no cambia nada. Es normal: el cambio rige desde el mes siguiente.',
    'No puedo ir a antes de enero de 2027. Finanzas arranca en esa fecha.',
    '¿Dónde veo cuánto llevo ahorrado? En la pestaña Ahorro y, acumulado, en Sobrante, en Ahorro e inversión acumulado.']],
];

export function htmlGuia() {
  return GUIA.map(([t, ps], i) => `
    <details class="guia-tema">
      <summary>${escapar(`${i + 1}. ${t}`)}</summary>
      <div class="guia-cuerpo">${ps.map((p) => (p.startsWith('• ') ? `<p class="guia-punto">${escapar(p.slice(2))}</p>` : `<p>${escapar(p)}</p>`)).join('')}</div>
    </details>`).join('');
}

export async function guiaPdf() {
  let jspdf;
  try { jspdf = await cargarScript('jspdf.umd.min.js', 'jspdf'); } catch { return aviso('No se pudo cargar el generador de PDF', { error: true }); }
  try {
    const { jsPDF } = jspdf, d = new jsPDF({ unit: 'mm', format: 'a4' }), W = 210, M = 18, CW = W - 2 * M;
    const INK = '#141b2b', MU = '#5d6678', AC = '#3f3aa8', BD = '#e0e5ee';
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const tx = (t, x, y, o = {}) => { d.setFont('helvetica', o.b ? 'bold' : 'normal'); d.setFontSize(o.s || 10); d.setTextColor(...rgb(o.c || INK)); d.text(String(t), x, y, { align: o.a || 'left' }); };
    let y = 0, primera = true;
    const cabecera = () => {
      if (primera) {
        tx('Orvia', M, 21.6, { b: 1, s: 19 }); tx('Finanzas · Guía de uso', W - M, 21.6, { a: 'right', b: 1, s: 14 });
        d.setDrawColor(...rgb(AC)); d.setLineWidth(0.2); d.line(M, 30, W - M, 30); y = 42;
      } else {
        tx('Orvia · Finanzas · Guía de uso', M, 14, { s: 8.5, c: MU }); d.setDrawColor(...rgb(BD)); d.setLineWidth(0.2); d.line(M, 17, W - M, 17); y = 28;
      }
    };
    const hace = (h) => { if (y + h > 278) { d.addPage(); primera = false; cabecera(); } };
    cabecera();
    GUIA.forEach(([t, ps], i) => {
      hace(22); y += 3; tx(`${i + 1}. ${t}`, M, y, { b: 1, s: 12.5, c: AC }); y += 7;
      ps.forEach((p) => {
        const punto = p.startsWith('• '), s = punto ? p.slice(2) : p;
        d.setFont('helvetica', 'normal'); d.setFontSize(10);
        d.splitTextToSize(s, CW - (punto ? 6 : 0)).forEach((l, j) => {
          hace(6);
          if (punto && j === 0) { d.setFillColor(...rgb(AC)); d.circle(M + 1.4, y - 1.1, 0.8, 'F'); }
          tx(l, M + (punto ? 6 : 0), y, { s: 10 }); y += 5.1;
        });
        y += 2.4;
      });
      y += 3;
    });
    const np = d.getNumberOfPages();
    for (let i = 1; i <= np; i++) { d.setPage(i); d.setDrawColor(...rgb(BD)); d.line(M, 285, W - M, 285); tx('Orvia · Finanzas · Guía de uso', M, 290, { s: 8, c: MU }); tx(`Página ${i} de ${np}`, W - M, 290, { s: 8, c: MU, a: 'right' }); }
    await entregar('Orvia_Finanzas_Guia_de_uso.pdf', d.output('arraybuffer'), 'application/pdf');
    aviso('Guía PDF generada');
  } catch (e) {
    aviso('No se pudo generar la guía' + (e?.message ? ': ' + e.message : ''), { error: true });
  }
}
