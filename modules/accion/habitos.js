// Hábitos con niveles (Acción, bloque 2).
// - pintarHabitosSemana: las tarjetas compactas encima de tu semana.
// - montarHabitos: la pantalla de Hábitos (nivel, hábitos de la semana, áreas y logros).
// Marcar un día da XP al momento; si con eso cumples la semana, lo celebra.

import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import {
  leerHabitos, crearHabito, guardarHabito, eliminarHabito, guardarDia, usarComodin, avisarHabitos,
  hoy, sumarDias, diasDeLaSemana, etiquetaDia, aFecha, lunesDe,
} from './datos.js';
import { crearMotorHabitos, nivelDe, metaDe } from './habitos-motor.js';
import { celebrar, xpFlotante } from './celebracion.js';

const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const num = (n) => Math.round(n).toLocaleString('es-ES');
const SUGERIDOS = [
  { titulo: 'Gimnasio', frecuencia: { tipo: 'semanal', veces: 4 }, dificultad: 3, area: 'Salud', texto: 'Al menos 4 días por semana' },
  { titulo: 'Pasos', frecuencia: { tipo: 'cantidad', meta: 49000, unidad: 'pasos' }, dificultad: 2, area: 'Salud', texto: '49.000 a la semana (7.000 al día de media)' },
];

let estado = null; // { datos, motor }

async function cargar() {
  const datos = await leerHabitos();
  estado = { datos, motor: crearMotorHabitos(datos) };
  return estado;
}

// ---------- Marcar y apuntar (con celebración) ----------

async function marcar(habitoId, fecha, origen, { valor } = {}) {
  const { datos, motor } = estado;
  const antes = motor.porId[habitoId];
  const h = antes.habito;
  const cantidad = h.frecuencia?.tipo === 'cantidad';
  const reg = datos.registros.find((r) => r.habito_id === habitoId && r.fecha === fecha);
  const hecho = cantidad ? valor > 0 : !(reg?.hecho);
  await guardarDia(datos.registros, habitoId, fecha, { hecho, valor: cantidad ? valor : null });
  const nivelAntes = motor.general;
  await cargar();
  const despues = estado.motor.porId[habitoId];
  const diferencia = despues.xp - antes.xp;
  const lunes = lunesDe(fecha);
  const sAntes = antes.semanas.find((s) => s.lunes === lunes);
  const sDespues = despues.semanas.find((s) => s.lunes === lunes);
  if (sDespues?.cumplida && !sAntes?.cumplida) {
    const g = estado.motor.general;
    const sube = g.nivel > nivelAntes.nivel;
    celebrar({
      titulo: cantidad ? `¡Semana de ${h.titulo.toLowerCase()} cumplida!` : `¡Semana de ${h.titulo.toLowerCase()} cumplida!`,
      texto: despues.racha > 1 ? `Llevas <strong>${despues.racha} semanas seguidas</strong>.${despues.racha >= despues.mejor ? ' Tu mejor racha.' : ''}` : 'Primera semana de tu racha.',
      anillo: cantidad ? num(sDespues.total) : `${sDespues.total}/${sDespues.meta}`,
      subAnillo: cantidad ? `de ${num(sDespues.meta)} ${h.frecuencia.unidad || ''}` : 'semana cumplida',
      premios: [diferencia > 100 ? `+${diferencia - 100} XP` : null, '+100 XP semana'].filter(Boolean),
      mensaje: sube ? `¡Subes a nivel ${g.nivel}! Sigue así.` : `Buen trabajo. Te quedan ${num(g.hasta - g.xp)} XP para el nivel ${g.nivel + 1}.`,
      nivel: { nivel: g.nivel, desde: g.desde, hasta: g.hasta, antes: sube ? g.desde : nivelAntes.xp, despues: g.xp },
    });
  } else if (diferencia > 0) {
    xpFlotante(origen, `+${diferencia} XP`);
    if (estado.motor.general.nivel > nivelAntes.nivel) aviso(`¡Subes a nivel ${estado.motor.general.nivel}!`);
  } else if (diferencia < 0) {
    xpFlotante(origen, `${diferencia} XP`);
  }
  avisarHabitos();
}

