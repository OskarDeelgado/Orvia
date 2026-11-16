// Listas (Acción): casillas sencillas, sin fechas ni precios.
// #/accion/listas         tus listas, con lo que queda en cada una
// #/accion/listas/<id>    una lista: escribes, pulsas Intro y sigues; al marcar, se tacha y baja
// Los hechos se pueden desmarcar o quitar todos de golpe («Quitar los hechos»).

import { escapar, aviso } from '../../core/ui/componentes.js';
import { abrirHojaBase } from '../../core/ui/hoja.js';
import {
  leerListas, crearLista, guardarLista, eliminarLista,
  crearElemento, guardarElemento, marcarElemento, quitarElemento,
} from './datos.js';

const pendientesDe = (datos, id) => datos.elementos
  .filter((x) => x.lista_id === id && !x.hecho)
  .sort((a, b) => a.orden - b.orden || String(a.creado).localeCompare(String(b.creado)));
const hechosDe = (datos, id) => datos.elementos
  .filter((x) => x.lista_id === id && x.hecho)
  .sort((a, b) => String(b.hecho_en || '').localeCompare(String(a.hecho_en || '')));

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg>';

export async function montarListas(contenedor, id = null) {
  let datos = null;
  contenedor.innerHTML = '<p class="suave">Cargando tus listas…</p>';
  try {
    datos = await leerListas();
  } catch (e) {
    contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p>
      <p class="suave">Si acabas de actualizar Orvia, falta ejecutar <strong>009_listas.sql</strong> en Supabase.</p>`;
    return;
  }
  if (!contenedor.isConnected) return;

  const lista = () => datos.listas.find((l) => l.id === id);
  if (id && !lista()) {
    contenedor.innerHTML = '<p class="suave">Esta lista ya no existe.</p><a class="enlace" href="#/accion/listas">Ver tus listas</a>';
    return;
  }

  if (!id) {
    pintarResumen(contenedor, datos);
  } else {
    // La cabecera y el campo de añadir se pintan una vez: así el teclado no se cierra al apuntar seguido.
    const l = lista();
    contenedor.innerHTML = `
      <a class="volver-semana" href="#/accion/listas">‹ Listas</a>
      <section class="cristal lista-ficha" aria-labelledby="l-titulo">
        <div class="titulo-con-enlace">
          <h2 id="l-titulo">${escapar(l.nombre)}</h2>
          <button class="enlace" type="button" data-editar-lista>Editar</button>
        </div>
        <form class="anadir-rapido" data-anadir-elemento autocomplete="off">
          <span aria-hidden="true">+</span>
          <input type="text" maxlength="300" placeholder="Añadir a la lista" aria-label="Añadir a la lista" enterkeyhint="done">
        </form>
        <div data-zona></div>
      </section>`;
    pintarElementos(contenedor.querySelector('[data-zona]'), datos, id);
  }
  const repintar = () => {
    if (id) pintarElementos(contenedor.querySelector('[data-zona]'), datos, id);
    else pintarResumen(contenedor, datos);
  };

  contenedor.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.nuevaLista != null) return abrirHojaLista({ datos });
    if (d.editarLista != null) {
      return abrirHojaLista({
        lista: lista(),
        datos,
        alGuardar: (nombre) => { lista().nombre = nombre; contenedor.querySelector('#l-titulo').textContent = nombre; },
      });
    }
    if (d.elemento) {
      const x = datos.elementos.find((y) => y.id === d.elemento);
      if (x) abrirHojaElemento(x, { alCambiar: repintar, datos });
      return;
    }
    if (d.marcar) {
      const x = datos.elementos.find((y) => y.id === d.marcar);
      if (!x) return;
      const antes = { hecho: x.hecho, hecho_en: x.hecho_en };
      x.hecho = !x.hecho;
      x.hecho_en = x.hecho ? new Date().toISOString() : null;
      b.setAttribute('aria-checked', String(x.hecho));
      b.closest('.tarea')?.classList.toggle('hecha', x.hecho);
      // Deja ver el tic un instante antes de que baje a «Hechos».
      setTimeout(repintar, x.hecho ? 260 : 0);
      try {
        await marcarElemento(x.id, x.hecho);
      } catch (err) {
        Object.assign(x, antes);
        repintar();
        aviso(err.message, { error: true });
      }
      return;
    }
    if (d.quitarHechos != null) {
      const hechos = hechosDe(datos, id);
      b.disabled = true;
      try {
        for (const x of hechos) await quitarElemento(x.id);
        datos.elementos = datos.elementos.filter((x) => !hechos.includes(x));
        aviso(hechos.length === 1 ? 'Quitado 1 hecho' : `Quitados ${hechos.length} hechos`);
      } catch (err) {
        aviso(err.message, { error: true });
        datos = await leerListas().catch(() => datos);
      }
      repintar();
    }
  });

  contenedor.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-anadir-elemento]');
    if (!form) return;
    e.preventDefault();
    const campo = form.querySelector('input');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    const orden = Math.max(0, ...datos.elementos.filter((x) => x.lista_id === id).map((x) => (x.orden || 0) + 1));
    try {
      const nuevo = await crearElemento({ lista_id: id, texto, orden });
      datos.elementos.push(nuevo);
      repintar();
    } catch (err) {
      campo.value = texto;
      aviso(err.message, { error: true });
    }
    campo.focus({ preventScroll: true });
  });
}

// ---------- Todas las listas ----------

function pintarResumen(contenedor, datos) {
  const listas = datos.listas;
  contenedor.innerHTML = `
    <div class="titulo-con-enlace proyectos-cabecera">
      <h2>Tus listas</h2>
      ${listas.length ? '<button class="boton boton-pequeno" type="button" data-nueva-lista>Nueva lista</button>' : ''}
    </div>
    ${!listas.length ? `
      <section class="cristal proyectos-vacio">
        <h3>Para no olvidarte de nada</h3>
        <p class="suave">Lo que quieres comprar, regalos, lo que llevar a un viaje… Escribe cada cosa con las palabras que quieras y márcala cuando esté hecha.</p>
        <button class="boton" type="button" data-nueva-lista>Crear tu primera lista</button>
      </section>` : `
      <div class="listas-rejilla">${listas.map((l) => tarjetaLista(datos, l)).join('')}</div>`}`;
}

function tarjetaLista(datos, l) {
  const pendientes = pendientesDe(datos, l.id);
  const hechos = hechosDe(datos, l.id).length;
  const total = pendientes.length + hechos;
  const pie = !total ? 'Vacía'
    : !pendientes.length ? 'Todo hecho'
    : `${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}${hechos ? ` · ${hechos} ${hechos === 1 ? 'hecho' : 'hechos'}` : ''}`;
  const muestra = pendientes.slice(0, 3);
  return `
    <a class="cristal lista-tarjeta" href="#/accion/listas/${l.id}">
      <h4>${escapar(l.nombre)}</h4>
      ${muestra.length ? `<ul class="lista-muestra">${muestra.map((x) => `<li>${escapar(x.texto)}</li>`).join('')}${pendientes.length > 3 ? `<li class="suave">y ${pendientes.length - 3} más</li>` : ''}</ul>` : ''}
      <p class="lista-pie${total && !pendientes.length ? ' completa' : ''}">${pie}</p>
    </a>`;
}

// ---------- Una lista ----------

function filaElemento(x) {
  return `
    <li class="tarea${x.hecho ? ' hecha' : ''}" data-id="${x.id}">
      <button class="casilla" type="button" role="checkbox" aria-checked="${x.hecho}" data-marcar="${x.id}" aria-label="Marcar «${escapar(x.texto)}» como ${x.hecho ? 'pendiente' : 'hecho'}">${CHECK}</button>
      <button class="tarea-texto" type="button" data-elemento="${x.id}"><span class="tarea-titulo">${escapar(x.texto)}</span></button>
    </li>`;
}

function pintarElementos(zona, datos, id) {
  if (!zona) return;
  const pendientes = pendientesDe(datos, id);
  const hechos = hechosDe(datos, id);
  zona.innerHTML = `
    ${pendientes.length ? `<ul class="lista-tareas">${pendientes.map(filaElemento).join('')}</ul>`
      : `<p class="suave lista-vacia">${hechos.length ? 'Todo hecho ✓' : 'Escribe arriba la primera cosa y pulsa Intro.'}</p>`}
    ${hechos.length ? `
      <div class="lista-hechos">
        <div class="titulo-con-enlace">
          <h3 class="grupo-titulo">Hechos <span class="suave">${hechos.length}</span></h3>
          <button class="enlace" type="button" data-quitar-hechos>Quitar los hechos</button>
        </div>
        <ul class="lista-tareas">${hechos.map(filaElemento).join('')}</ul>
      </div>` : ''}`;
}

// ---------- Paneles ----------

function confirmarBorrado(b, texto, accion) {
  if (b.dataset.confirmar !== '1') {
    b.dataset.confirmar = '1';
    const antes = b.textContent;
    b.textContent = texto;
    setTimeout(() => { if (b.isConnected) { b.dataset.confirmar = ''; b.textContent = antes; } }, 4000);
    return;
  }
  b.disabled = true;
  accion().catch((err) => { aviso(err.message, { error: true }); b.disabled = false; });
}

/** Crear una lista (y entrar en ella) o cambiarle el nombre / eliminarla. */
function abrirHojaLista({ lista = null, datos, alGuardar = null } = {}) {
  const editando = !!lista;
  const { cuerpo, cerrar } = abrirHojaBase(editando ? 'Editar lista' : 'Nueva lista', { mundo: 'accion' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-lista" novalidate>
      <div class="campo">
        <label for="li-nombre">Nombre</label>
        <input id="li-nombre" maxlength="80" autocomplete="off" placeholder="Comprar después de Navidad" value="${escapar(lista?.nombre || '')}">
      </div>
      <button class="boton ancho" type="submit" id="li-guardar">${editando ? 'Guardar cambios' : 'Crear lista'}</button>
      ${editando ? '<button class="boton peligro ancho" type="button" id="li-eliminar">Eliminar lista</button>' : ''}
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  setTimeout(() => { if (!editando) $('#li-nombre').focus(); }, 80);
  $('#li-eliminar')?.addEventListener('click', (e) => confirmarBorrado(e.currentTarget, 'Pulsa otra vez: se borra con todo lo que tiene', async () => {
    await eliminarLista(lista.id);
    aviso('Lista eliminada');
    cerrar('guardado');
    location.hash = '#/accion/listas';
  }));
  $('#form-lista').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = $('#li-nombre').value.trim();
    if (!nombre) { aviso('Ponle un nombre a la lista', { error: true }); $('#li-nombre').focus(); return; }
    const boton = $('#li-guardar');
    boton.disabled = true;
    try {
      if (editando) {
        await guardarLista(lista.id, { nombre });
        alGuardar?.(nombre);
        aviso('Cambios guardados');
        cerrar('guardado');
      } else {
        const orden = Math.max(0, ...datos.listas.map((l) => (l.orden || 0) + 1));
        const nueva = await crearLista({ nombre, orden });
        cerrar('guardado');
        location.hash = `#/accion/listas/${nueva.id}`;
      }
    } catch (err) {
      aviso(err.message, { error: true });
      boton.disabled = false;
    }
  });
}

