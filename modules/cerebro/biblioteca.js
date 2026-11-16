// Pantallas del Segundo cerebro (bloque 1):
//   #/cerebro               Biblioteca: buscador, filtros por tipo, fijadas y recientes
//   #/cerebro/ideas         Ideas por estado
//   #/cerebro/aprendizajes  Aprendizajes agrupados (un curso, un libro, un tema)
//   #/cerebro/sobre-ti      Sobre ti por secciones
//   #/cerebro/nota/<id>     Una nota abierta (nota.js)

import { escapar, aviso } from '../../core/ui/componentes.js';
import { TIPOS, ESTADOS, SECCIONES, TIPOS_GRUPO, nombreDe, plazoDe, leerCerebro, hace } from './datos.js';
import { extracto, pintarTexto } from './formato.js';
import { abrirHojaNota, abrirHojaGrupo } from './hoja.js';
import { pintarNota, alClicNota } from './nota.js';

// Lo que estás viendo: el + propone el tipo (y el grupo) de la pantalla en la que estás.
const visto = { seccion: 'biblioteca', vista: null, grupo: null };
export function propuestaNota() {
  if (!visto.vista?.isConnected) return {};
  if (visto.seccion === 'ideas') return { tipo: 'idea' };
  if (visto.seccion === 'aprendizajes') return { tipo: 'aprendizaje', grupo: visto.grupo };
  if (visto.seccion === 'sobre-ti') return { tipo: 'sobre_mi' };
  return {};
}

// Filtros que se recuerdan mientras navegas por el módulo.
const filtro = { texto: '', tipo: '', estado: '' };
const abiertos = new Set(); // grupos desplegados

