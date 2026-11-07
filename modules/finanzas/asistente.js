// Inicio guiado de Finanzas, como el de Sobrea: 3 pasos.
// 1) Saldos de partida  2) Sueldo y pagas extra  3) Plantilla de reparto.
// Se abre al empezar con la configuración básica y desde Ajustes → Inicio guiado.
// Repetirlo cambia saldos, sueldo, pagas y (si eliges plantilla) porcentajes; no borra movimientos.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { euros, leerImporte } from './calculo.js';
import { leerLibro } from './motor.js';
import { abrirHojaBase } from './hojabase.js';
import { guardarConfig, guardarSueldo, guardarPorcentaje } from './reglas.js';
import { crear, archivar } from '../../core/db.js';
import { avisarCambio } from './vista.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_PAGA = [6, 12, 3, 9];
const PLANTILLAS = {
  eq: { nombre: 'Equilibrado', texto: 'Parecido a la regla 50/30/20: lo esencial pesa más, con margen para caprichos y un ahorro sólido.', p: { F: 0.5, C: 0.15, O: 0.15, X: 0.05 } },
  ah: { nombre: 'Ahorrador', texto: 'Gastos más contenidos para ahorrar e invertir más cada mes.', p: { F: 0.4, C: 0.08, O: 0.1, X: 0.07 } },
  keep: { nombre: 'Mantener el actual', texto: 'Dejas el reparto como está y lo ajustas después en Ajustes.', p: null },
};
const pctTexto = (x) => String(+(x * 100).toFixed(1)).replace('.', ',') + ' %';
const valor = (v) => (v ? String(v).replace('.', ',') : '');

/**
 * @param {object} [opciones]
 * @param {boolean} [opciones.repetir]  true desde Ajustes (por defecto, plantilla "Mantener el actual")
 */
