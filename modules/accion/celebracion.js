// Celebraciones de hábitos: «+30 XP» que sube desde lo que tocas, y la pantalla de
// semana cumplida (anillo iluminado, confeti y Endrick). Respeta «Reducir movimiento».

import { escapar } from '../../core/ui/componentes.js';

const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** XP flotante sobre un elemento. */
export function xpFlotante(desde, texto) {
  if (!desde?.getBoundingClientRect) return;
  const r = desde.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'xp-flotante';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = texto;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), quieto() ? 900 : 1300);
}

/**
 * Pantalla de celebración.
 * @param {object} o
 * @param {string} o.titulo        «¡Semana de gimnasio cumplida!»
 * @param {string} [o.texto]       «Llevas 7 semanas seguidas.»
 * @param {string} o.anillo        texto del centro del anillo («4/4»)
 * @param {string} [o.subAnillo]   texto bajo la cifra del anillo
 * @param {string[]} o.premios     ['+30 XP', '+100 XP semana']
 * @param {string} o.mensaje       lo que dice Endrick
 * @param {{nivel:number, antes:number, despues:number, hasta:number, desde:number}} o.nivel
 */
export function celebrar(o) {
  const capa = document.createElement('div');
  capa.className = 'celebracion';
  capa.dataset.mundo = 'accion';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  capa.setAttribute('aria-labelledby', 'cel-titulo');
  const colores = ['#4ade80', '#fbbf24', '#5eead4', '#f2f4f7'];
  const confeti = quieto() ? '' : Array.from({ length: 26 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;background:${colores[i % 4]};animation-delay:${-(i * 0.23) % 2.8}s;animation-duration:${2.4 + (i % 5) * 0.25}s"></i>`).join('');
  const ancho = (v) => Math.max(0, Math.min(100, ((v - o.nivel.desde) / (o.nivel.hasta - o.nivel.desde)) * 100));
  capa.innerHTML = `
    <div class="celebracion-confeti" aria-hidden="true">${confeti}</div>
    <div class="celebracion-cuerpo">
      <svg class="celebracion-anillo" viewBox="0 0 100 100" role="img" aria-label="${escapar(o.anillo)}">
        <circle cx="50" cy="50" r="40" class="pista"/>
        <circle cx="50" cy="50" r="40" class="lleno" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90 50 50)"/>
        <text x="50" y="48" text-anchor="middle" dominant-baseline="central" class="cifra">${escapar(o.anillo)}</text>
        ${o.subAnillo ? `<text x="50" y="67" text-anchor="middle" class="sub">${escapar(o.subAnillo)}</text>` : ''}
      </svg>
      <h2 id="cel-titulo">${escapar(o.titulo)}</h2>
      ${o.texto ? `<p class="celebracion-texto">${o.texto}</p>` : ''}
      <div class="celebracion-premios">${o.premios.map((p) => `<span>${escapar(p)}</span>`).join('')}</div>
      <div class="celebracion-endrick">
        <span class="avatar-mini" aria-hidden="true">E</span>
        <div><strong>Endrick</strong><span>${escapar(o.mensaje)}</span></div>
      </div>
      <div class="celebracion-nivel">
        <div class="fila-nivel"><span>Nivel ${o.nivel.nivel}</span><span>${o.nivel.antes.toLocaleString('es-ES')} → ${o.nivel.despues.toLocaleString('es-ES')} XP</span></div>
        <div class="barra-nivel"><i style="width:${ancho(o.nivel.antes)}%"></i></div>
      </div>
      <button class="boton ancho" type="button" data-seguir>Seguir</button>
    </div>`;
  document.body.append(capa);
  document.body.classList.add('con-hoja');
  const boton = capa.querySelector('[data-seguir]');
  boton.focus();
  // La barra de nivel avanza tras abrirse.
  requestAnimationFrame(() => setTimeout(() => {
    const barra = capa.querySelector('.barra-nivel i');
    if (barra) barra.style.width = `${ancho(o.nivel.despues)}%`;
  }, 250));
  const cerrar = () => {
    capa.classList.add('saliendo');
    document.body.classList.remove('con-hoja');
    removeEventListener('keydown', tecla);
    setTimeout(() => capa.remove(), 200);
  };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', tecla);
  boton.addEventListener('click', cerrar);
}