/** Panel para apuntar la cantidad de un día (pasos). */
function abrirCantidad(habitoId, fecha) {
  const { datos, motor } = estado;
  const r = motor.porId[habitoId];
  const unidad = r.habito.frecuencia.unidad || '';
  const reg = datos.registros.find((x) => x.habito_id === habitoId && x.fecha === fecha);
  const { cuerpo, cerrar } = abrirHojaBase(`${r.habito.titulo}: ${etiquetaDia(fecha).toLowerCase()}`, { mundo: 'accion' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-cantidad" novalidate>
      <div class="campo">
        <label for="cantidad-valor">${escapar(unidad ? unidad.charAt(0).toUpperCase() + unidad.slice(1) : 'Cantidad')} del día</label>
        <input id="cantidad-valor" inputmode="numeric" autocomplete="off" placeholder="7.000" value="${reg?.valor ? num(reg.valor) : ''}">
      </div>
      <p class="ayuda">Con el atajo «Pasos a Orvia» se apuntan solos desde la app Salud; aquí puedes corregirlos.</p>
      <button class="boton ancho" type="submit">Guardar</button>
    </form>`;
  const campo = cuerpo.querySelector('#cantidad-valor');
  setTimeout(() => campo.focus(), 80);
  cuerpo.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = Number(campo.value.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor < 0 || valor > 1e7) return aviso('Escribe una cifra válida', { error: true });
    cerrar('guardado');
    try {
      await marcar(habitoId, fecha, document.querySelector(`[data-dia-cantidad="${habitoId}|${fecha}"]`), { valor });
    } catch (err) {
      aviso(err.message, { error: true });
    }
  });
}

// ---------- Tarjetas ----------

function anillo(total, meta, tam = 84) {
  const p = Math.min(100, meta > 0 ? (total / meta) * 100 : 0);
  return `<svg class="habito-anillo${p >= 100 ? ' completo' : ''}" width="${tam}" height="${tam}" viewBox="0 0 100 100" role="img" aria-label="${total} de ${meta} días esta semana">
    <circle cx="50" cy="50" r="40" class="pista"/>
    ${p > 0 ? `<circle cx="50" cy="50" r="40" class="lleno" pathLength="100" stroke-dasharray="${p} 100" transform="rotate(-90 50 50)"/>` : ''}
    <text x="50" y="${tam > 60 ? 47 : 50}" text-anchor="middle" dominant-baseline="central" class="cifra">${total}/${meta}</text>
    ${tam > 60 ? '<text x="50" y="66" text-anchor="middle" class="sub">días</text>' : ''}
  </svg>`;
}

function tarjetaSemanal(r, h0) {
  const { habito: h, actual } = r;
  const dias = diasDeLaSemana(actual.lunes);
  const falta = Math.max(0, actual.meta - actual.total);
  return `
    <section class="cristal habito" aria-labelledby="hab-${h.id}">
      <div class="habito-cabecera">
        ${anillo(actual.total, actual.meta)}
        <div class="habito-info">
          <div class="habito-titulo"><h3 id="hab-${h.id}">${escapar(h.titulo)}</h3>${r.racha ? `<span class="racha">${r.racha} ${r.racha === 1 ? 'semana' : 'semanas'}</span>` : ''}</div>
          <span class="suave">Al menos ${actual.meta} ${actual.meta === 1 ? 'día' : 'días'} · ${h.dificultad * 10} XP por día</span>
          <span class="habito-estado">${actual.cumplida ? '✓ Semana cumplida' + (actual.total > actual.meta ? `, y ${actual.total - actual.meta} de propina` : '') : `Te ${falta === 1 ? 'falta 1 día' : `faltan ${falta} días`} para cumplir la semana`}</span>
        </div>
      </div>
      <div class="habito-dias" role="group" aria-label="Días de esta semana">
        ${dias.map((d, i) => {
          const hecho = !!actual.dias[d];
          const futuro = d > h0;
          return `<button type="button" class="habito-dia${hecho ? ' hecho' : ''}${d === h0 ? ' hoy' : ''}" data-marcar-habito="${h.id}|${d}" aria-pressed="${hecho}" ${futuro ? 'disabled' : ''} aria-label="${DIAS_LARGOS[i]}${d === h0 ? ', hoy' : ''}: ${hecho ? 'hecho' : futuro ? 'aún no' : 'sin marcar'}">${LETRAS[i]}</button>`;
        }).join('')}
      </div>
      <button class="enlace editar-habito" type="button" data-editar-habito="${h.id}">Editar</button>
    </section>`;
}

function tarjetaCantidad(r, h0) {
  const { habito: h, actual } = r;
  const unidad = h.frecuencia.unidad || '';
  const dias = diasDeLaSemana(actual.lunes);
  const p = Math.min(100, (actual.total / actual.meta) * 100);
  const max = Math.max(actual.meta / 7, ...dias.map((d) => actual.dias[d] || 0));
  const quedan = dias.filter((d) => d >= h0).length;
  const falta = Math.max(0, actual.meta - actual.total);
  return `
    <section class="cristal habito" aria-labelledby="hab-${h.id}">
      <div class="habito-titulo"><h3 id="hab-${h.id}">${escapar(h.titulo)}</h3>${r.racha ? `<span class="racha">${r.racha} ${r.racha === 1 ? 'semana' : 'semanas'}</span>` : ''}</div>
      <p class="habito-cifra"><span>${num(actual.total)}</span> <span class="suave">de ${num(actual.meta)}</span></p>
      <div class="barra-habito${p >= 100 ? ' completa' : ''}" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapar(h.titulo)} de la semana"><i style="width:${p}%"></i></div>
      <div class="habito-barras" role="group" aria-label="${escapar(unidad || 'Cantidad')} por día. Toca un día para apuntarlo">
        ${dias.map((d, i) => {
          const v = actual.dias[d] || 0;
          const futuro = d > h0;
          return `<button type="button" class="habito-barra${d === h0 ? ' hoy' : ''}" data-dia-cantidad="${h.id}|${d}" ${futuro ? 'disabled' : ''} aria-label="${DIAS_LARGOS[i]}: ${v ? num(v) : 'sin datos'}">
            <i style="height:${Math.max(4, (v / max) * 100)}%" class="${v >= actual.meta / 7 ? 'llega' : ''}${v ? '' : ' vacia'}"></i><span>${LETRAS[i]}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="habito-pie">
        <span class="suave">${actual.dias[h0] ? `Hoy ${num(actual.dias[h0])}` : 'Hoy sin datos'}</span>
        <span class="habito-estado">${actual.cumplida ? '✓ Semana cumplida' : quedan ? `${num(Math.ceil(falta / quedan))} al día para llegar` : ''}</span>
      </div>
      <button class="enlace editar-habito" type="button" data-editar-habito="${h.id}">Editar</button>
    </section>`;
}

const tarjeta = (r, h0) => (r.cantidad ? tarjetaCantidad(r, h0) : tarjetaSemanal(r, h0));

function bannerComodin(motor) {
  const r = motor.resumenes.find((x) => x.puedeComodin);
  if (!r) return '';
  const rachaSalvada = (() => { let n = 0; const s = r.semanas; for (let i = s.length - 3; i >= 0 && (s[i].cumplida || s[i].comodin); i--) n++; return n; })();
  return `
    <section class="cristal comodin" aria-labelledby="t-comodin">
      <h3 id="t-comodin">¿Usas tu comodín?</h3>
      <p class="suave">La semana pasada no llegaste en ${escapar(r.habito.titulo.toLowerCase())} (${r.cantidad ? num(r.pasada.total) : r.pasada.total} de ${r.cantidad ? num(r.pasada.meta) : r.pasada.meta}). Con el comodín de este mes no pierdes tu racha de ${rachaSalvada} ${rachaSalvada === 1 ? 'semana' : 'semanas'}.</p>
      <button class="boton" type="button" data-comodin="${r.habito.id}|${r.pasada.lunes}">Usar comodín</button>
    </section>`;
}

const ICONOS_LOGRO = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  llama: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 3 2.5 3 5"/>',
  pesa: '<path d="M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12"/>',
  pasos: '<path d="M8 4c-2 3-2 6 0 8s2 5 0 8M16 4c-2 3-2 6 0 8s2 5 0 8"/>',
  estrella: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};

// ---------- Tarjetas compactas en tu semana ----------

/** Encima de la semana: tu nivel y los hábitos de esta semana, para marcar sin cambiar de pantalla. */
export async function pintarHabitosSemana(caja, { dia, incrustado = false } = {}) {
  try {
    await cargar();
  } catch (e) {
    caja.innerHTML = '';
    return;
  }
  const { motor } = estado;
  const h0 = hoy();
  const marcarEn = dia && dia <= h0 && lunesDe(dia) === lunesDe(h0) ? dia : h0;
  if (!motor.resumenes.length) {
    if (incrustado) { caja.innerHTML = '<a class="enlace" href="#/accion/habitos">Crea tus hábitos y gana XP</a>'; return; }
    caja.innerHTML = `<a class="cristal habitos-vacio" href="#/accion/habitos"><strong>Hábitos</strong><span class="suave">Gana XP y sube de nivel con tus hábitos. Empieza aquí.</span></a>`;
    return;
  }
  const g = motor.general;
  const tarjetas = `
      <div class="habitos-mini">
        ${motor.resumenes.map((r) => {
          const { habito: h, actual } = r;
          if (r.cantidad) {
            const p = Math.min(100, (actual.total / actual.meta) * 100);
            return `<button type="button" class="habito-mini" data-dia-cantidad="${h.id}|${marcarEn}" aria-label="${escapar(h.titulo)}: ${num(actual.total)} de ${num(actual.meta)}. Apuntar">
              <span class="habito-mini-titulo"><strong>${escapar(h.titulo)}</strong><span class="suave">${Math.round(p)} %</span></span>
              <span class="barra-habito${p >= 100 ? ' completa' : ''}"><i style="width:${p}%"></i></span>
              <span class="suave">${num(actual.total)} de ${num(actual.meta)}</span>
            </button>`;
          }
          const hecho = !!actual.dias[marcarEn];
          const falta = Math.max(0, actual.meta - actual.total);
          return `<button type="button" class="habito-mini${hecho ? ' hecho' : ''}" data-marcar-habito="${h.id}|${marcarEn}" aria-pressed="${hecho}" aria-label="${escapar(h.titulo)}: ${hecho ? 'hecho' : 'marcar hecho'} ${escapar(etiquetaDia(marcarEn).toLowerCase())}. Llevas ${actual.total} de ${actual.meta}">
            <span class="habito-mini-titulo"><strong>${escapar(h.titulo)}</strong>${anillo(actual.total, actual.meta, 34)}</span>
            <span class="habito-mini-estado">${hecho ? '✓ Hecho' : 'Toca para marcar'}</span>
            <span class="suave">${actual.cumplida ? 'Semana cumplida' : `${actual.total}/${actual.meta} · ${falta === 1 ? 'uno más y semana cumplida' : `faltan ${falta}`}`}</span>
          </button>`;
        }).join('')}
      </div>`;
  if (incrustado) { caja.innerHTML = tarjetas; return; }
  caja.innerHTML = `
    <section class="cristal habitos-semana" aria-labelledby="t-hab-semana">
      <div class="titulo-con-enlace">
        <h2 id="t-hab-semana">Hábitos${marcarEn !== h0 ? ` · ${escapar(etiquetaDia(marcarEn).toLowerCase())}` : ''}</h2>
        <a class="chip-nivel" href="#/accion/habitos" aria-label="Ver hábitos: nivel ${g.nivel}"><span>${g.nivel}</span>Nivel</a>
      </div>
      ${tarjetas}
    </section>`;
}

/** Clics de las tarjetas de hábitos (en la semana y en la pantalla de Hábitos). Devuelve true si eran suyos. */
export async function alClicHabitos(e) {
  const b = e.target.closest('[data-marcar-habito],[data-dia-cantidad],[data-comodin],[data-editar-habito],[data-sugerido],[data-nuevo-habito]');
  if (!b || !estado) return false;
  const d = b.dataset;
  try {
    if (d.marcarHabito) {
      const [id, fecha] = d.marcarHabito.split('|');
      b.disabled = true;
      await marcar(id, fecha, b);
    } else if (d.diaCantidad) {
      const [id, fecha] = d.diaCantidad.split('|');
      abrirCantidad(id, fecha);
    } else if (d.comodin) {
      const [id, semana] = d.comodin.split('|');
      b.disabled = true;
      await usarComodin(id, semana);
      aviso('Comodín usado: tu racha sigue viva');
      avisarHabitos();
    } else if (d.editarHabito) {
      abrirHojaHabito(estado.motor.porId[d.editarHabito]?.habito);
    } else if (d.sugerido != null) {
      const s = SUGERIDOS[+d.sugerido];
      const area = estado.datos.areas.find((a) => a.nombre === s.area);
      b.disabled = true;
      await crearHabito({ titulo: s.titulo, frecuencia: s.frecuencia, dificultad: s.dificultad, area_id: area?.id || null, orden: estado.datos.habitos.length });
      aviso(`Hábito creado: ${s.titulo}`);
      avisarHabitos();
    } else if (d.nuevoHabito != null) {
      abrirHojaHabito(null);
    }
  } catch (err) {
    aviso(err.message, { error: true });
    b.disabled = false;
  }
  return true;
}

// ---------- Pantalla de Hábitos ----------

export async function montarHabitos(contenedor) {
  contenedor.innerHTML = '<p class="suave">Cargando tus hábitos…</p>';
  const pintar = async () => {
    try {
      await cargar();
    } catch (e) {
      contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>`;
      return;
    }
    if (contenedor.isConnected) pintarPantalla(contenedor);
  };
  contenedor.addEventListener('click', alClicHabitos);
  const alCambiar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:accion', alCambiar);
    pintar();
  };
  addEventListener('orvia:accion', alCambiar);
  await pintar();
}

function pintarPantalla(contenedor) {
  const { motor, datos } = estado;
  const h0 = hoy();
  const g = motor.general;
  const lunes = motor.lunesHoy;
  const sugeridos = SUGERIDOS.map((s, i) => ({ s, i })).filter(({ s }) => !datos.habitos.some((h) => h.titulo.toLowerCase() === s.titulo.toLowerCase()));
  const areas = Object.entries(motor.porArea).map(([id, xp]) => ({ area: datos.porArea[id], xp, n: nivelDe(xp) })).sort((a, b) => b.xp - a.xp);
  const conseguidos = motor.logros.filter((l) => l.ok).length;
  const mejorArea = areas[0];

  contenedor.innerHTML = `
    
    <section class="cristal nivel-general" aria-label="Tu nivel">
      <div class="insignia-nivel" aria-hidden="true"><span>Nivel</span><strong>${g.nivel}</strong></div>
      <div class="nivel-info">
        <div class="fila-nivel"><strong>Nivel ${g.nivel}</strong><span class="suave">${num(g.xp)} / ${num(g.hasta)} XP</span></div>
        <div class="barra-nivel" role="progressbar" aria-valuenow="${Math.round(g.progreso * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso hacia el nivel ${g.nivel + 1}"><i style="width:${g.progreso * 100}%"></i></div>
        <span class="suave">${mejorArea?.area ? `${escapar(mejorArea.area.nombre)} · nivel ${mejorArea.n.nivel} · ` : ''}${motor.comodinesDisponibles ? '1 comodín este mes' : 'Comodín del mes usado'}</span>
      </div>
    </section>

    ${bannerComodin(motor)}

    <h2 class="titulo-seccion">Esta semana · ${escapar(etiquetaDia(lunes, { relativo: false }).replace(/^\w+ /, ''))} – ${aFecha(sumarDias(lunes, 6)).getDate()}</h2>
    ${motor.resumenes.length ? `<div class="habitos-lista">${motor.resumenes.map((r) => tarjeta(r, h0)).join('')}</div>`
      : '<p class="suave">Aún no tienes hábitos. Empieza con uno de estos o crea el tuyo.</p>'}

    <div class="habitos-acciones">
      ${sugeridos.map(({ s, i }) => `<button class="boton secundario" type="button" data-sugerido="${i}"><strong>+ ${escapar(s.titulo)}</strong><span>${escapar(s.texto)}</span></button>`).join('')}
      <button class="boton secundario" type="button" data-nuevo-habito><strong>+ Otro hábito</strong><span>Días por semana o una cifra semanal</span></button>
    </div>

    ${areas.length ? `<section class="cristal" aria-labelledby="t-areas-hab">
      <h2 id="t-areas-hab">Tus áreas</h2>
      ${areas.map(({ area, xp, n }) => `<div class="area-nivel">
        <span class="punto" style="--c:${area ? `var(--area-${area.color})` : 'var(--tinta-apagada)'}"></span>
        <span class="area-nombre">${escapar(area?.nombre || 'Sin área')}</span>
        <span class="barra-nivel fina"><i style="width:${n.progreso * 100}%;background:${area ? `var(--area-${area.color})` : 'var(--tinta-apagada)'}"></i></span>
        <span class="suave area-n" title="${num(xp)} XP">nv. ${n.nivel}</span>
      </div>`).join('')}
      <p class="suave ayuda">Cada área sube con los hábitos que le asignes.</p>
    </section>` : ''}

    <section class="cristal" aria-labelledby="t-logros">
      <div class="titulo-con-enlace"><h2 id="t-logros">Logros</h2><span class="suave">${conseguidos} de ${motor.logros.length}</span></div>
      <div class="logros">
        ${motor.logros.map((l) => `<div class="logro${l.ok ? ' ok' : ''} ${l.icono}">
          <span class="medalla" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${l.ok ? ICONOS_LOGRO[l.icono] : '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>'}</svg></span>
          <span class="logro-nombre">${escapar(l.nombre)}<span class="visualmente-oculto">${l.ok ? ': conseguido' : ': pendiente'}</span></span>
        </div>`).join('')}
      </div>
    </section>

    <section class="cristal ayuda-xp" aria-labelledby="t-xp">
      <h2 id="t-xp">Cómo se gana XP</h2>
      <ul>
        <li>Días por semana: 10, 20 o 30 XP por día hecho, según la dificultad.</li>
        <li>Cifras semanales (pasos): 1 XP por cada 1.000.</li>
        <li>Semana cumplida: +100 XP y la racha sube una semana.</li>
        <li>Un comodín al mes salva una semana mala para no perder la racha.</li>
      </ul>
    </section>`;
}

// ---------- Crear y editar un hábito ----------

export function abrirHojaHabito(habito) {
  const editando = !!habito;
  const f = habito?.frecuencia || { tipo: 'semanal', veces: 4 };
  const st = {
    tipo: f.tipo === 'cantidad' ? 'cantidad' : 'semanal',
    veces: f.veces || 4,
    meta: f.meta || 49000,
    unidad: f.unidad || 'pasos',
    dificultad: habito?.dificultad || 2,
    area: habito?.area_id || null,
  };
  const areas = estado?.datos.areas || [];
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar hábito' : 'Nuevo hábito', { mundo: 'accion' });
  const pintar = () => {
    cuerpo.innerHTML = `
      <form class="hoja-form" id="form-habito" novalidate>
        <div class="campo"><label for="hab-titulo">Hábito</label><input id="hab-titulo" maxlength="200" autocomplete="off" placeholder="Leer" value="${escapar(cuerpo.querySelector('#hab-titulo')?.value ?? habito?.titulo ?? '')}"></div>
        <div class="campo"><span class="etiqueta-campo" id="et-tipo">Cómo se cumple</span>
          <div class="segmentos" role="group" aria-labelledby="et-tipo">
            <button type="button" class="segmento" data-tipo="semanal" aria-pressed="${st.tipo === 'semanal'}">Días por semana</button>
            <button type="button" class="segmento" data-tipo="cantidad" aria-pressed="${st.tipo === 'cantidad'}">Cifra semanal</button>
          </div>
        </div>
        ${st.tipo === 'semanal' ? `
          <div class="campo"><span class="etiqueta-campo" id="et-veces">Al menos</span>
            <div class="chips-elegir" role="group" aria-labelledby="et-veces">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="chip-opcion" data-veces="${n}" aria-pressed="${st.veces === n}">${n} ${n === 1 ? 'día' : 'días'}</button>`).join('')}</div>
          </div>
          <div class="campo"><span class="etiqueta-campo" id="et-dif">Dificultad</span>
            <div class="segmentos" role="group" aria-labelledby="et-dif">${[[1, 'Fácil · 10 XP'], [2, 'Media · 20 XP'], [3, 'Difícil · 30 XP']].map(([v, l]) => `<button type="button" class="segmento" data-dificultad="${v}" aria-pressed="${st.dificultad === v}">${l}</button>`).join('')}</div>
          </div>` : `
          <div class="dos-campos">
            <div class="campo"><label for="hab-meta">Meta semanal</label><input id="hab-meta" inputmode="numeric" value="${num(st.meta)}"></div>
            <div class="campo"><label for="hab-unidad">Unidad</label><input id="hab-unidad" maxlength="30" value="${escapar(st.unidad)}"></div>
          </div>
          <p class="ayuda">1 XP por cada 1.000 y +100 XP al llegar a la meta de la semana.</p>`}
        ${areas.length ? `<div class="campo"><span class="etiqueta-campo" id="et-area-h">Área de tu vida</span>
          <div class="chips-elegir" role="group" aria-labelledby="et-area-h">${areas.map((a) => `<button type="button" class="chip-opcion chip-area" data-area="${a.id}" aria-pressed="${st.area === a.id}" style="--c:var(--area-${a.color})"><span class="punto" style="--c:var(--area-${a.color})"></span>${escapar(a.nombre)}</button>`).join('')}</div>
        </div>` : ''}
        <button class="boton ancho" type="submit">${editando ? 'Guardar cambios' : 'Crear hábito'}</button>
        ${editando ? '<button class="boton peligro ancho" type="button" id="hab-eliminar">Eliminar hábito</button>' : ''}
      </form>`;
  };
  const recoger = () => {
    const m = cuerpo.querySelector('#hab-meta');
    if (m) st.meta = Number(m.value.replace(/\./g, '').replace(',', '.')) || 0;
    const u = cuerpo.querySelector('#hab-unidad');
    if (u) st.unidad = u.value.trim();
  };
  pintar();
  setTimeout(() => { if (!editando) cuerpo.querySelector('#hab-titulo')?.focus(); }, 80);
  cuerpo.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.tipo) { recoger(); st.tipo = d.tipo; pintar(); }
    else if (d.veces) { st.veces = +d.veces; pintar(); }
    else if (d.dificultad) { st.dificultad = +d.dificultad; pintar(); }
    else if (d.area) { recoger(); st.area = st.area === d.area ? null : d.area; pintar(); }
    else if (b.id === 'hab-eliminar') {
      if (d.confirmar !== '1') {
        d.confirmar = '1';
        b.textContent = 'Pulsa otra vez: se borra con su historial';
        return;
      }
      try {
        await eliminarHabito(habito.id);
        aviso('Hábito eliminado');
        cerrar('guardado');
        avisarHabitos();
      } catch (err) { aviso(err.message, { error: true }); }
    }
  });
  cuerpo.addEventListener('submit', async (e) => {
    e.preventDefault();
    recoger();
    const titulo = cuerpo.querySelector('#hab-titulo').value.trim();
    if (!titulo) return aviso('Ponle un nombre al hábito', { error: true });
    if (st.tipo === 'cantidad' && !(st.meta > 0)) return aviso('Indica la meta semanal', { error: true });
    const frecuencia = st.tipo === 'cantidad' ? { tipo: 'cantidad', meta: st.meta, unidad: st.unidad || '' } : { tipo: 'semanal', veces: st.veces };
    try {
      if (editando) await guardarHabito(habito.id, { titulo, frecuencia, dificultad: st.dificultad, area_id: st.area });
      else await crearHabito({ titulo, frecuencia, dificultad: st.dificultad, area_id: st.area, orden: estado?.datos.habitos.length || 0 });
      aviso(editando ? 'Cambios guardados' : `Hábito creado: ${titulo}`);
      cerrar('guardado');
      avisarHabitos();
    } catch (err) { aviso(err.message, { error: true }); }
  });
}

