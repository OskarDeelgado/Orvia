// Panel: el centro de Orvia. Un resumen que te dice cómo vas y te lleva a cada sitio.
// - Tu día (tareas, eventos y hábitos de hoy, que se marcan aquí mismo).
// - Finanzas: lo que te queda este mes, patrimonio y los sobres más justos.
// - Proyectos en marcha con su siguiente paso y lo que queda en tus listas.
// - Tu equipo: la ficha de cada departamento.
// En el ordenador se reparte en dos columnas; en el móvil, una debajo de otra.
// La oficina 3D se abre solo si la pides (#/oficina).
// Solo lee; no guarda datos propios.

import { escapar, marcaOrvia, ICONOS } from './ui/componentes.js';
import { MODULOS } from '../modules/registro.js';

// Ordenador = pantalla ancha con ratón. Con eso basta para decidir qué Panel mostrar.
export const ES_ESCRITORIO = matchMedia('(min-width: 900px) and (pointer: fine)');

function saludo() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
function fechaLarga() {
  const texto = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
function mesActual() {
  return new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());
}

// Datos clave. Lo que te queda y el patrimonio salen del motor de Finanzas (las
// mismas cuentas que la pestaña Mes); las tareas de hoy, de Acción.
const SIN_DATOS = { queda: '—', patrimonio: '—', tareas: '—', mes: null, hayFinanzas: false };

async function leerTareas() {
  try {
    const { leerHoy } = await import('../modules/accion/datos.js');
    const t = await leerHoy();
    let texto = t.pendientes ? `${t.pendientes} ${t.pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'}`
      : t.hechas ? 'todo hecho ✓' : 'nada pendiente';
    if (t.atrasadas) texto += ` y ${t.atrasadas} ${t.atrasadas === 1 ? 'atrasada' : 'atrasadas'}`;
    return texto;
  } catch {
    return '—';
  }
}

async function leerFinanzas() {
  try {
    const { leerLibro } = await import('../modules/finanzas/motor.js');
    const { euros, nombreMes } = await import('../modules/finanzas/calculo.js');
    const motor = await leerLibro();
    if (!motor) return {};
    const k = motor.kInicial();
    const r = motor.resumenMes(k);
    const mes = nombreMes(r.mes, { anio: false });
    return { queda: euros(r.queda), patrimonio: euros(motor.patrimonio(k).total), mes, etiquetaQueda: `Te quedan en ${mes}`, hayFinanzas: true, resumen: r, euros };
  } catch {
    return {};
  }
}

async function leerDatosClave() {
  const [fin, tareas] = await Promise.all([leerFinanzas(), leerTareas()]);
  return { ...SIN_DATOS, ...fin, tareas };
}

// «Tu día» de Endrick (Acción): tarjeta con evento, tareas y hábitos. Además pone al día
// la ficha de Endrick y, en el ordenador, su despacho de la oficina.
function montarTuDiaEn(caja, { raiz, alResumen } = {}) {
  if (!caja || !MODULOS.some((m) => m.id === 'accion')) return;
  import('../modules/accion/tudia.js')
    .then(({ montarTuDia }) => import('../modules/accion/resumen.js').then(({ situacionDe }) => montarTuDia(caja, {
      alResumen(r) {
        raiz.querySelectorAll('[data-mundo="accion"] .agente-situacion, [data-sala="accion"] .agente-situacion').forEach((el) => { el.textContent = situacionDe(r); });
        alResumen?.(r);
      },
    })))
    .catch(() => { caja.hidden = true; });
}

// Jude (Segundo cerebro): su ficha dice cuántas notas e ideas tienes, y su monitor de la oficina también.
function leerCerebroEn(raiz, alResumen) {
  if (!MODULOS.some((m) => m.id === 'cerebro' && m.estado === 'activo')) return;
  const leer = () => import('../modules/cerebro/resumen.js')
    .then(({ leerResumenCerebro, situacionCerebro }) => leerResumenCerebro().then((r) => {
      if (!raiz.isConnected) return removeEventListener('orvia:cerebro', leer);
      raiz.querySelectorAll('[data-mundo="cerebro"] .agente-situacion, [data-sala="cerebro"] .agente-situacion').forEach((el) => { el.textContent = situacionCerebro(r); });
      alResumen?.(r);
    }))
    .catch(() => {});
  addEventListener('orvia:cerebro', leer);
  leer();
}