const ICONO_BUSCAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const ICONO_FIJADA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 .5 4.5L13 20l-3.5-3.5L4 22l-.5-.5 5.5-5.5L5.5 12.5 7 11l4.5.5 4-4z"/></svg>';
const ICONOS_GRUPO = {
  curso: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5"/>',
  libro: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  tema: '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>',
  otro: '<path d="M5 6h14M5 12h14M5 18h9"/>',
};
const iconoGrupo = (tipo) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_GRUPO[tipo] || ICONOS_GRUPO.otro}</svg>`;

/** Tarjeta de una nota en una lista. */
export function tarjetaNota(n, datos, { sinTipo = false, corta = false } = {}) {
  const t = TIPOS[n.tipo] || TIPOS.idea;
  const detalle = n.tipo === 'idea' ? `<span class="chip-estado-idea estado-${escapar(n.estado || 'bruto')}">${nombreDe(ESTADOS, n.estado || 'bruto')}</span>`
    : n.tipo === 'aprendizaje' ? (datos.porGrupo[n.grupo_id] ? `<span class="suave">${escapar(datos.porGrupo[n.grupo_id].nombre)}</span>` : '')
      : `<span class="suave">${nombreDe(SECCIONES, n.seccion || 'reflexiones')}</span>`;
  const texto = corta ? '' : extracto(n.contenido);
  return `
    <a class="cristal nota-tarjeta tipo-nota-${n.tipo}${n.estado === 'descartada' ? ' descartada' : ''}" href="#/cerebro/nota/${n.id}" style="--tipo:${t.color}">
      <span class="nota-meta">
        ${sinTipo ? '' : `<span class="nota-tipo">${t.nombre}</span>`}
        ${detalle}
        <span class="nota-fecha">${n.fijada ? `<span class="nota-fijada" aria-label="Fijada">${ICONO_FIJADA}</span>` : ''}${hace(n.modificado || n.creado)}</span>
      </span>
      <strong class="nota-titulo">${escapar(n.titulo)}</strong>
      ${texto ? `<span class="nota-extracto">${escapar(texto)}</span>` : ''}
      ${n.etiquetas?.length ? `<span class="nota-etiquetas">${n.etiquetas.map((e) => `<span>#${escapar(e)}</span>`).join('')}</span>` : ''}
    </a>`;
}

const coincide = (n, datos, texto) => {
  if (!texto) return true;
  const pajar = [n.titulo, n.contenido, (n.etiquetas || []).join(' '), datos.porGrupo[n.grupo_id]?.nombre || ''].join(' ').toLowerCase();
  return texto.toLowerCase().split(/\s+/).filter(Boolean).every((p) => pajar.includes(p.replace(/^#/, '')));
};

// ---------- Montar ----------

export async function montarCerebro(contenedor, seccion, id) {
  visto.seccion = seccion;
  visto.vista = contenedor;
  visto.grupo = null;
  let datos = null;

  const pintar = () => {
    if (seccion === 'nota') {
      const n = datos.notas.find((x) => x.id === id);
      if (!n) { contenedor.innerHTML = '<p class="suave">Esta nota ya no existe.</p><a class="enlace" href="#/cerebro">Ir a tu biblioteca</a>'; return; }
      pintarNota(contenedor, n, datos);
    } else if (seccion === 'ideas') pintarIdeas(contenedor, datos);
    else if (seccion === 'aprendizajes') pintarAprendizajes(contenedor, datos);
    else if (seccion === 'sobre-ti') pintarSobreTi(contenedor, datos);
    else pintarBiblioteca(contenedor, datos);
  };
  const cargar = async () => {
    try {
      datos = await leerCerebro();
    } catch (e) {
      contenedor.innerHTML = `<p class="error">${escapar(e.message)}</p><p class="suave">Si acabas de actualizar Orvia, ejecuta supabase/007_cerebro.sql en Supabase.</p>`;
      return;
    }
    if (contenedor.isConnected) pintar();
  };
  contenedor.innerHTML = '<p class="suave">Abriendo tu biblioteca…</p>';
  await cargar();

  contenedor.addEventListener('click', async (e) => {
    if (seccion === 'nota' && (await alClicNota(e, datos, id))) return;
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.filtroTipo != null) { filtro.tipo = d.filtroTipo; pintar(); }
    else if (d.filtroEstado != null) { filtro.estado = d.filtroEstado; pintar(); }
    else if (d.nuevaNota != null) abrirHojaNota({ tipo: d.nuevaNota || 'idea', grupo: d.grupo || null, seccion: d.seccion || undefined });
    else if (d.nuevoGrupo != null) abrirHojaGrupo();
    else if (d.editarNotaId) abrirHojaNota({ nota: datos.notas.find((n) => n.id === d.editarNotaId) });
    else if (d.editarGrupo) abrirHojaGrupo({ grupo: datos.porGrupo[d.editarGrupo] });
    else if (d.limpiarBusqueda != null) { filtro.texto = ''; pintar(); }
    else if (d.exportar != null) {
      b.disabled = true;
      try {
        const { exportarNotas } = await import('./exportar.js');
        const n = await exportarNotas();
        aviso(`${n} ${n === 1 ? 'nota exportada' : 'notas exportadas'}`);
      } catch (err) {
        aviso(err.message, { error: true });
      }
      b.disabled = false;
    }
  });
  // El buscador repinta solo la lista, para no perder el foco al escribir.
  contenedor.addEventListener('input', (e) => {
    if (e.target.id !== 'buscar-notas') return;
    filtro.texto = e.target.value;
    const lista = contenedor.querySelector('#lista-biblioteca');
    if (lista) lista.innerHTML = listaBiblioteca(datos);
  });
  // Recordar qué grupos están desplegados (y proponerlo al pulsar +).
  contenedor.addEventListener('toggle', (e) => {
    const g = e.target.dataset?.grupo;
    if (g == null) return;
    if (e.target.open) { abiertos.add(g); visto.grupo = g || null; } else abiertos.delete(g);
  }, true);

  const alCambiar = () => {
    if (!contenedor.isConnected) return removeEventListener('orvia:cerebro', alCambiar);
    cargar();
  };
  addEventListener('orvia:cerebro', alCambiar);
}

// ---------- Biblioteca ----------

function listaBiblioteca(datos) {
  const notas = datos.notas.filter((n) => (!filtro.tipo || n.tipo === filtro.tipo) && coincide(n, datos, filtro.texto));
  if (!datos.notas.length) {
    return `
      <section class="cristal cerebro-vacio">
        <h3>Tu biblioteca está vacía</h3>
        <p class="suave">Aquí guardas lo que piensas y lo que sabes: una idea de negocio, lo que has aprendido en un curso, lo que quieres para ti. Empieza por lo primero que se te pase por la cabeza.</p>
        <button class="boton" type="button" data-nueva-nota="idea">Escribir tu primera nota</button>
      </section>`;
  }
  if (!notas.length) {
    return `<p class="suave cerebro-nada">No hay notas que coincidan${filtro.texto ? ` con «${escapar(filtro.texto)}»` : ''}.${filtro.texto ? ' <button class="enlace" type="button" data-limpiar-busqueda>Quitar búsqueda</button>' : ''}</p>`;
  }
  if (filtro.texto) return `<h3 class="grupo-titulo">${notas.length} ${notas.length === 1 ? 'resultado' : 'resultados'}</h3><div class="notas-rejilla">${notas.map((n) => tarjetaNota(n, datos)).join('')}</div>`;
  const fijadas = notas.filter((n) => n.fijada);
  const resto = notas.filter((n) => !n.fijada);
  return `
    ${fijadas.length ? `<h3 class="grupo-titulo">Fijadas</h3><div class="notas-rejilla">${fijadas.map((n) => tarjetaNota(n, datos)).join('')}</div>` : ''}
    ${resto.length ? `<h3 class="grupo-titulo">Recientes</h3><div class="notas-rejilla">${resto.map((n) => tarjetaNota(n, datos)).join('')}</div>` : ''}`;
}

function pintarBiblioteca(contenedor, datos) {
  const cuenta = (tipo) => datos.notas.filter((n) => n.tipo === tipo).length;
  const madurando = datos.notas.filter((n) => n.tipo === 'idea' && n.estado === 'madurando').length;
  const resumen = [`${datos.notas.length} ${datos.notas.length === 1 ? 'nota' : 'notas'}`, madurando ? `${madurando} ${madurando === 1 ? 'idea' : 'ideas'} madurando` : ''].filter(Boolean).join(' · ');
  contenedor.innerHTML = `
    <div class="cerebro-cabecera">
      <span class="avatar-mini avatar-jude" aria-hidden="true">J</span>
      <div><h2>Tu biblioteca</h2><span class="suave">Jude · ${resumen}</span></div>
    </div>
    <label class="buscador">
      ${ICONO_BUSCAR}
      <input type="search" id="buscar-notas" placeholder="Buscar en tus notas" aria-label="Buscar en tus notas" autocomplete="off" value="${escapar(filtro.texto)}">
    </label>
    <div class="filtros-tipo" role="group" aria-label="Filtrar por tipo">
      <button type="button" class="chip-filtro" data-filtro-tipo="" aria-pressed="${!filtro.tipo}">Todo</button>
      ${Object.entries(TIPOS).map(([v, t]) => `<button type="button" class="chip-filtro" data-filtro-tipo="${v}" aria-pressed="${filtro.tipo === v}" style="--tipo:${t.color}">${t.plural} · ${cuenta(v)}</button>`).join('')}
    </div>
    <div id="lista-biblioteca">${listaBiblioteca(datos)}</div>
    ${datos.notas.length ? `<p class="exportar-notas"><button class="enlace" type="button" data-exportar>Exportar tus notas a Markdown</button><span class="suave">Un .zip con un archivo por nota, que abre cualquier app de notas.</span></p>` : ''}`;
}

// ---------- Ideas ----------

function pintarIdeas(contenedor, datos) {
  const ideas = datos.notas.filter((n) => n.tipo === 'idea');
  const cuenta = (e) => ideas.filter((n) => (n.estado || 'bruto') === e).length;
  // Sin filtro: las vivas primero; las descartadas, al final.
  const orden = { madurando: 0, bruto: 1, lanzada: 2, descartada: 3 };
  const vistas = (filtro.estado ? ideas.filter((n) => (n.estado || 'bruto') === filtro.estado) : [...ideas].sort((a, b) => orden[a.estado || 'bruto'] - orden[b.estado || 'bruto']));
  contenedor.innerHTML = `
    <div class="titulo-con-enlace cerebro-titulo">
      <h2>Ideas</h2>
      <button class="boton boton-pequeno" type="button" data-nueva-nota="idea">Nueva idea</button>
    </div>
    ${ideas.length ? `
      <div class="filtros-tipo" role="group" aria-label="Filtrar por estado">
        <button type="button" class="chip-filtro" data-filtro-estado="" aria-pressed="${!filtro.estado}">Todas · ${ideas.length}</button>
        ${ESTADOS.map(([v, l]) => `<button type="button" class="chip-filtro" data-filtro-estado="${v}" aria-pressed="${filtro.estado === v}" style="--tipo:${TIPOS.idea.color}">${l} · ${cuenta(v)}</button>`).join('')}
      </div>
      ${vistas.length ? `<div class="notas-rejilla">${vistas.map((n) => tarjetaNota(n, datos, { sinTipo: true })).join('')}</div>` : '<p class="suave cerebro-nada">No tienes ideas en este estado.</p>'}`
    : `<section class="cristal cerebro-vacio">
        <h3>Donde nacen tus proyectos</h3>
        <p class="suave">Apunta la idea en bruto, vuelve a ella cuando madure y, cuando decidas lanzarla, se convertirá en un proyecto de Acción.</p>
        <button class="boton" type="button" data-nueva-nota="idea">Apuntar una idea</button>
      </section>`}`;
}

// ---------- Aprendizajes por grupo ----------

function pintarAprendizajes(contenedor, datos) {
  const notas = datos.notas.filter((n) => n.tipo === 'aprendizaje');
  const de = (gid) => notas.filter((n) => (datos.porGrupo[n.grupo_id] ? n.grupo_id : null) === gid);
  const sueltas = de(null);
  // Los grupos con la nota más reciente, primero.
  const grupos = datos.grupos.map((g) => ({ g, notas: de(g.id) }))
    .sort((a, b) => String(b.notas[0]?.modificado || '').localeCompare(String(a.notas[0]?.modificado || '')) || a.g.orden - b.g.orden);
  // Si solo hay uno, o ninguno abierto todavía, se despliega el primero.
  if (!abiertos.size && grupos.length) abiertos.add(grupos[0].g.id);
  visto.grupo = [...abiertos].filter(Boolean).pop() || null;

  const bloque = ({ g, notas: ns }) => {
    const proyecto = g.proyecto_id ? datos.porProyecto[g.proyecto_id] : null;
    return `
      <details class="cristal grupo-notas" data-grupo="${g.id}"${abiertos.has(g.id) ? ' open' : ''}>
        <summary>
          <span class="grupo-icono">${iconoGrupo(g.tipo)}</span>
          <span class="grupo-info"><strong>${escapar(g.nombre)}</strong><span class="suave">${nombreDe(TIPOS_GRUPO, g.tipo)} · ${ns.length} ${ns.length === 1 ? 'nota' : 'notas'}${ns.length ? ` · última ${hace(ns[0].modificado || ns[0].creado)}` : ''}</span></span>
          <span class="grupo-flecha" aria-hidden="true"></span>
        </summary>
        ${proyecto ? `<a class="grupo-proyecto" href="#/accion/proyectos/${proyecto.id}">Proyecto en Acción: ${escapar(proyecto.titulo)}</a>` : ''}
        ${ns.length ? `<div class="grupo-lista">${ns.map((n) => filaNota(n)).join('')}</div>` : '<p class="suave grupo-sin-notas">Todavía no hay notas en este grupo.</p>'}
        <div class="grupo-pie">
          <button class="enlace" type="button" data-editar-grupo="${g.id}">Editar grupo</button>
          <button class="enlace" type="button" data-nueva-nota="aprendizaje" data-grupo="${g.id}">+ Nota en este grupo</button>
        </div>
      </details>`;
  };

  contenedor.innerHTML = `
    <div class="titulo-con-enlace cerebro-titulo">
      <div><h2>Aprendizajes</h2><span class="suave">${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} en ${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'}</span></div>
      <button class="boton boton-pequeno" type="button" data-nuevo-grupo>Nuevo grupo</button>
    </div>
    ${!notas.length && !grupos.length ? `
      <section class="cristal cerebro-vacio">
        <h3>Lo que aprendes, junto</h3>
        <p class="suave">Crea un grupo por cada curso, libro o tema (por ejemplo, «Excel Intermedio») y ve apuntando dentro lo que saques de él. Así lo encuentras todo en el mismo sitio.</p>
        <button class="boton" type="button" data-nuevo-grupo>Crear tu primer grupo</button>
      </section>` : ''}
    <div class="grupos-notas">
      ${grupos.map(bloque).join('')}
      ${sueltas.length ? `
        <details class="cristal grupo-notas sin-grupo" data-grupo=""${abiertos.has('') || !grupos.length ? ' open' : ''}>
          <summary>
            <span class="grupo-icono">${iconoGrupo('otro')}</span>
            <span class="grupo-info"><strong>Sin grupo</strong><span class="suave">${sueltas.length} ${sueltas.length === 1 ? 'nota suelta' : 'notas sueltas'}</span></span>
            <span class="grupo-flecha" aria-hidden="true"></span>
          </summary>
          <div class="grupo-lista">${sueltas.map((n) => filaNota(n)).join('')}</div>
        </details>` : ''}
    </div>`;
}

const filaNota = (n) => `
  <a class="fila-nota" href="#/cerebro/nota/${n.id}">
    <span class="fila-nota-titulo">${escapar(n.titulo)}</span>
    <span class="suave">${[hace(n.modificado || n.creado).replace(/^./, (c) => c.toUpperCase()), ...(n.etiquetas || []).slice(0, 3).map((e) => `#${escapar(e)}`)].join(' · ')}</span>
  </a>`;

// ---------- Sobre ti ----------

function pintarSobreTi(contenedor, datos) {
  const notas = datos.notas.filter((n) => n.tipo === 'sobre_mi');
  const de = (sec) => notas.filter((n) => (n.seccion || 'reflexiones') === sec);
  const ayuda = (sec) => SECCIONES.find(([v]) => v === sec)[2];
  const cabeza = (sec, nombre, boton) => `
    <div class="titulo-con-enlace">
      <h3 id="s-${sec}">${nombre}</h3>
      <button class="enlace" type="button" data-nueva-nota="sobre_mi" data-seccion="${sec}">${boton}</button>
    </div>`;
  const perfil = de('perfil').sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  const valores = de('valores').sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  // Las metas más lejanas, primero; las que no tienen plazo, al final.
  const metas = de('metas').sort((a, b) => (b.horizonte || 0) - (a.horizonte || 0) || String(a.creado).localeCompare(String(b.creado)));
  const reflexiones = de('reflexiones').sort((a, b) => String(b.creado).localeCompare(String(a.creado)));

  contenedor.innerHTML = `
    <div class="cerebro-titulo">
      <h2>Sobre ti</h2>
      <p class="suave">Lo que eres y hacia dónde vas. Vuelve aquí cuando tengas que decidir algo grande.</p>
    </div>
    <div class="secciones-sobre-ti">
      <section class="cristal seccion-sobre-ti" aria-labelledby="s-perfil">
        ${cabeza('perfil', 'Perfil', perfil.length ? '+ Añadir' : '+ Escribir')}
        ${perfil.length ? perfil.map((n) => `
          <div class="perfil-bloque">
            ${perfil.length > 1 ? `<strong>${escapar(n.titulo)}</strong>` : ''}
            <div class="nota-texto">${n.contenido ? pintarTexto(n.contenido) : `<p>${escapar(n.titulo)}</p>`}</div>
            ${n.etiquetas?.length ? `<div class="perfil-gustos">${n.etiquetas.map((e) => `<span>${escapar(e.replace(/-/g, ' '))}</span>`).join('')}</div>` : ''}
            <button class="enlace" type="button" data-editar-nota-id="${n.id}">Editar</button>
          </div>`).join('') : `<p class="suave">${ayuda('perfil')} Las etiquetas se muestran como tus intereses.</p>`}
      </section>

      <section class="cristal seccion-sobre-ti" aria-labelledby="s-valores">
        ${cabeza('valores', 'Valores', '+ Añadir valor')}
        ${valores.length ? `<div class="valores">${valores.map((n) => `
          <a class="valor" href="#/cerebro/nota/${n.id}"><strong>${escapar(n.titulo)}</strong>${n.contenido ? `<span>${escapar(extracto(n.contenido, 90))}</span>` : ''}</a>`).join('')}</div>` : `<p class="suave">${ayuda('valores')}</p>`}
      </section>

      <section class="cristal seccion-sobre-ti" aria-labelledby="s-metas">
        ${cabeza('metas', 'Metas a largo plazo', '+ Añadir meta')}
        ${metas.length ? `<div class="metas">${metas.map((n) => `
          <a class="meta" href="#/cerebro/nota/${n.id}">
            <span class="meta-plazo${n.horizonte ? '' : ' sin-plazo'}">${n.horizonte ? plazoDe(n.horizonte) : 'Sin plazo'}</span>
            <span class="meta-texto"><strong>${escapar(n.titulo)}</strong>${n.contenido ? `<span>${escapar(extracto(n.contenido, 110))}</span>` : ''}</span>
          </a>`).join('')}</div>` : `<p class="suave">${ayuda('metas')}</p>`}
      </section>

      <section class="cristal seccion-sobre-ti" aria-labelledby="s-reflexiones">
        ${cabeza('reflexiones', 'Reflexiones', '+ Escribir')}
        ${reflexiones.length ? `<div class="grupo-lista">${reflexiones.map((n) => `
          <a class="fila-nota" href="#/cerebro/nota/${n.id}"><span class="suave">${hace(n.creado).replace(/^./, (c) => c.toUpperCase())}</span><span class="fila-nota-titulo">${escapar(n.titulo)}</span></a>`).join('')}</div>` : `<p class="suave">${ayuda('reflexiones')}</p>`}
      </section>
    </div>`;
}