// ---------- Atajo del iPhone: #/pasos?n=8432 ----------

/** Guarda los pasos de un día (hoy por defecto) en el primer hábito de pasos. */
// Cifra tal como la manda Atajos: «8432», «8.432», «8432,57», «8432.57», «8.432,5»…
// Un separador seguido de 1 o 2 cifras al final es decimal; los demás son de miles.
function leerCifra(texto) {
  let t = String(texto || '').replace(/[^\d.,]/g, '');
  const dec = t.match(/[.,](\d{1,2})$/);
  if (dec) t = t.slice(0, -dec[0].length).replace(/[.,]/g, '') + '.' + dec[1];
  else t = t.replace(/[.,]/g, '');
  return t ? Math.round(Number(t)) : NaN;
}

export async function apuntarPasosDesdeAtajo(params) {
  const n = leerCifra(params.get('n'));
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha') || '') ? params.get('fecha') : hoy();
  if (!(n >= 0)) throw new Error('El atajo no ha enviado una cifra de pasos');
  await cargar();
  const r = estado.motor.resumenes.find((x) => x.cantidad && /paso/i.test(x.habito.frecuencia.unidad || x.habito.titulo));
  if (!r) throw new Error('Crea primero el hábito de pasos en Acción → Hábitos');
  await marcar(r.habito.id, fecha, null, { valor: n });
  aviso(`Pasos de ${etiquetaDia(fecha).toLowerCase()}: ${num(n)}`);
  return metaDe(r.habito);
}
