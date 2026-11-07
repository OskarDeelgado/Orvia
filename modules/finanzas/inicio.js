// Pestaña Inicio de Finanzas: igual que en Sobrea.
// Te queda (con el anillo de gastado), patrimonio y su variación, sobres del mes con
// Extraordinarios y Sobrante, últimos movimientos, análisis frente a tu media,
// evolución, objetivos, avisos y Fondo de emergencia.

import { escapar } from '../../core/ui/componentes.js';
import { euros, nombreMes } from './calculo.js';
import { montarVista, cabeceraMes, cifraGrande } from './vista.js';
import { anillo, animarCifra } from './mes.js';
import { abrirHojaGasto } from './hoja.js';
import { abrirAportacion } from './objetivos.js';
import { htmlComparativa, abiertas } from './comparativa.js';
import { cabeceraEvolucion, pintarEvolucion, evolucion } from './evolucion.js';
import { activarRecorrido } from './graficos.js';

const ICONO_ESTADO = { bien: '✓', atencion: '⚠', mal: '▲' };
const irA = (pestana) => dispatchEvent(new CustomEvent('orvia:finanzas-pestana', { detail: pestana }));

export function montarInicio(contenedor) {
  const registro = new Map();
  activarRecorrido(contenedor, registro);
  return montarVista(contenedor, {
    pintar: (c, motor, k) => pintar(c, motor, k, registro),
    alClic(e, { motor, k, repintar }) {
      const ir = e.target.closest('[data-ir]');
      if (ir) return irA(ir.dataset.ir);
      const mov = e.target.closest('[data-mov]');
      if (mov) {
        const m = motor.libro.movimientos.find((x) => x.id === mov.dataset.mov);
        if (m) abrirHojaGasto({ movimiento: m });
        return;
      }
      const cierre = e.target.closest('[data-cierre]');
      if (cierre) {
        const [id, kk] = cierre.dataset.cierre.split(':');
        return abrirAportacion(motor, id, +kk, false);
      }
      const cat = e.target.closest('[data-categoria]');
      if (cat) {
        const id = cat.dataset.categoria;
        if (abiertas.has(id)) abiertas.delete(id); else abiertas.add(id);
        const tarjeta = contenedor.querySelector('#tarjeta-analisis');
        tarjeta.innerHTML = htmlComparativa(motor, k);
        tarjeta.querySelector(`[data-categoria="${id}"]`)?.focus({ preventScroll: true });
        return;
      }
      const rango = e.target.closest('[data-rango]');
      if (rango) {
        evolucion.rango = Number(rango.dataset.rango);
        contenedor.querySelectorAll('[data-rango]').forEach((b) => b.setAttribute('aria-pressed', String(b === rango)));
        registro.clear();
        pintarEvolucion(contenedor.querySelector('.evolucion-graficos'), motor, registro);
      }
      void repintar;
    },
  });
}

