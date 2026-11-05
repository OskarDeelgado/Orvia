// Carcasa de Orvia: sesión, navegación y ajustes.
// No contiene lógica de ningún módulo; solo los monta según la ruta.

import {
  sesionActual,
  alCambiarSesion,
  entrar,
  recuperarContrasena,
  cambiarContrasena,
  cerrarSesion,
  LONGITUD_MINIMA,
} from './auth.js';
import { exportarTodo } from './db.js';
import { asegurarAreasIniciales } from './areas.js';
import { escapar, aviso, marcaOrvia, ICONOS } from './ui/componentes.js';
import { MODULOS, MODULO_INICIAL } from '../modules/registro.js';

const raiz = document.getElementById('raiz');
let sesion = null;
let carcasaMontada = false;
let recuperando = false;

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
}

async function pintar() {
  if (recuperando && sesion) {
    carcasaMontada = false;
    pintarNuevaContrasena();
    return;
  }
  if (!sesion) {
    carcasaMontada = false;
    pintarAcceso();
    return;
  }
  try {
    await asegurarAreasIniciales();
  } catch (e) {
    aviso(e.message, { error: true });
  }
  montarCarcasa();
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
        ${marcaOrvia({ animada: true })}
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
        ${marcaOrvia()}
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
    history.replaceState(null, '', location.pathname + '#/' + MODULO_INICIAL);
    aviso('Contraseña guardada');
    pintar();
  });
}

// ---------- Carcasa ----------
function montarCarcasa() {
  if (carcasaMontada) return;
  carcasaMontada = true;
  raiz.innerHTML = `
    <div class="app">
      <header class="cabecera">
        <a class="marca" href="#/${MODULO_INICIAL}" aria-label="Orvia, ir al panel">${marcaOrvia()}<span>Orvia</span></a>
        <span class="espacio"></span>
        <a class="boton-icono" href="#/ajustes" aria-label="Ajustes">${ICONOS.ajustes}</a>
      </header>
      <nav class="navegacion" aria-label="Módulos">
        ${MODULOS.map((m) => `<a href="#/${m.id}" data-modulo="${m.id}">${ICONOS[m.icono]}<span>${escapar(m.nombre)}</span></a>`).join('')}
      </nav>
      <main class="contenido" id="contenido" tabindex="-1"></main>
    </div>`;
}

async function mostrarRuta() {
  const id = (location.hash.replace(/^#\/?/, '').split('/')[0] || MODULO_INICIAL).toLowerCase();
  const contenedor = document.getElementById('contenido');
  if (!contenedor) return;

  document.querySelectorAll('.navegacion a').forEach((a) => {
    if (a.dataset.modulo === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (id === 'ajustes') {
    document.title = 'Ajustes · Orvia';
    pintarAjustes(contenedor);
    return;
  }

  const modulo = MODULOS.find((m) => m.id === id);
  if (!modulo) {
    location.replace(`#/${MODULO_INICIAL}`);
    return;
  }
  document.title = `${modulo.nombre} · Orvia`;
  try {
    await modulo.montar(contenedor, { sesion });
  } catch (e) {
    contenedor.innerHTML = `<p class="suave">No se pudo abrir ${escapar(modulo.nombre)}: ${escapar(e.message)}</p>`;
  }
  window.scrollTo(0, 0);
}

// ---------- Ajustes ----------
function temaGuardado() {
  try {
    return localStorage.getItem('orvia-tema') || 'auto';
  } catch {
    return 'auto';
  }
}

function aplicarTema(tema) {
  const html = document.documentElement;
  if (tema === 'auto') html.removeAttribute('data-tema');
  else html.setAttribute('data-tema', tema);
  try {
    localStorage.setItem('orvia-tema', tema);
  } catch {}
}

function pintarAjustes(contenedor) {
  const tema = temaGuardado();
  const opcion = (valor, texto) =>
    `<label class="opcion"><input type="radio" name="tema" value="${valor}" ${tema === valor ? 'checked' : ''}> ${texto}</label>`;

  contenedor.innerHTML = `
    <header class="titulo-modulo"><h1>Ajustes</h1></header>
    <section class="bloque">
      <h2>Cuenta</h2>
      <p class="suave" style="margin-bottom:var(--esp-4)">Has entrado como ${escapar(sesion?.user?.email || '')}.</p>
      <details class="desplegable">
        <summary>Cambiar contraseña</summary>
        ${formularioContrasena('form-cambiar', 'Cambiar contraseña')}
      </details>
    </section>
    <section class="bloque">
      <h2>Apariencia</h2>
      <fieldset style="border:0;padding:0;margin:var(--esp-3) 0 0">
        <legend class="oculto-visual">Tema</legend>
        <div class="areas">
          ${opcion('auto', 'Automático')}${opcion('claro', 'Claro')}${opcion('oscuro', 'Oscuro')}
        </div>
      </fieldset>
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

  contenedor.querySelectorAll('input[name=tema]').forEach((r) =>
    r.addEventListener('change', () => aplicarTema(r.value)),
  );

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
    location.hash = '';
  });
}

arrancar();