function cabecera(nombre) {
  return `
    <header class="panel-cabecera">
      <span class="marca">${marcaOrvia()}Orvia</span>
      <a class="boton-icono" href="#/ajustes" aria-label="Ajustes">${ICONOS.ajustes}</a>
    </header>
    <div class="panel-saludo">
      <p>${fechaLarga()}</p>
      <h1>${saludo()}${nombre ? ', ' + escapar(nombre) : ''}</h1>
    </div>`;
}

function avatar(inicial, color) {
  return `<span class="avatar" style="--c:${color}" aria-hidden="true">${escapar(inicial)}</span>`;
}

/** Ficha de un agente. En el móvil abre su módulo; en el ordenador entra en su despacho. */
function fichaAgente(m, { comoEnlace }) {
  const a = m.agente;
  const contenido = `
    ${avatar(a.nombre.charAt(0), a.color)}
    <span class="agente-texto">
      <span class="agente-nombre">${escapar(a.nombre)}</span>
      <span class="agente-puesto">${escapar(a.puesto)}</span>
      <span class="agente-pie"><span class="chip" style="--c:${a.color}">${escapar(m.nombre)}</span><span class="agente-situacion">${escapar(a.situacion)}</span></span>
    </span>`;
  return comoEnlace
    ? `<a class="agente" href="#/${m.id}" data-mundo="${m.id}" style="--c:${a.color}" aria-label="${escapar(`${a.nombre}, ${a.puesto}. Abrir ${m.nombre}`)}">${contenido}<span class="agente-flecha" aria-hidden="true">›</span></a>`
    : `<button class="agente" type="button" data-sala="${m.id}" style="--c:${a.color}" aria-pressed="false">${contenido}</button>`;
}

// ---------- Tarjetas del Panel ----------

const ICONO_OFICINA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>';

/** Finanzas: la cifra que más miras, cómo vas de ritmo y los sobres a vigilar. */
function htmlFinanzas(datos) {
  const r = datos.resumen;
  if (!r) {
    return `
      <div class="titulo-con-enlace"><h2 id="t-despacho">Finanzas</h2><a class="enlace" href="#/finanzas">Abrir</a></div>
      <p class="suave">${datos.hayFinanzas === false ? 'Las cifras aparecerán cuando pongas en marcha Finanzas.' : 'Cargando…'}</p>`;
  }
  const euros = datos.euros;
  const pct = Math.round(r.fraccionGastada * 100);
  const estado = r.estado.texto.startsWith('Vas más rápido') ? 'Vas más rápido que el mes' : r.estado.tipo === 'bien' ? 'Vas bien' : r.estado.texto;
  const justos = r.sobres
    .filter((x) => x.sobre.tipo === 'gasto' && x.presupuesto > 0)
    .map((x) => ({ ...x, queda: x.presupuesto - x.gastado, uso: x.gastado / x.presupuesto }))
    .sort((a, b) => b.uso - a.uso)
    .slice(0, 3);
  return `
    <div class="titulo-con-enlace"><h2 id="t-despacho">Finanzas</h2><a class="enlace" href="#/finanzas">Abrir</a></div>
    <a class="fin-heroe estado-${r.estado.tipo}" href="#/finanzas">
      <span class="etiqueta">${escapar(datos.etiquetaQueda)}</span>
      <span class="cifra fin-queda${r.queda < -0.004 ? ' negativa' : ''}">${escapar(datos.queda)}</span>
      <span class="barra-mes" role="img" aria-label="${pct} % del presupuesto gastado"><span class="relleno" style="width:${Math.min(100, pct)}%"></span>${r.avanceMes != null ? `<span class="marca-dia" style="left:${(r.avanceMes * 100).toFixed(1)}%"></span>` : ''}</span>
      <span class="fin-estado"><strong>${escapar(estado)}</strong><span class="suave">${pct} % gastado${r.esActual ? ` · día ${r.dia} de ${r.diasMes}` : ''}</span></span>
    </a>
    ${justos.length ? `
      <h3 class="panel-subtitulo">Sobres más justos</h3>
      <ul class="fin-sobres">${justos.map((x) => `
        <li class="${x.queda < -0.004 ? 'pasado' : x.uso >= 0.8 ? 'justo' : ''}">
          <span class="fin-sobre-nombre"><span class="punto" style="--c:${escapar(x.sobre.color || '#6b7280')}"></span>${escapar(x.sobre.nombre)}</span>
          <span class="fin-sobre-cifra">${x.queda < -0.004 ? `Pasado ${euros(-x.queda)}` : `Quedan ${euros(x.queda)}`}</span>
          <span class="fin-sobre-barra" aria-hidden="true"><i style="width:${Math.min(100, x.uso * 100).toFixed(1)}%"></i></span>
        </li>`).join('')}</ul>` : ''}
    <a class="fin-patrimonio" href="#/finanzas"><span class="suave">Patrimonio</span><strong class="cifra">${escapar(datos.patrimonio)}</strong></a>`;
}

