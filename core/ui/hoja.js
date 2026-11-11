// Panel que sube desde abajo (ventana centrada en el ordenador), común a todos los módulos.
// Mismo aspecto que el de apuntar un movimiento. Toma los colores del mundo que se indique.

import { escapar } from './componentes.js';

let abierta = null;

/** ¿Hay algún panel abierto ahora mismo? (incluido el de apuntar) */
export const hayHojaAbierta = () => !!document.querySelector('.hoja-capa');

/**
 * Abre un panel vacío con su título.
 * @returns {{ cuerpo: HTMLElement, titulo: HTMLElement, cerrar: () => void }}
 */
export function abrirHojaBase(titulo, { alCerrar, mundo = 'finanzas' } = {}) {
  abierta?.cerrar();
  const volverFoco = document.activeElement;
  const capa = document.createElement('div');
  capa.className = 'hoja-capa';
  capa.dataset.mundo = mundo;
  capa.innerHTML = `
    <div class="hoja-fondo" data-cerrar></div>
    <section class="hoja" role="dialog" aria-modal="true" aria-labelledby="hojab-titulo">
      <div class="hoja-asa" aria-hidden="true"></div>
      <header class="hoja-cabecera">
        <h2 id="hojab-titulo">${escapar(titulo)}</h2>
        <button class="boton-icono" type="button" data-cerrar aria-label="Cerrar">✕</button>
      </header>
      <div class="hoja-cuerpo"></div>
    </section>`;
  document.body.append(capa);
  document.body.classList.add('con-hoja');
  requestAnimationFrame(() => capa.classList.add('abierta'));

  let cerrada = false;
  const cerrar = (motivo = 'cerrar') => {
    if (cerrada) return;
    cerrada = true;
    capa.classList.remove('abierta');
    document.body.classList.remove('con-hoja');
    removeEventListener('keydown', alTecla);
    setTimeout(() => capa.remove(), 220);
    if (abierta?.capa === capa) abierta = null;
    volverFoco?.focus?.({ preventScroll: true });
    alCerrar?.(motivo);
  };
  const alTecla = (e) => { if (e.key === 'Escape') cerrar(); };
  addEventListener('keydown', alTecla);
  capa.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrar(); });
  abierta = { capa, cerrar };
  return { cuerpo: capa.querySelector('.hoja-cuerpo'), titulo: capa.querySelector('#hojab-titulo'), cerrar };
}