export async function abrirAsistente({ repetir = false } = {}) {
  const motor = await leerLibro();
  if (!motor) return;
  const c = motor.libro.config;
  const pagas = [...motor.libro.pagas].sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  const d = {
    saldo: Number(c.saldo_inicial) || 0, ahorro: Number(c.ahorro_inicial) || 0, inversion: Number(c.inversion_inicial) || 0,
    sueldo: motor.libro.sueldos.length ? Number(motor.libro.sueldos.at(-1).importe) || 0 : 0,
    pagas: pagas.map((p) => ({ mes: p.mes_del_anio, importe: Number(p.importe) || 0 })),
    plantilla: repetir ? 'keep' : 'eq',
  };
  let paso = 1, terminado = false;
  const { cuerpo, cerrar } = abrirHojaBase('Inicio guiado', {
    alCerrar: () => { if (!terminado && !repetir) dispatchEvent(new CustomEvent('orvia:finanzas-pestana', { detail: 'ajustes' })); },
  });
  cuerpo.closest('.hoja').classList.add('hoja-asistente');

  const vivos = motor.gasto.filter((s) => !s.hasta_mes);
  const reparto = (t) => {
    const p = PLANTILLAS[t].p;
    const filas = vivos.map((s) => [s.nombre, p && p[s.clave_sobrea] != null ? p[s.clave_sobrea] : motor.ultimoPorcentaje(s)]);
    filas.push(['Fondo de emergencia', p ? p.X : motor.fondo ? motor.ultimoPorcentaje(motor.fondo) : 0]);
    return filas;
  };
  const campo = (id, etiqueta, v) => `<div class="campo"><label for="${id}">${etiqueta}</label><input id="${id}" inputmode="decimal" autocomplete="off" placeholder="0" value="${valor(v)}"></div>`;
  const leer = (id) => { const el = cuerpo.querySelector('#' + id); if (!el) return undefined; const v = leerImporte(el.value); return v > 0 ? v : 0; };
  const recoger = () => {
    if (paso === 1) { d.saldo = leer('as-saldo'); d.ahorro = leer('as-ahorro'); d.inversion = leer('as-inversion'); }
    if (paso === 2) {
      d.sueldo = leer('as-sueldo');
      d.pagas.forEach((p, i) => { p.mes = +cuerpo.querySelector('#as-mes' + i).value; p.importe = leer('as-paga' + i); });
    }
  };

  const pintar = () => {
    let b = '';
    if (paso === 1) {
      b = `<h3 class="asistente-titulo">Empecemos por tu punto de partida</h3>
        <p class="suave">Con tres datos Finanzas queda lista para ${escapar(motor.nombreMesK(0).toLowerCase())}. Todo se puede cambiar después en Ajustes.</p>
        ${campo('as-saldo', 'Saldo de tu cuenta diaria (€)', d.saldo)}${campo('as-ahorro', 'Saldo de tu cuenta de ahorro (€)', d.ahorro)}${campo('as-inversion', 'Dinero ya invertido (€)', d.inversion)}
        <p class="suave">Si no tienes ahorro o inversiones, déjalo en blanco.</p>`;
    } else if (paso === 2) {
      b = `<h3 class="asistente-titulo">¿Cuánto ingresas al mes?</h3>
        <p class="suave">Tu sueldo neto mensual. Si cobras pagas extra, indica cuántas y en qué mes.</p>
        ${campo('as-sueldo', 'Sueldo mensual neto (€)', d.sueldo)}
        <div class="campo"><label for="as-npagas">Pagas extra al año</label><select id="as-npagas">${[0, 1, 2, 3, 4].map((i) => `<option${i === d.pagas.length ? ' selected' : ''}>${i}</option>`).join('')}</select></div>
        ${d.pagas.map((p, i) => `<div class="dos-campos">
          <div class="campo"><label for="as-mes${i}">Mes de la paga ${i + 1}</label><select id="as-mes${i}">${MESES.map((m, j) => `<option value="${j + 1}"${j + 1 === p.mes ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
          ${campo('as-paga' + i, 'Importe (€)', p.importe)}</div>`).join('')}`;
    } else {
      b = `<h3 class="asistente-titulo">¿Cómo quieres repartirlo?</h3>
        <p class="suave">Cada mes tu sueldo se reparte en sobres. Elige un punto de partida; luego puedes afinar cada porcentaje.</p>
        <div class="plantillas">${Object.keys(PLANTILLAS).map((t) => {
          const l = reparto(t), resto = 1 - l.reduce((a, x) => a + x[1], 0);
          return `<button type="button" class="plantilla" data-plantilla="${t}" aria-pressed="${d.plantilla === t}">
            <strong>${PLANTILLAS[t].nombre}${d.plantilla === t ? ' ✓' : ''}</strong>
            <span class="suave">${PLANTILLAS[t].texto}</span>
            <span class="plantilla-reparto">${l.map((x) => `${escapar(x[0])} ${pctTexto(x[1])}`).join(' · ')}</span>
            <strong class="plantilla-ahorro">Ahorro e inversión: ${pctTexto(resto)}${d.sueldo ? ` · ${euros(d.sueldo * resto)} al mes` : ''}</strong>
          </button>`;
        }).join('')}</div>`;
    }
    cuerpo.innerHTML = `
      <div class="asistente-pasos"><span>${[1, 2, 3].map((i) => `<i class="${i <= paso ? 'hecho' : ''}"></i>`).join('')}</span><span class="suave">Paso ${paso} de 3</span></div>
      ${b}
      <div class="dos-botones">
        ${paso > 1 ? '<button class="boton secundario" type="button" data-as="atras">Atrás</button>' : '<span></span>'}
        <button class="boton" type="button" data-as="seguir">${paso < 3 ? 'Continuar' : 'Empezar a usar Finanzas'}</button>
      </div>
      <button class="enlace saltar" type="button" data-as="saltar">Saltar por ahora</button>`;
    cuerpo.querySelector('input')?.focus({ preventScroll: true });
  };

  cuerpo.addEventListener('change', (e) => {
    if (e.target.id !== 'as-npagas') return;
    recoger();
    const n = +e.target.value;
    while (d.pagas.length > n) d.pagas.pop();
    while (d.pagas.length < n) d.pagas.push({ mes: MESES_PAGA[d.pagas.length], importe: d.sueldo || 0 });
    pintar();
  });
  cuerpo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); cuerpo.querySelector('[data-as="seguir"]')?.click(); }
  });
  cuerpo.addEventListener('click', async (e) => {
    const pl = e.target.closest('[data-plantilla]');
    if (pl) { d.plantilla = pl.dataset.plantilla; pintar(); return; }
    const b = e.target.closest('[data-as]');
    if (!b) return;
    const accion = b.dataset.as;
    if (accion === 'saltar') { cerrar(); return; }
    recoger();
    if (accion === 'atras') { paso--; pintar(); return; }
    if (paso === 2 && !(d.sueldo > 0)) return aviso('Indica tu sueldo mensual neto', { error: true });
    if (paso < 3) { paso++; pintar(); return; }
    b.disabled = true;
    b.textContent = 'Guardando…';
    try {
      await terminar(d);
      terminado = true;
      cerrar('hecho');
      avisarCambio();
      dispatchEvent(new CustomEvent('orvia:finanzas-pestana', { detail: 'inicio' }));
      aviso('Todo listo. Ya puedes añadir tu primer gasto');
    } catch (err) {
      aviso(err.message, { error: true });
      b.disabled = false;
      b.textContent = 'Empezar a usar Finanzas';
    }
  });
  pintar();
}

async function terminar(d) {
  let motor = await leerLibro();
  await guardarConfig(motor, { saldo_inicial: d.saldo, ahorro_inicial: d.ahorro, inversion_inicial: d.inversion });
  await guardarSueldo(motor, d.sueldo);
  for (const p of motor.libro.pagas) await archivar('fin_pagas_extra', p.id);
  for (const p of d.pagas) await crear('fin_pagas_extra', { mes_del_anio: p.mes, importe: p.importe || d.sueldo || 0, concepto: 'Paga extra' });
  const plantilla = PLANTILLAS[d.plantilla].p;
  if (plantilla) {
    motor = await leerLibro(); // con el sueldo nuevo
    for (const s of motor.gasto.filter((x) => !x.hasta_mes)) {
      if (plantilla[s.clave_sobrea] != null) await guardarPorcentaje(motor, s, plantilla[s.clave_sobrea]);
    }
    if (motor.fondo) await guardarPorcentaje(motor, motor.fondo, plantilla.X);
  }
}
