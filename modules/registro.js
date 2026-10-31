// Registro de módulos: el único sitio donde la carcasa conoce los módulos.
// Para añadir un módulo nuevo: crear su carpeta con un index.js que exporte
// { id, nombre, icono, montar(contenedor, contexto) } y añadirlo aquí.

import panel from './panel/index.js';
import accion from './accion/index.js';
import finanzas from './finanzas/index.js';
import conocimiento from './conocimiento/index.js';

export const MODULOS = [panel, accion, finanzas, conocimiento];
export const MODULO_INICIAL = 'panel';
