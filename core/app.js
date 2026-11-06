// Carcasa de Orvia: sesión, navegación y ajustes.
// Rutas: #/ → Panel · #/oficina → oficina 3D (móvil) · #/<módulo> → el mundo de ese módulo · #/ajustes.
// No contiene lógica de ningún módulo; solo los monta según la ruta.

import {
  sesionActual,
  alCambiarSesion,
  entrar,
  recuperarContrasena,
  cambiarContrasena,
  cerrarSesion,
  guardarNombre,
  LONGITUD_MINIMA,
} from './auth.js';
import { exportarTodo } from './db.js';
import { asegurarAreasIniciales } from './areas.js';
import { escapar, aviso, globo, ICONOS } from './ui/componentes.js';
import { pintarPanel, ES_ESCRITORIO } from './panel.js';
import { MODULOS } from '../modules/registro.js';

const raiz = document.getElementById('raiz');
let sesion = null;
let recuperando = false;
let areasComprobadas = false;
let origenZoom = null; // punto de la pantalla desde el que se entra en un módulo
let rutaAnterior = null;
let limpiarVista = null; // libera la vista anterior (la oficina 3D usa la tarjeta gráfica)

// ---------- Arranque ----------
async function arrancar() {
  // Si se abre desde el correo de recuperación, la dirección trae type=recovery.
  recuperando = /type=recovery/.test(location.hash + location.search);
  sesion = await sesionActual();
  pintar();
  alCambiarSesion((evento, nueva) => {
    if (evento === 'PASSWORD_RECOVERY') {
      recuperando = true;
      sesion = nueva;
      pintar();
      return;
    }
    const cambio = Boolean(nueva) !== Boolean(sesion);
    sesion = nueva;
    if (cambio) pintar();
  });
  window.addEventListener('hashchange', () => sesion && !recuperando && mostrarRuta());
  // Si la ventana pasa de ordenador a móvil (o al revés) estando en el Panel, se repinta.
  ES_ESCRITORIO.addEventListener('change', () => sesion && !recuperando && rutaActual() === '' && mostrarRuta());
}

async function pintar() {
  limpiarVista?.();
  limpiarVista = null;
  if (recuperando && sesion) {
    pintarNuevaContrasena();
    return;
  }
  if (!sesion) {
    pintarAcceso();
    return;
  }
  if (!areasComprobadas) {
    areasComprobadas = true;
    asegurarAreasIniciales().catch((e) => aviso(e.message, { error: true }));
  }
  mostrarRuta();
}

// ---------- Pantalla de acceso ----------
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailGuardado() {
  try {
    return localStorage.getItem('orvia-email') || '';
  } catch {
    return '';
  }
}

function mostrarError(el, texto) {
  el.textContent = texto;
  el.hidden = !texto;
}

function pintarAcceso() {
  const email = emailGuardado();
  raiz.innerHTML = `
    <main class="acceso">
      <div class="caja">
        ${globo(96)}
        <div>
          <h1>Orvia</h1>
          <p class="suave">Tu vida, en un solo sitio.</p>
        </div>
        <form id="form-entrar" novalidate>
          <div class="campo">
            <label for="email">Correo</label>
            <input id="email" type="email" autocomplete="username" inputmode="email" required value="${escapar(email)}">
          </div>
          <div class="campo">
            <label for="contrasena">Contraseña</label>
            <input id="contrasena" type="password" autocomplete="current-password" required>
          </div>
          <p class="error" id="error-entrar" role="alert" hidden></p>
          <p class="confirmacion" id="ok-entrar" role="status" hidden></p>
          <button class="boton ancho" type="submit">Entrar</button>
          <button class="boton secundario ancho" type="button" id="olvido">He olvidado mi contraseña</button>
        </form>
      </div>
    </main>`;

  const form = raiz.querySelector('#form-entrar');
  const campoEmail = raiz.querySelector('#email');
  const campoContrasena = raiz.querySelector('#contrasena');
  const error = raiz.querySelector('#error-entrar');
  const ok = raiz.querySelector('#ok-entrar');
  (email ? campoContrasena : campoEmail).focus();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    mostrarError(ok, '');
    const valor = campoEmail.value.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(valor)) return mostrarError(error, 'Escribe un correo válido, por ejemplo nombre@gmail.com.');
    if (!campoContrasena.value) return mostrarError(error, 'Escribe tu contraseña.');
    mostrarError(error, '');
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true;
    boton.textContent = 'Entrando…';
    try {
      await entrar(valor, campoContrasena.value);
      try {
        localStorage.setItem('orvia-email', valor);
      } catch {}
    } catch (e) {
      mostrarError(error, e.message);
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }
  });

  raiz.querySelector('#olvido').addEventListener('click', async (ev) => {
    const valor = campoEmail.value.trim().toLowerCase();
    mostrarError(ok, '');
    if (!EMAIL_VALIDO.test(valor)) {
      campoEmail.focus();
      return mostrarError(error, 'Escribe arriba tu correo y vuelve a pulsar «He olvidado mi contraseña».');
    }
    mostrarError(error, '');
    const boton = ev.currentTarget;
    boton.disabled = true;
    try {
      await recuperarContrasena(valor);
      mostrarError(ok, `Te he enviado un correo a ${valor}. Ábrelo en este dispositivo y pulsa el enlace para poner una contraseña nueva.`);
    } catch (e) {
      mostrarError(error, e.message);
    } finally {
      boton.disabled = false;
    }
  });
}

