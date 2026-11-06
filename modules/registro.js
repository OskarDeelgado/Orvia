// Registro de módulos: el único sitio donde la carcasa conoce los módulos.
// Cada módulo aparece como una bola en la órbita del Panel, en este orden.
// Para añadir uno: crear su carpeta con un index.js que exporte
// { id, nombre, estado: 'activo' | 'pronto', montar(contenedor, contexto) },
// darle colores con [data-mundo='<id>'] en core/ui/estilos.css y añadirlo aquí.

import finanzas from './finanzas/index.js';
import accion from './accion/index.js';
import cerebro from './cerebro/index.js';

export const MODULOS = [finanzas, accion, cerebro];
