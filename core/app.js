// Carcasa de Orvia: sesión, navegación y ajustes.
// No contiene lógica de ningún módulo; solo los monta según la ruta.

import { sesionActual, alCambiarSesion, enviarAcceso, entrarConCodigo, cerrarSesion } from './auth.js';
import { exportarTodo } from './db.js';
import { asegurarAreasIniciales } from './areas.js';
import { escapar, aviso, marcaOrvia, ICONOS } from './ui/componentes.js';
import { MODULOS, MODULO_INICIAL } from '../modules/registro.js';

const raiz = document.getElementById('raiz');
let sesion = null;
let carcasaMontada = false;

// ---------- Arranque ----------
async function arrancar() {
  sesion = await sesionActual();
  pintar();
  alCambiarSesion((nueva) => {
    const cambio = Boolean(nueva) !== Boolean(sesion);
    sesion = nueva;
    if (cambio) pintar();
  });
  window.addEventListener('hashchange', () => sesion && mostrarRuta());
}

async function pintar() {
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
function pintarAcceso() {
  let email = '';
  try {
    email = localStorage.getItem('orvia-email') || '';
  } catch {}

  raiz.innerHTML = `
    <main class="acceso">
      <div class="caja">
        ${marcaOrvia({ animada: true })}
        <div>
          <h1>Orvia</h1>
          <p class="suave">Tu vida, en un solo sitio.</p>
        </div>
        <form id="paso-email" novalidate>
          <div class="campo">
            <label for="email">Tu correo</label>
            <input id="email" type="email" autocomplete="email" inputmode="email" required value="${escapar(email)}">
          </div>
          <p class="error" id="error-email" hidden></p>
          <button class="boton ancho" type="submit">Enviarme el acceso</button>
        </form>
        <form id="paso-codigo" novalidate hidden>
          <p>Te he enviado un correo a <strong id="email-enviado"></strong>. Escribe aquí el código o pulsa el enlace del correo en este mismo dispositivo.</p>
          <div class="campo">
            <label for="codigo">Código del correo</label>
            <input id="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10">
          </div>
          <p class="error" id="error-codigo" hidden></p>
          <button class="boton ancho" type="submit">Entrar</button>
          <button class="boton secundario ancho" type="button" id="otro-email">Usar otro correo</button>
        </form>
      </div>
    </main>`;

  const pasoEmail = raiz.querySelector('#paso-email');
  const pasoCodigo = raiz.querySelector('#paso-codigo');
  const errorEmail = raiz.querySelector('#error-email');
  const errorCodigo = raiz.querySelector('#error-codigo');

  pasoEmail.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const valor = raiz.querySelector('#email').value.trim().toLowerCase();
    errorEmail.hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      errorEmail.textContent = 'Escribe un correo válido, por ejemplo nombre@gmail.com.';
      errorEmail.hidden = false;
      return;
    }
    const boton = pasoEmail.querySelector('button');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      await enviarAcceso(valor);
      try {
        localStorage.setItem('orvia-email', valor);
      } catch {}
      email = valor;
      raiz.querySelector('#email-enviado').textContent = valor;
      pasoEmail.hidden = true;
      pasoCodigo.hidden = false;
      raiz.querySelector('#codigo').focus();
    } catch (e) {
      errorEmail.textContent = e.message;
      errorEmail.hidden = false;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviarme el acceso';
    }
  });

  pasoCodigo.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const codigo = raiz.querySelector('#codigo').value.replace(/\D/g, '');
    errorCodigo.hidden = true;
    if (codigo.length < 6) {
      errorCodigo.textContent = 'El código tiene al menos 6 cifras.';
      errorCodigo.hidden = false;
      return;
    }
    const boton = pasoCodigo.querySelector('button[type=submit]');
    boton.disabled = true;
    boton.textContent = 'Comprobando…';
    try {
      await entrarConCodigo(email, codigo);
    } catch (e) {
      errorCodigo.textContent = e.message;
      errorCodigo.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }
  });

  raiz.querySelector('#otro-email').addEventListener('click', () => {
    pasoCodigo.hidden = true;
    pasoEmail.hidden = false;
    raiz.querySelector('#email').focus();
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
      <p class="suave">Has entrado como ${escapar(sesion?.user?.email || '')}.</p>
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