// Formulario de contraseña nueva, reutilizado en la recuperación y en Ajustes.
function formularioContrasena(id, textoBoton) {
  return `
    <form id="${id}" novalidate>
      <div class="campo">
        <label for="${id}-nueva">Contraseña nueva</label>
        <input id="${id}-nueva" type="password" autocomplete="new-password" minlength="${LONGITUD_MINIMA}" required>
        <span class="ayuda">Al menos ${LONGITUD_MINIMA} caracteres.</span>
      </div>
      <div class="campo">
        <label for="${id}-repite">Repite la contraseña</label>
        <input id="${id}-repite" type="password" autocomplete="new-password" required>
      </div>
      <p class="error" id="${id}-error" role="alert" hidden></p>
      <button class="boton" type="submit">${textoBoton}</button>
    </form>`;
}

function conectarFormularioContrasena(contenedor, id, textoBoton, alTerminar) {
  const form = contenedor.querySelector('#' + id);
  const error = contenedor.querySelector(`#${id}-error`);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nueva = contenedor.querySelector(`#${id}-nueva`).value;
    const repite = contenedor.querySelector(`#${id}-repite`).value;
    if (nueva.length < LONGITUD_MINIMA) return mostrarError(error, `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
    if (nueva !== repite) return mostrarError(error, 'Las dos contraseñas no coinciden.');
    mostrarError(error, '');
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      await cambiarContrasena(nueva);
      form.reset();
      alTerminar();
    } catch (e) {
      mostrarError(error, e.message);
    } finally {
      boton.disabled = false;
      boton.textContent = textoBoton;
    }
  });
}

function pintarNuevaContrasena() {
  raiz.innerHTML = `
    <main class="acceso">
      <div class="caja">
        ${globo(96)}
        <div>
          <h1>Contraseña nueva</h1>
          <p class="suave">Elige la contraseña con la que entrarás a partir de ahora.</p>
        </div>
        ${formularioContrasena('form-recuperar', 'Guardar contraseña')}
      </div>
    </main>`;
  raiz.querySelector('#form-recuperar-nueva').focus();
  conectarFormularioContrasena(raiz, 'form-recuperar', 'Guardar contraseña', () => {
    recuperando = false;
    history.replaceState(null, '', location.pathname + '#/');
    aviso('Contraseña guardada');
    pintar();
  });
}

// ---------- Navegación ----------
function rutaActual() {
  return (location.hash.replace(/^#\/?/, '').split('/')[0] || '').toLowerCase();
}

// El botón "+" está siempre a mano. Hoy apunta un gasto (llega con Finanzas).
function botonMas() {
  const boton = document.createElement('button');
  boton.className = 'boton-mas';
  boton.type = 'button';
  boton.setAttribute('aria-label', 'Apuntar un gasto');
  boton.innerHTML = ICONOS.mas;
  boton.addEventListener('click', () => aviso('Apuntar gastos llega con Finanzas, antes del 20 de diciembre.'));
  return boton;
}

/** Pinta el mundo de un módulo o de Ajustes: aurora de su color, flecha de vuelta y contenido. */
function pintarMundo({ id, titulo }) {
  const desdePanel = (rutaAnterior === '' || rutaAnterior === 'oficina') && origenZoom;
  raiz.innerHTML = `
    <div class="mundo${desdePanel ? ' entrar' : ''}" ${id ? `data-mundo="${id}"` : ''}>
      <span class="aurora a1" aria-hidden="true"></span>
      <span class="aurora a2" aria-hidden="true"></span>
      <main class="mundo-contenido">
        <header class="mundo-cabecera">
          <a class="volver" href="#/" aria-label="Volver al Panel">${ICONOS.volver}</a>
          <h1>${escapar(titulo)}</h1>
        </header>
        <div id="contenido"></div>
      </main>
    </div>`;
  if (desdePanel) {
    const mundo = raiz.querySelector('.mundo');
    mundo.style.setProperty('--origen-x', origenZoom.x + 'px');
    mundo.style.setProperty('--origen-y', origenZoom.y + 'px');
  }
  origenZoom = null;
  return raiz.querySelector('#contenido');
}

// Abrir un módulo desde la oficina: el zoom de entrada sale del centro de la escena.
function abrirModuloDesdeOficina(id) {
  const escena = document.getElementById('oficina');
  const r = escena?.getBoundingClientRect();
  origenZoom = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  location.hash = '#/' + id;
}

async function mostrarRuta() {
  const id = rutaActual();
  limpiarVista?.();
  limpiarVista = null;
  window.scrollTo(0, 0);

  if (id === '' || id === 'oficina') {
    document.title = id === 'oficina' ? 'Oficina · Orvia' : 'Orvia';
    limpiarVista = pintarPanel(raiz, { sesion, alAbrirModulo: abrirModuloDesdeOficina, soloOficina: id === 'oficina' });
    // En el móvil, el zoom de entrada sale de la ficha tocada.
    raiz.querySelectorAll('a.agente').forEach((a) =>
      a.addEventListener('click', () => {
        const r = a.querySelector('.avatar').getBoundingClientRect();
        origenZoom = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }),
    );
    raiz.append(botonMas());
  } else if (id === 'ajustes') {
    document.title = 'Ajustes · Orvia';
    pintarAjustes(pintarMundo({ id: null, titulo: 'Ajustes' }));
  } else {
    const modulo = MODULOS.find((m) => m.id === id);
    if (!modulo) {
      location.replace('#/');
      return;
    }
    document.title = `${modulo.nombre} · Orvia`;
    const contenedor = pintarMundo({ id: modulo.id, titulo: modulo.nombre });
    raiz.querySelector('.mundo').append(botonMas());
    try {
      await modulo.montar(contenedor, { sesion });
    } catch (e) {
      contenedor.innerHTML = `<p class="suave">No se pudo abrir ${escapar(modulo.nombre)}: ${escapar(e.message)}</p>`;
    }
  }
  rutaAnterior = id;
}

// ---------- Ajustes ----------
function pintarAjustes(contenedor) {
  const nombre = sesion?.user?.user_metadata?.nombre || '';
  contenedor.innerHTML = `
    <section class="bloque">
      <h2>Cuenta</h2>
      <p class="suave" style="margin-bottom:var(--esp-4)">Has entrado como ${escapar(sesion?.user?.email || '')}.</p>
      <details class="desplegable">
        <summary>Cambiar contraseña</summary>
        ${formularioContrasena('form-cambiar', 'Cambiar contraseña')}
      </details>
    </section>
    <section class="bloque">
      <h2>Tu nombre</h2>
      <form id="form-nombre" class="fila-nombre" novalidate>
        <div class="campo">
          <label for="nombre" class="oculto-visual">Nombre con el que te saluda el Panel</label>
          <input id="nombre" autocomplete="given-name" maxlength="40" value="${escapar(nombre)}" placeholder="Cómo quieres que te salude el Panel">
        </div>
        <button class="boton secundario" type="submit">Guardar</button>
      </form>
    </section>
    <section class="bloque">
      <h2>Copia de seguridad</h2>
      <p class="suave" style="margin-bottom:var(--esp-4)">Descarga todos tus datos en un archivo que puedes guardar donde quieras.</p>
      <button class="boton secundario" id="exportar" type="button">Descargar copia</button>
    </section>
    <section class="bloque">
      <button class="boton peligro" id="salir" type="button">Cerrar sesión</button>
    </section>`;

  conectarFormularioContrasena(contenedor, 'form-cambiar', 'Cambiar contraseña', () => {
    contenedor.querySelector('.desplegable').open = false;
    aviso('Contraseña cambiada');
  });

  contenedor.querySelector('#form-nombre').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = ev.currentTarget.querySelector('button');
    boton.disabled = true;
    try {
      sesion = (await guardarNombre(contenedor.querySelector('#nombre').value.trim())) || sesion;
      aviso('Nombre guardado');
    } catch (e) {
      aviso(e.message, { error: true });
    } finally {
      boton.disabled = false;
    }
  });

  contenedor.querySelector('#exportar').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    boton.disabled = true;
    boton.textContent = 'Preparando…';
    try {
      const copia = await exportarTodo();
      const blob = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = `orvia-copia-${new Date().toISOString().slice(0, 10)}.json`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
      aviso('Copia descargada');
    } catch (e) {
      aviso(e.message, { error: true });
    } finally {
      boton.disabled = false;
      boton.textContent = 'Descargar copia';
    }
  });

  contenedor.querySelector('#salir').addEventListener('click', async () => {
    await cerrarSesion();
    history.replaceState(null, '', location.pathname);
  });
}

arrancar();
