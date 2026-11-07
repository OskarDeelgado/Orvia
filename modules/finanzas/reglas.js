// Reglas de cambio de la configuración de Finanzas, las mismas que Sobrea:
// - Antes de empezar (o en el primer mes sin nada apuntado) un cambio se aplica
//   directamente a todos los meses.
// - Después, rige desde el mes siguiente: el mes en curso se queda como estaba el día 1.
// Todas las escrituras pasan por core/db.js.

import { crear, actualizar, archivar, listar, llamar } from '../../core/db.js';
import { fechaRepeticion, hoy } from './calculo.js';
import { COLORES } from './importador.js';

/** { base, E }: base = se aplica a todo; E = mes desde el que rige (eff en Sobrea). */
export function efecto(motor) {
  const c = motor.kHoy();
  const base = c < 0 || (c === 0 && !motor.libro.movimientos.length && !motor.libro.inversiones.length);
  return { base, E: base ? 0 : c + 1 };
}

/** Cambia un valor con historial (porcentaje de un sobre o sueldo) siguiendo la regla. */
async function cambiarHistorial({ motor, tabla, filas, campo, valor, extra = {}, desdeBase, empiezaEn = 0 }) {
  const { base, E } = efecto(motor);
  if (base || E <= empiezaEn) {
    for (const f of filas) await archivar(tabla, f.id);
    await crear(tabla, { ...extra, desde_mes: desdeBase, [campo]: valor });
    return { directo: true };
  }
  let previo = 0;
  for (const f of filas) {
    if (motor.kDe(f.desde_mes) >= E) await archivar(tabla, f.id);
    else previo = Number(f[campo]) || 0;
  }
  if (Math.abs(previo - valor) > 1e-9) await crear(tabla, { ...extra, desde_mes: motor.mesK(E), [campo]: valor });
  return { directo: false, desde: E };
}

/** Porcentaje del sueldo de un sobre (o del fondo). */
export function guardarPorcentaje(motor, sobre, porcentaje) {
  const filas = motor.libro.porcentajes.filter((p) => p.sobre_id === sobre.id);
  const empieza = sobre.tipo === 'fondo' || !sobre.desde_mes ? 0 : motor.kDe(sobre.desde_mes);
  return cambiarHistorial({
    motor, tabla: 'fin_porcentajes', filas, campo: 'porcentaje', valor: porcentaje,
    extra: { sobre_id: sobre.id },
    desdeBase: sobre.tipo !== 'fondo' && sobre.desde_mes ? sobre.desde_mes : motor.inicio,
    empiezaEn: sobre.tipo === 'fondo' ? -1 : empieza,
  });
}

/** Sueldo mensual neto. (En Sobrea el sueldo no tiene historial; aquí sigue la misma regla que los porcentajes.) */
export function guardarSueldo(motor, importe) {
  return cambiarHistorial({
    motor, tabla: 'fin_sueldos', filas: motor.libro.sueldos, campo: 'importe', valor: importe, desdeBase: motor.inicio, empiezaEn: -1,
  });
}

/** Valor que rige un mes y último valor del historial (para el aviso "En vigor este mes…"). */
export function enVigorYUltimo(motor, filas, campo) {
  const k = Math.max(0, motor.kHoy()), m = motor.mesK(k);
  let vigor = 0;
  for (const f of filas) if (f.desde_mes <= m) vigor = Number(f[campo]) || 0;
  const ultimo = filas.length ? Number(filas[filas.length - 1][campo]) || 0 : 0;
  const desde = filas.length ? filas[filas.length - 1].desde_mes : null;
  return { vigor, ultimo, desde };
}

export function guardarConfig(motor, cambios) {
  return actualizar('fin_config', motor.libro.config.id, cambios);
}

// ---------- Pagas extra ----------
const MESES_PAGA = [6, 12, 3, 9]; // como Sobrea: junio, diciembre, marzo, septiembre

export async function cambiarNumeroPagas(motor, n, sueldo) {
  const pagas = [...motor.libro.pagas].sort((a, b) => String(a.creado).localeCompare(String(b.creado)));
  for (let i = pagas.length - 1; i >= n; i--) await archivar('fin_pagas_extra', pagas[i].id);
  for (let i = pagas.length; i < n; i++) await crear('fin_pagas_extra', { mes_del_anio: MESES_PAGA[i], importe: sueldo || 0, concepto: 'Paga extra' });
}
export const cambiarPaga = (id, cambios) => actualizar('fin_pagas_extra', id, cambios);