/** Proyectos en marcha: progreso y lo siguiente que toca. */
async function htmlProyectos() {
  const { leerProyectos, hoy, fechaCorta } = await import('../modules/accion/datos.js');
  const d = await leerProyectos();
  const h0 = hoy();
  const activos = d.proyectos.filter((p) => p.estado === 'activo');
  const filas = activos.slice(0, 4).map((p) => {
    const tareas = d.tareas.filter((t) => t.proyecto_id === p.id);
    const hechas = tareas.filter((t) => t.estado === 'hecha').length;
    const hitos = d.hitos.filter((x) => x.proyecto_id === p.id).sort((a, b) => a.orden - b.orden);
    const pendiente = tareas.filter((t) => t.estado !== 'hecha')
      .sort((a, b) => String(a.fecha || '9').localeCompare(String(b.fecha || '9')) || a.prioridad - b.prioridad || String(a.creado).localeCompare(String(b.creado)))[0];
    const hito = hitos.find((x) => !x.completado_en);
    const progreso = tareas.length ? hechas / tareas.length : hitos.length ? hitos.filter((x) => x.completado_en).length / hitos.length : 0;
    const pct = Math.round(progreso * 100);
    const siguiente = pendiente
      ? `${escapar(pendiente.titulo)}${pendiente.fecha ? ` · <span class="${pendiente.fecha < h0 ? 'atrasada' : ''}">${pendiente.fecha === h0 ? 'hoy' : fechaCorta(pendiente.fecha)}</span>` : ''}`
      : hito ? `Hito: ${escapar(hito.titulo)}` : 'Añade el siguiente paso';
    return `
      <li><a class="panel-fila" href="#/accion/proyectos/${p.id}">
        <span class="panel-fila-texto"><strong>${escapar(p.titulo)}</strong><span class="suave">${siguiente}</span></span>
        <span class="panel-progreso" style="--p:${pct}" role="img" aria-label="${pct} % hecho"><span>${pct}%</span></span>
      </a></li>`;
  });
  return `
    <div class="titulo-con-enlace"><h2 id="t-proyectos">Proyectos</h2><a class="enlace" href="#/accion/proyectos">${activos.length > 4 ? `Ver los ${activos.length}` : 'Ver todos'}</a></div>
    ${filas.length ? `<ul class="panel-filas">${filas.join('')}</ul>` : '<p class="suave">No tienes proyectos en marcha.</p>'}`;
}

/** Listas: las que tienen algo pendiente, con lo primero que queda. */
async function htmlListas() {
  const { leerListas } = await import('../modules/accion/datos.js');
  const d = await leerListas();
  const conPendientes = d.listas
    .map((l) => ({ l, pendientes: d.elementos.filter((x) => x.lista_id === l.id && !x.hecho).sort((a, b) => a.orden - b.orden || String(a.creado).localeCompare(String(b.creado))) }))
    .filter((x) => x.pendientes.length);
  const filas = conPendientes.slice(0, 3).map(({ l, pendientes }) => `
    <li><a class="panel-fila" href="#/accion/listas/${l.id}">
      <span class="panel-fila-texto"><strong>${escapar(l.nombre)}</strong><span class="suave">${pendientes.slice(0, 2).map((x) => escapar(x.texto)).join(' · ')}${pendientes.length > 2 ? ` y ${pendientes.length - 2} más` : ''}</span></span>
      <span class="panel-cuenta">${pendientes.length}</span>
    </a></li>`);
  return `
    <div class="titulo-con-enlace"><h2 id="t-listas">Listas</h2><a class="enlace" href="#/accion/listas">${d.listas.length ? 'Ver todas' : 'Crear una'}</a></div>
    ${filas.length ? `<ul class="panel-filas">${filas.join('')}</ul>`
      : `<p class="suave">${d.listas.length ? 'Nada pendiente en tus listas ✓' : 'Apunta compras, regalos o lo que llevar a un viaje.'}</p>`}`;
}