function pintar(contenedor, motor, k, registro) {
  const r = motor.resumenMes(k);
  const negativo = r.queda < -0.004;
  const pct = Math.round(r.fraccionGastada * 100);
  const mesCorto = nombreMes(r.mes, { anio: false });
  const Mes = mesCorto.replace(/^./, (c) => c.toUpperCase());
  // En Inicio, Sobrea dice "Vas más rápido que el mes" sin el porcentaje.
  const estadoTexto = r.estado.texto.startsWith('Vas más rápido') ? 'Vas más rápido que el mes' : r.estado.tipo === 'bien' ? 'Vas bien' : r.estado.texto;

  const pm = motor.patrimonio(k), pp = k > 0 ? motor.patrimonio(k - 1) : null, delta = pp ? pm.total - pp.total : null;
  const anterior = k > 0 ? nombreMes(motor.mesK(k - 1), { anio: false }) : '';
  const fondo = motor.fondoEn(k), tope = Number(motor.libro.config.fondo_tope) || 0;
  const pendientes = motor.objetivos.map((o) => motor.objetivo(o)).filter((g) => !g.conseguido);
  const conseguidos = motor.objetivos.length - pendientes.length;
  const ultimos = [...motor.libro.movimientos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.creado || '').localeCompare(String(a.creado || '')))
    .slice(0, 5);
  const avisos = motor.avisos(k);

  contenedor.innerHTML = `
    ${cabeceraMes(motor, k)}

    <section class="cristal heroe-inicio estado-${r.estado.tipo}" aria-labelledby="t-inicio-queda">
      <div>
        <h2 id="t-inicio-queda" class="heroe-titulo">Te queda para gastar en ${escapar(Mes)}</h2>
        <p class="heroe-cifra cifra${negativo ? ' negativa' : ''}" id="cifra-queda">${cifraGrande(r.queda)}</p>
        <p class="heroe-estado"><span aria-hidden="true">${ICONO_ESTADO[r.estado.tipo]}</span> ${escapar(estadoTexto)}</p>
        <p class="heroe-pie">de ${euros(r.total)}${r.ingresosExtra ? ` (incluye ${euros(r.ingresosExtra)} de ingresos extra)` : ''}${r.esActual ? ` · día ${r.dia} de ${r.diasMes}` : ''}</p>
      </div>
      <svg class="anillo-grande" viewBox="0 0 120 120" role="img" aria-label="${pct} % del presupuesto del mes gastado">
        <circle cx="60" cy="60" r="43" class="anillo-centro"/>
        <circle cx="60" cy="60" r="52" class="anillo-pista"/>
        ${r.fraccionGastada > 0 ? `<circle cx="60" cy="60" r="52" class="anillo-avance-grande" pathLength="100" stroke-dasharray="${Math.min(100, r.fraccionGastada * 100).toFixed(2)} 100" transform="rotate(-90 60 60)"/>` : ''}
        <text x="60" y="56" text-anchor="middle" dominant-baseline="central" class="anillo-pct">${pct} %</text>
        <text x="60" y="76" text-anchor="middle" class="anillo-sub">gastado</text>
      </svg>
    </section>

    <div class="rejilla-inicio">
      <section class="cristal" aria-labelledby="t-patrimonio">
        <h2 id="t-patrimonio">Patrimonio</h2>
        <p class="cifra-grande cifra">${cifraGrande(pm.total)}</p>
        ${delta != null
          ? `<p class="${delta >= 0 ? 'texto-exito' : 'texto-peligro'}">${delta >= 0 ? '▲' : '▼'} ${euros(Math.abs(delta))} frente a ${escapar(anterior)}</p>`
          : '<p class="suave">Cuenta diaria + ahorro + inversiones</p>'}
        <div class="caja">
          <div class="fila"><span class="suave">Cuenta diaria</span><strong>${euros(pm.cuenta)}</strong></div>
          <div class="fila"><span class="suave">Ahorro</span><strong>${euros(pm.ahorro)}</strong></div>
          <div class="fila"><span class="suave">Inversiones</span><strong>${euros(pm.inversion)}</strong></div>
        </div>
      </section>

      <section class="cristal" aria-labelledby="t-sobres-inicio">
        <div class="titulo-con-enlace"><h2 id="t-sobres-inicio">Sobres de ${escapar(mesCorto)}</h2><button class="enlace" type="button" data-ir="mes">Ver el mes</button></div>
        <div class="anillos">${r.sobres.map(anillo).join('')}</div>
        <div class="caja">
          <div class="fila"><strong>Extraordinarios</strong><span class="suave">${euros(r.extraordinarios)} · sale del fondo</span></div>
          <div class="fila"><strong>Sobrante</strong><span>${euros(motor.sobrante(k))}</span></div>
        </div>
      </section>

      <section class="cristal" aria-labelledby="t-ultimos">
        <div class="titulo-con-enlace"><h2 id="t-ultimos">Últimos movimientos</h2><button class="enlace" type="button" data-ir="mes">Ver todos</button></div>
        ${ultimos.length ? `<ul class="lista-movs lista-plana">${ultimos.map((m) => filaUltimo(motor, m)).join('')}</ul>`
          : '<div class="vacio"><p><strong>Aún no hay movimientos</strong></p><p class="suave">Pulsa el botón + para apuntar tu primer gasto o ingreso.</p></div>'}
      </section>

      <section class="cristal g-tarjeta tarjeta-ancha" id="tarjeta-analisis" aria-label="Análisis del mes frente a tu media">${htmlComparativa(motor, k)}</section>

      <div class="tarjeta-ancha">${cabeceraEvolucion()}</div>

      <section class="cristal" aria-labelledby="t-obj-inicio">
        <div class="titulo-con-enlace"><h2 id="t-obj-inicio">Objetivos</h2><button class="enlace" type="button" data-ir="sobrante">${pendientes.length ? 'Gestionar' : 'Crear'}</button></div>
        ${pendientes.length ? pendientes.slice(0, 3).map((g) => {
          const p = Math.min(100, g.meta > 0 ? (g.aportado / g.meta) * 100 : 0);
          return `<div class="objetivo-mini"><div class="fila"><span>${escapar(g.o.titulo)}</span><span class="suave">${Math.round(p)} %</span></div>
            <div class="barra" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de ${escapar(g.o.titulo)}"><i style="width:${p}%"></i></div>
            <p class="suave">${euros(g.aportado)} de ${euros(g.meta)} · hasta ${escapar(motor.nombreMesK(g.m1))}</p></div>`;
        }).join('') + (pendientes.length > 3 ? `<p class="suave">y ${pendientes.length - 3} más</p>` : '')
          : '<p class="suave">Fija una meta, por ejemplo 3.000 € para un viaje, y Orvia te dice cuánto destinar cada mes.</p>'}
        ${conseguidos ? `<p class="suave">${conseguidos} ${conseguidos === 1 ? 'objetivo conseguido' : 'objetivos conseguidos'} ✓</p>` : ''}
      </section>

      <section class="cristal" aria-labelledby="t-avisos">
        <h2 id="t-avisos">Avisos</h2>
        ${avisos.map((a) => `<div class="aviso-fila"><i class="aviso-${a.tipo}" aria-hidden="true">${a.icono}</i><div>${escapar(a.texto)}${a.accion ? `<button class="boton secundario boton-pequeno" type="button" ${a.accion.cierre ? `data-cierre="${a.accion.cierre}"` : `data-ir="${a.accion.pestana}"`}>${escapar(a.accion.etiqueta)}</button>` : ''}</div></div>`).join('')}
      </section>

      <section class="cristal" aria-labelledby="t-fondo-inicio">
        <h2 id="t-fondo-inicio">Fondo de emergencia</h2>
        <div class="fila fila-cifra"><span class="cifra-grande cifra">${cifraGrande(fondo.f)}</span><span class="suave">tope ${euros(tope)}</span></div>
        <div class="barra" role="progressbar" aria-valuenow="${Math.round(tope > 0 ? Math.min(100, (fondo.f / tope) * 100) : 0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Fondo de emergencia"><i style="width:${tope > 0 ? Math.min(100, (fondo.f / tope) * 100) : 0}%"></i></div>
        <p class="suave">Este mes se le pasan ${euros(fondo.aporta)}</p>
        <div class="caja">
          <div class="fila"><span class="suave">A ahorro e inversión este mes</span><strong>${euros(motor.traspaso(k))}</strong></div>
          <div class="fila"><span class="suave">Ahorro e inversión acumulado</span><strong>${euros(motor.ahorroEInversion(k))}</strong></div>
        </div>
      </section>
    </div>`;

  registro.clear();
  pintarEvolucion(contenedor.querySelector('.evolucion-graficos'), motor, registro);
  animarCifra(contenedor.querySelector('#cifra-queda'), r.queda);
}

function filaUltimo(motor, m) {
  const s = motor.porId[m.sobre_id] || { nombre: '(eliminada)', color: '#6b7280', tipo: 'gasto' };
  const ingreso = s.tipo === 'ingreso';
  const dia = `${+m.fecha.slice(8)} ${nombreMes(m.fecha.slice(0, 8) + '01', { anio: false }).slice(0, 3)}`;
  return `<li><button class="mov" type="button" data-mov="${m.id}">
      <span class="punto" style="--c:${s.color}"></span>
      <span class="mov-texto"><span class="mov-concepto">${escapar(m.concepto || s.nombre)}${m.meses > 1 ? ' <span class="suave">↻</span>' : ''}</span><span class="mov-detalle">${escapar(s.nombre)} · ${dia}</span></span>
      <span class="mov-importe cifra-fila${ingreso ? ' ingreso' : ''}">${ingreso ? '+' : ''}${euros(Number(m.importe))}</span>
    </button></li>`;
}