/** Cambiar el texto de un elemento o quitarlo de la lista. */
function abrirHojaElemento(x, { alCambiar, datos }) {
  const { cuerpo, cerrar } = abrirHojaBase('Editar', { mundo: 'accion' });
  cuerpo.innerHTML = `
    <form class="hoja-form" id="form-elemento" novalidate>
      <div class="campo">
        <label for="el-texto">Texto</label>
        <input id="el-texto" maxlength="300" autocomplete="off" value="${escapar(x.texto)}">
      </div>
      <button class="boton ancho" type="submit">Guardar cambios</button>
      <button class="boton peligro ancho" type="button" id="el-quitar">Quitar de la lista</button>
    </form>`;
  const $ = (s) => cuerpo.querySelector(s);
  $('#el-quitar').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      await quitarElemento(x.id);
      datos.elementos = datos.elementos.filter((y) => y.id !== x.id);
      cerrar('guardado');
      alCambiar();
    } catch (err) {
      aviso(err.message, { error: true });
      e.currentTarget.disabled = false;
    }
  });
  $('#form-elemento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('#el-texto').value.trim();
    if (!texto) { aviso('Escribe algo o quítalo de la lista', { error: true }); return; }
    try {
      await guardarElemento(x.id, { texto });
      x.texto = texto;
      cerrar('guardado');
      alCambiar();
    } catch (err) {
      aviso(err.message, { error: true });
    }
  });
}