/** Rellena una tarjeta con su contenido; si falla (por ejemplo, falta una migración), se oculta. */
function rellenar(raiz, sel, fabricar) {
  const caja = raiz.querySelector(sel);
  if (!caja) return;
  fabricar().then((html) => { if (caja.isConnected) caja.innerHTML = html; }).catch(() => { caja.hidden = true; });
}

/** El Panel: resumen de tu situación con acceso a cada departamento (móvil y ordenador). */
function pintarPanelResumen(raiz, { nombre, ancho }) {
  const hayAccion = MODULOS.some((m) => m.id === 'accion');
  raiz.innerHTML = `
    <main class="panel volviendo${ancho ? ' panel-ancho' : ''}">
      <header class="panel-cabecera">
        <span class="marca">${marcaOrvia()}Orvia</span>
        <span class="panel-acciones">
          ${ancho ? `<a class="boton secundario boton-pequeno boton-oficina" href="#/oficina">${ICONO_OFICINA}Ver la oficina</a>` : ''}
          <a class="boton-icono" href="#/ajustes" aria-label="Ajustes">${ICONOS.ajustes}</a>
        </span>
      </header>
      <div class="panel-saludo">
        <p>${fechaLarga()}</p>
        <h1>${saludo()}${nombre ? ', ' + escapar(nombre) : ''}</h1>
      </div>

      <div class="panel-rejilla">
        <div class="panel-col panel-col-principal">
          ${hayAccion ? '<section class="bloque tu-dia" id="tu-dia" data-mundo="accion" aria-labelledby="t-tu-dia"><p class="suave">Cargando tu día…</p></section>' : ''}
          ${hayAccion ? '<section class="bloque panel-tarjeta panel-proyectos" id="p-proyectos" data-mundo="accion" aria-labelledby="t-proyectos"><p class="suave">Cargando tus proyectos…</p></section>' : ''}
        </div>
        <div class="panel-col">
          <section class="bloque despacho panel-tarjeta" id="p-finanzas" aria-labelledby="t-despacho">${htmlFinanzas({ hayFinanzas: null })}</section>
          ${hayAccion ? '<section class="bloque panel-tarjeta panel-listas" id="p-listas" data-mundo="accion" aria-labelledby="t-listas"></section>' : ''}
        </div>
      </div>

      <section aria-labelledby="t-equipo">
        <h2 id="t-equipo" class="titulo-seccion">Tu equipo</h2>
        <div class="equipo${ancho ? ' equipo-fila' : ''}">${MODULOS.map((m) => fichaAgente(m, { comoEnlace: true })).join('')}</div>
      </section>

      ${ancho ? '' : '<a class="boton secundario ancho" href="#/oficina">Ver la oficina en 3D</a>'}
    </main>`;

  leerDatosClave().then((datos) => {
    const caja = raiz.querySelector('#p-finanzas');
    if (caja?.isConnected) caja.innerHTML = htmlFinanzas(datos);
  });
  montarTuDiaEn(raiz.querySelector('#tu-dia'), { raiz });
  leerCerebroEn(raiz);
  const proyectosYListas = () => {
    rellenar(raiz, '#p-proyectos', htmlProyectos);
    rellenar(raiz, '#p-listas', htmlListas);
  };
  if (hayAccion) proyectosYListas();
  // Si marcas una tarea en «Tu día», el proyecto avanza aquí también.
  const alCambiar = () => (raiz.querySelector('#p-proyectos')?.isConnected ? proyectosYListas() : removeEventListener('orvia:accion', alCambiar));
  if (hayAccion) addEventListener('orvia:accion', alCambiar);
  return () => removeEventListener('orvia:accion', alCambiar);
}