// ---------- Categorías ----------
const visibles = (motor) => motor.libro.sobres.filter((s) => s.tipo !== 'fondo' && (!s.hasta_mes || motor.kDe(s.hasta_mes) > Math.max(0, motor.kHoy())));
export const categoriasVisibles = visibles;

/** ¿Ese nombre ya lo usa otra categoría viva (o es Extraordinarios)? */
export function nombreOcupado(motor, nombre, salvo = null) {
  const n = nombre.toLowerCase();
  return n === 'extraordinarios' || motor.libro.sobres.some((s) => s.id !== salvo && s.tipo !== 'fondo' && !s.hasta_mes && s.nombre.toLowerCase() === n);
}

/** Primer color de la paleta que no se usa (nc en Sobrea). */
function colorLibre(motor) {
  const usados = new Set(motor.libro.sobres.map((s) => s.color));
  return COLORES.find((c) => !usados.has(c)) || COLORES[motor.libro.sobres.length % COLORES.length];
}

export async function crearCategoria(motor, nombre, tipo) {
  const { base, E } = efecto(motor);
  const orden = Math.max(0, ...motor.libro.sobres.map((s) => s.orden || 0)) + 1;
  const sobre = await crear('fin_sobres', {
    nombre, tipo, color: tipo === 'ingreso' ? COLORES[3] : colorLibre(motor), orden,
    desde_mes: tipo === 'gasto' && !base ? motor.mesK(E) : null, hasta_mes: null,
  });
  await crear('fin_conceptos', { sobre_id: sobre.id, nombre: 'Otros', orden: 0 });
  return { sobre, base, E };
}

export const renombrarCategoria = (id, nombre) => actualizar('fin_sobres', id, { nombre });

/** Cambia el color; si otra categoría viva lo tenía, se intercambian. */
export async function cambiarColor(motor, sobre, color) {
  const otra = motor.libro.sobres.find((s) => s.id !== sobre.id && s.tipo !== 'ingreso' && !s.hasta_mes && s.color === color);
  if (otra) await actualizar('fin_sobres', otra.id, { color: sobre.color });
  await actualizar('fin_sobres', sobre.id, { color });
}

/**
 * Eliminar una categoría, como en Sobrea: si tiene movimientos desde el mes en que
 * rige, hay que moverlos o borrarlos antes. Antes de empezar (o si es de ingreso)
 * se elimina del todo; si no, deja de existir desde el mes siguiente.
 */
export function comprobarEliminar(motor, sobre) {
  const { base, E } = efecto(motor);
  const desde = sobre.tipo === 'ingreso' ? 0 : E;
  const n = motor.libro.movimientos.filter((m) => m.sobre_id === sobre.id && motor.kDe(m.fecha) >= desde).length;
  return { n, base, E };
}
export async function eliminarCategoria(motor, sobre) {
  const { base, E } = efecto(motor);
  if (base || sobre.tipo === 'ingreso') {
    await archivar('fin_sobres', sobre.id);
    return { del_todo: true };
  }
  await actualizar('fin_sobres', sobre.id, { hasta_mes: motor.mesK(E) });
  return { del_todo: false, E };
}
export const cancelarEliminacion = (id) => actualizar('fin_sobres', id, { hasta_mes: null });

// ---------- Conceptos ----------
export function anadirConcepto(motor, sobreId, nombre) {
  const orden = motor.libro.conceptos.filter((c) => c.sobre_id === sobreId).length;
  return crear('fin_conceptos', { sobre_id: sobreId, nombre, orden });
}
export const quitarConcepto = (id) => archivar('fin_conceptos', id);

// ---------- Sugerencias ----------
export const ignorarSugerencia = (motor, sobre) => actualizar('fin_sobres', sobre.id, { sugerencia_ignorada: motor.mesK(motor.kHoy()) });

// ---------- Recurrentes ----------
/** Cambia importe y frecuencia. Si cambia la frecuencia, la serie vuelve a contar desde el próximo cobro. */
export function guardarRecurrente(r, { importe, cada, unidad }) {
  const cambios = { importe, cada, unidad };
  if (cada !== r.cada || unidad !== r.unidad) {
    cambios.fecha_inicio = fechaRepeticion(r, r.siguiente);
    cambios.siguiente = 0;
  }
  return actualizar('fin_recurrentes', r.id, cambios);
}
/** Pausar, o reanudar sin apuntar los cobros que vencieron mientras estaba en pausa. */
export function pausarReanudar(r) {
  if (r.activo) return actualizar('fin_recurrentes', r.id, { activo: false });
  let k = r.siguiente;
  const h = hoy();
  for (let g = 0; g < 800 && fechaRepeticion(r, k) <= h; g++) k++;
  return actualizar('fin_recurrentes', r.id, { activo: true, siguiente: k });
}
export const eliminarRecurrente = (id) => archivar('fin_recurrentes', id);

