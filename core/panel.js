// Panel: el centro de Orvia.
// - En el ordenador: la oficina 3D, con las fichas del equipo debajo.
// - En el móvil: un panel ligero con tu despacho (datos clave) y la ficha de cada
//   agente; la oficina 3D se abre solo si la pides (#/oficina).
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
    return { queda: euros(r.queda), patrimonio: euros(motor.patrimonio(k).total), mes, etiquetaQueda: `Te quedan en ${mes}`, hayFinanzas: true };
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
    ? `<a class="agente" href="#/${m.id}" data-mundo="${m.id}" aria-label="${escapar(`${a.nombre}, ${a.puesto}. Abrir ${m.nombre}`)}">${contenido}<span class="agente-flecha" aria-hidden="true">›</span></a>`
    : `<button class="agente" type="button" data-sala="${m.id}" aria-pressed="false">${contenido}</button>`;
}

/** Panel ligero del móvil. */
function pintarPanelMovil(raiz, { nombre }) {
  const d = SIN_DATOS;
  raiz.innerHTML = `
    <main class="panel volviendo">
      ${cabecera(nombre)}

      <section class="bloque despacho" aria-labelledby="t-despacho">
        <h2 id="t-despacho">Tu despacho</h2>
        <div class="datos-clave">
          <a class="dato" href="#/finanzas"><span class="etiqueta" id="dc-etiqueta">Te quedan en ${mesActual()}</span><span class="cifra" id="dc-queda">${d.queda}</span></a>
          <a class="dato" href="#/finanzas"><span class="etiqueta">Patrimonio</span><span class="cifra" id="dc-patrimonio">${d.patrimonio}</span></a>
        </div>
        <p class="nota-despacho" id="dc-nota" hidden></p>
      </section>

      <section class="bloque tu-dia" id="tu-dia" data-mundo="accion" aria-labelledby="t-tu-dia"><p class="suave">Cargando tu día…</p></section>

      <section aria-labelledby="t-equipo">
        <h2 id="t-equipo" class="titulo-seccion">Tu equipo</h2>
        <div class="equipo">${MODULOS.map((m) => fichaAgente(m, { comoEnlace: true })).join('')}</div>
      </section>

      <a class="boton secundario ancho" href="#/oficina">Ver la oficina en 3D</a>
    </main>`;
  leerDatosClave().then((datos) => {
    if (!raiz.isConnected || !raiz.querySelector('#dc-queda')) return;
    raiz.querySelector('#dc-queda').textContent = datos.queda;
    raiz.querySelector('#dc-patrimonio').textContent = datos.patrimonio;
    if (datos.mes) raiz.querySelector('#dc-etiqueta').textContent = datos.etiquetaQueda;
    const nota = raiz.querySelector('#dc-nota');
    nota.hidden = datos.hayFinanzas;
    nota.textContent = 'Las cifras aparecerán cuando pongas en marcha Finanzas.';
  });
  montarTuDiaEn(raiz.querySelector('#tu-dia'), { raiz });
  return () => {};
}

/** Oficina 3D con sus fichas debajo (Panel del ordenador o #/oficina en el móvil). */
function pintarOficina(raiz, { nombre, alAbrirModulo, pantallaCompleta }) {
  const fichaTuya = `
    <button class="agente" type="button" data-sala="direccion" aria-pressed="false">
      ${avatar((nombre || 'Tú').charAt(0), '#8ab4ff')}
      <span class="agente-texto">
        <span class="agente-nombre">${escapar(nombre || 'Tu despacho')}</span>
        <span class="agente-puesto">Director general</span>
        <span class="agente-pie"><span class="chip" style="--c:#8ab4ff">Dirección</span><span class="agente-situacion">Tus datos clave</span></span>
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
  if (ES_ESCRITORIO.matches) return pintarOficina(raiz, { nombre, alAbrirModulo, pantallaCompleta: false });
  return pintarPanelMovil(raiz, { nombre });
}