/** Oficina 3D con sus fichas debajo (Panel del ordenador o #/oficina en el móvil). */
function pintarOficina(raiz, { nombre, alAbrirModulo, pantallaCompleta }) {
  const fichaTuya = `
    <button class="agente" type="button" data-sala="direccion" aria-pressed="false" style="--c:#4d8dff">
      ${avatar((nombre || 'Tú').charAt(0), '#4d8dff')}
      <span class="agente-texto">
        <span class="agente-nombre">${escapar(nombre || 'Tu despacho')}</span>
        <span class="agente-puesto">Director general</span>
        <span class="agente-pie"><span class="chip" style="--c:#4d8dff">Dirección</span><span class="agente-situacion">Tus datos clave</span></span>
      </span>
    </button>`;

  // La oficina ocupa toda la pantalla; la cabecera y el equipo flotan encima.
  raiz.innerHTML = `
    <main class="panel-oficina completa volviendo">
      <section class="oficina" id="oficina" aria-label="Oficina en 3D"></section>
      <header class="oficina-cabecera flotante">
        ${pantallaCompleta
          ? `<a class="volver" href="#/" aria-label="Volver al Panel">${ICONOS.volver}</a><h1>Oficina</h1>`
          : `<span class="marca">${marcaOrvia()}Orvia</span>
             <div class="panel-saludo"><p>${fechaLarga()}</p><h1>${saludo()}${nombre ? ', ' + escapar(nombre) : ''}</h1></div>
             <a class="boton-icono" href="#/ajustes" aria-label="Ajustes">${ICONOS.ajustes}</a>`}
      </header>
      <aside class="equipo-flotante flotante" aria-labelledby="t-equipo">
        ${pantallaCompleta ? '' : '<section class="tu-dia tu-dia-flotante" id="tu-dia" data-mundo="accion" aria-labelledby="t-tu-dia"></section>'}
        <h2 id="t-equipo">Tu equipo</h2>
        <div class="equipo">${fichaTuya}${MODULOS.map((m) => fichaAgente(m, { comoEnlace: false })).join('')}</div>
      </aside>
    </main>`;

  const escena = raiz.querySelector('#oficina');
  let oficina = null;
  let cancelado = false;
  let ultimoResumen = null;

  // Tu día: tarjeta en el lateral y datos para el despacho de Endrick (pantalla y decoración).
  const cajaDia = raiz.querySelector('#tu-dia');
  if (cajaDia) montarTuDiaEn(cajaDia, { raiz, alResumen: (r) => { ultimoResumen = r; if (!cancelado) oficina?.actualizarDatos({ accion: r }); } });
  else import('../modules/accion/resumen.js').then(({ leerResumenDia }) => leerResumenDia()).then((r) => { ultimoResumen = r; if (!cancelado) oficina?.actualizarDatos({ accion: r }); }).catch(() => {});
  let ultimoCerebro = null;
  leerCerebroEn(raiz, (r) => { ultimoCerebro = r; if (!cancelado) oficina?.actualizarDatos({ cerebro: r }); });

  // Las fichas entran en el despacho de cada agente.
  raiz.querySelector('.equipo').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-sala]');
    if (!b || !oficina) return;
    oficina.entrar(b.dataset.sala);
  });
  escena.addEventListener('sala', (ev) => {
    raiz.querySelectorAll('.equipo [data-sala]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sala === ev.detail)));
  });

  import('./oficina.js')
    .then(({ montarOficina }) => montarOficina(escena, { modulos: MODULOS, nombreUsuario: nombre, datos: { ...SIN_DATOS }, alAbrirModulo }))
    .then((o) => {
      if (cancelado) return o.destruir();
      oficina = o;
      leerDatosClave().then((datos) => { if (!cancelado) o.actualizarDatos(datos); });
      if (ultimoResumen) o.actualizarDatos({ accion: ultimoResumen });
      if (ultimoCerebro) o.actualizarDatos({ cerebro: ultimoCerebro });
    })
    .catch((e) => {
      console.error(e);
      escena.innerHTML = '<p class="oficina-estado">No se pudo mostrar la oficina en 3D en este dispositivo. Usa las fichas del equipo para entrar en cada área.</p>';
    });

  return () => {
    cancelado = true;
    oficina?.destruir();
  };
}

/** Pinta el Panel adecuado. Devuelve una función que libera lo que haga falta al salir. */
export function pintarPanel(raiz, { sesion, alAbrirModulo, soloOficina = false }) {
  const nombre = sesion?.user?.user_metadata?.nombre;
  if (soloOficina) return pintarOficina(raiz, { nombre, alAbrirModulo, pantallaCompleta: true });
  return pintarPanelResumen(raiz, { nombre, ancho: ES_ESCRITORIO.matches });
}