// ---------- Borrados ----------
export const borrarMovimientos = () => llamar('fin_borrar_movimientos');
export const borrarTodo = () => llamar('fin_reiniciar');

/** Lee todo lo de Finanzas (incluido lo que el motor no necesita) para la copia. */
export async function leerParaCopia() {
  const tablas = ['fin_config', 'fin_sueldos', 'fin_pagas_extra', 'fin_sobres', 'fin_porcentajes', 'fin_conceptos', 'fin_recurrentes', 'fin_movimientos', 'fin_inversiones', 'fin_aportaciones'];
  const copia = { app: 'Orvia', modulo: 'finanzas', version: 1, exportado: new Date().toISOString(), tablas: {} };
  for (const t of tablas) copia.tablas[t] = await listar(t);
  copia.tablas.objetivos = await listar('objetivos', { filtros: { metrica: 'dinero' } });
  return copia;
}

/** Convierte una copia de Orvia (de Finanzas o la general de Ajustes) al formato de fin_importar. */
export function copiaOrviaADatos(copia) {
  const t = copia?.tablas;
  if (!t?.fin_config?.length) throw new Error('Esa copia de Orvia no tiene datos de Finanzas.');
  const vivas = (n) => (t[n] || []).filter((f) => !f.archivado);
  const sin = (f, ...campos) => { const o = { ...f }; for (const c of ['propietario', 'creado', 'modificado', 'archivado', ...campos]) delete o[c]; return o; };
  const config = sin(vivas('fin_config')[0], 'id');
  const sobres = vivas('fin_sobres').map((s) => sin(s, 'sugerencia_ignorada'));
  const ids = new Set(sobres.map((s) => s.id));
  const objetivos = vivas('objetivos').filter((o) => o.metrica === 'dinero')
    .map((o) => ({ id: o.id, titulo: o.titulo, valor_meta: o.valor_meta, fecha_inicio: o.fecha_inicio, fecha_limite: o.fecha_limite, revisado_hasta: o.revisado_hasta }));
  const idsObj = new Set(objetivos.map((o) => o.id));
  const datos = {
    config,
    sueldos: vivas('fin_sueldos').map((f) => sin(f, 'id')),
    pagas: vivas('fin_pagas_extra').map((f) => sin(f, 'id')),
    sobres,
    porcentajes: vivas('fin_porcentajes').filter((p) => ids.has(p.sobre_id)).map((f) => sin(f, 'id')),
    conceptos: vivas('fin_conceptos').filter((c) => ids.has(c.sobre_id)).map((f) => sin(f, 'id')),
    recurrentes: vivas('fin_recurrentes').filter((r) => ids.has(r.sobre_id)).map((f) => sin(f)),
    movimientos: vivas('fin_movimientos').filter((m) => ids.has(m.sobre_id)).map((f) => sin(f, 'id', 'proyecto_id')),
    inversiones: vivas('fin_inversiones').map((f) => sin(f, 'id')),
    objetivos,
    aportaciones: vivas('fin_aportaciones').filter((a) => idsObj.has(a.objetivo_id)).map((f) => sin(f, 'id')),
  };
  const fondo = sobres.find((s) => s.tipo === 'fondo');
  const pctDe = (id) => datos.porcentajes.filter((p) => p.sobre_id === id).sort((a, b) => a.desde_mes.localeCompare(b.desde_mes)).at(-1)?.porcentaje ?? 0;
  const resumen = {
    sueldo: datos.sueldos.sort((a, b) => a.desde_mes.localeCompare(b.desde_mes)).at(-1)?.importe ?? 0,
    pagas: datos.pagas.length,
    sobres: sobres.filter((s) => s.tipo === 'gasto').map((s) => ({ nombre: s.nombre, color: s.color, porcentaje: Number(pctDe(s.id)), activo: !s.hasta_mes })),
    fondo: { porcentaje: fondo ? Number(pctDe(fondo.id)) : 0, tope: config.fondo_tope },
    conceptos: datos.conceptos.length, movimientos: datos.movimientos.length, recurrentes: datos.recurrentes.length,
    inversiones: datos.inversiones.length, objetivos: objetivos.length, avisos: [],
  };
  return { datos, resumen };
}
