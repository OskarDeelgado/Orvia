// Traduce una copia de seguridad de Sobrea (.json) al modelo de Finanzas de Orvia.
// No toca la base de datos: devuelve los datos listos para fin_importar()
// y un resumen legible para enseñarlo antes de importar.
//
// Equivalencias con Sobrea:
// - Sobrea cuenta los meses desde enero de 2027 (mes 0). Aquí cada mes es una fecha: 2027-01-01.
// - Extraordinarios (clave X) es el sobre de tipo 'fondo'.
// - Las categorías de ingreso (ty 'i') se importan como sobres de tipo 'ingreso' (ocultos por ahora).

const ANIO_BASE = 2027;
// Los ocho colores de categoría de Sobrea (tema oscuro), en el mismo orden.
const COLORES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const COLOR_FONDO = '#9aa1ad';
const UNIDADES = { d: 'dia', w: 'semana', m: 'mes' };

const nuevoId = () => crypto.randomUUID();
const dos = (n) => String(n).padStart(2, '0');

/** Mes de Sobrea (0 = enero de 2027) → '2027-01-01'. */
export function mesAFecha(k) {
  const anio = ANIO_BASE + Math.floor(k / 12);
  const mes = ((k % 12) + 12) % 12;
  return `${anio}-${dos(mes + 1)}-01`;
}
function ultimoDiaDelMes(k) {
  const anio = ANIO_BASE + Math.floor(k / 12), mes = ((k % 12) + 12) % 12;
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${dos(mes + 1)}-${dos(dias)}`;
}
const numero = (v) => (Number.isFinite(+v) ? Math.round(+v * 100) / 100 : 0);
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Comprueba que el archivo es una copia de Sobrea y devuelve su contenido. */
export function leerCopiaSobrea(textoArchivo) {
  let o;
  try {
    o = JSON.parse(textoArchivo);
  } catch {
    throw new Error('El archivo no se puede leer. Elige la copia .json que descargaste desde Sobrea.');
  }
  const st = o && o.app === 'sobrea' && o.st;
  if (!st || !st.cfg || !Array.isArray(st.mv)) {
    throw new Error('Ese archivo no es una copia de Sobrea. En Sobrea: Ajustes → Copia de seguridad → Descargar copia de seguridad.');
  }
  return { st, fecha: o.when || null };
}

/** Convierte el estado de Sobrea en los datos de fin_importar(). */
export function traducirSobrea(st) {
  const cfg = st.cfg || {};
  const avisos = [];

  // Sobres: los de Sobrea + Extraordinarios como fondo
  const sobres = [];
  const porcentajes = [];
  const conceptos = [];
  const idPorClave = {};

  const anadirConceptos = (sobreId, lista) => {
    const vistos = new Set();
    (lista || []).forEach((c, i) => {
      const nombre = texto(c, 40);
      if (!nombre || vistos.has(nombre.toLowerCase())) return;
      vistos.add(nombre.toLowerCase());
      conceptos.push({ sobre_id: sobreId, nombre, orden: i });
    });
  };
  const anadirPorcentajes = (sobreId, base, historial, desde) => {
    const porMes = new Map();
    porMes.set(mesAFecha(desde), Math.max(0, Math.min(1, +base || 0)));
    for (const e of historial || []) {
      if (Number.isInteger(e.m) && e.m >= desde) porMes.set(mesAFecha(e.m), Math.max(0, Math.min(1, +e.v || 0)));
    }
    for (const [desde_mes, porcentaje] of porMes) porcentajes.push({ sobre_id: sobreId, desde_mes, porcentaje });
  };

  (cfg.sobres || []).forEach((s, i) => {
    const id = nuevoId();
    idPorClave[s.k] = id;
    const esIngreso = s.ty === 'i';
    const desde = Number.isInteger(s.f) && s.f > 0 ? s.f : 0;
    sobres.push({
      id,
      nombre: texto(s.n, 40) || 'Sin nombre',
      tipo: esIngreso ? 'ingreso' : 'gasto',
      color: COLORES[((s.col ?? i) % 8 + 8) % 8],
      orden: i,
      desde_mes: desde > 0 ? mesAFecha(desde) : null,
      hasta_mes: Number.isInteger(s.t) ? mesAFecha(s.t) : null,
      clave_sobrea: String(s.k),
    });
    if (!esIngreso) anadirPorcentajes(id, s.p, s.ph, desde);
    anadirConceptos(id, s.c);
  });

  const idFondo = nuevoId();
  idPorClave.X = idFondo;
  sobres.push({ id: idFondo, nombre: 'Extraordinarios', tipo: 'fondo', color: COLOR_FONDO, orden: sobres.length, desde_mes: null, hasta_mes: null, clave_sobrea: 'X' });
  anadirPorcentajes(idFondo, cfg.pct?.X ?? 0.05, cfg.pxh, 0);
  anadirConceptos(idFondo, cfg.cats?.X);

  // Recurrentes
  const recurrentes = [];
  const idRecurrente = {};
  for (const r of st.rec || []) {
    const sobreId = idPorClave[r.s];
    if (!sobreId || !esFecha(r.d0)) {
      avisos.push(`Recurrente «${texto(r.c, 40)}» sin categoría válida: no se importa.`);
      continue;
    }
    const id = nuevoId();
    idRecurrente[r.id] = id;
    recurrentes.push({
      id, sobre_id: sobreId, concepto: texto(r.c, 80), importe: numero(r.i), nota: texto(r.nt),
      meses: r.p > 1 ? Math.min(60, r.p) : 1, cada: Math.max(1, Math.min(365, +r.e || 1)),
      unidad: UNIDADES[r.u] || 'mes', fecha_inicio: r.d0, siguiente: Math.max(0, +r.ix || 0), activo: !!r.on,
    });
  }

  // Movimientos
  const movimientos = [];
  let sinCategoria = 0;
  for (const m of st.mv || []) {
    const sobreId = idPorClave[m.s];
    if (!sobreId || !esFecha(m.d) || !Number.isFinite(+m.i)) {
      sinCategoria++;
      continue;
    }
    movimientos.push({
      fecha: m.d, sobre_id: sobreId, concepto: texto(m.c, 80), importe: numero(m.i), nota: texto(m.nt),
      meses: m.p > 1 ? Math.min(60, m.p) : 1, recurrente_id: (m.rid && idRecurrente[m.rid]) || null,
    });
  }
  if (sinCategoria) avisos.push(`${sinCategoria} movimiento(s) de categorías eliminadas no se importan.`);

  // Inversiones
  const inversiones = (st.inv || [])
    .filter((r) => esFecha(r.d) && +r.i)
    .map((r) => ({ fecha: r.d, importe: numero(r.i), nota: texto(r.nt) }));

  // Objetivos de ahorro y sus aportaciones
  const objetivos = [];
  const idObjetivo = {};
  for (const g of st.gl || []) {
    if (!(+g.t > 0) || !Number.isInteger(g.m0) || !Number.isInteger(g.m1)) continue;
    const id = nuevoId();
    idObjetivo[g.id] = id;
    objetivos.push({
      id, titulo: texto(g.n, 200) || 'Objetivo', valor_meta: numero(g.t),
      fecha_inicio: mesAFecha(g.m0), fecha_limite: ultimoDiaDelMes(g.m1),
      revisado_hasta: Number.isInteger(g.hk) ? mesAFecha(g.hk) : null,
    });
  }
  const aportaciones = (st.gc || [])
    .filter((c) => idObjetivo[c.g] && Number.isInteger(c.k))
    .map((c) => ({ objetivo_id: idObjetivo[c.g], sobre_id: idPorClave[c.s] || null, mes: mesAFecha(c.k), importe: numero(c.a) }));

  const datos = {
    config: {
      fecha_inicio: mesAFecha(0),
      saldo_inicial: numero(cfg.saldo), ahorro_inicial: numero(cfg.ahorro0),
      inversion_inicial: numero(cfg.inv0), inversion_valor: numero(cfg.invVal),
      fondo_inicial: numero(cfg.fondo0), fondo_tope: numero(cfg.tope ?? 3000),
      sobrante_inicial: numero(cfg.sob0),
    },
    sueldos: [{ desde_mes: mesAFecha(0), importe: numero(cfg.sueldo) }],
    pagas: (cfg.extras || [])
      .filter((e) => Number.isInteger(e.m) && e.m >= 0 && e.m <= 11 && +e.i > 0)
      .map((e) => ({ mes_del_anio: e.m + 1, importe: numero(e.i), concepto: texto(e.n, 40) || 'Paga extra' })),
    sobres, porcentajes, conceptos, recurrentes, movimientos, inversiones, objetivos, aportaciones,
  };

  const resumen = {
    sueldo: datos.sueldos[0].importe,
    pagas: datos.pagas.length,
    sobres: sobres.filter((s) => s.tipo === 'gasto').map((s) => ({
      nombre: s.nombre, color: s.color,
      porcentaje: porcentajes.filter((p) => p.sobre_id === s.id).at(-1)?.porcentaje ?? 0,
      activo: !s.hasta_mes,
    })),
    fondo: { porcentaje: porcentajes.filter((p) => p.sobre_id === idFondo).at(-1)?.porcentaje ?? 0, tope: datos.config.fondo_tope },
    conceptos: conceptos.length,
    movimientos: movimientos.length,
    recurrentes: recurrentes.length,
    inversiones: inversiones.length,
    objetivos: objetivos.length,
    avisos,
  };
  return { datos, resumen };
}

/** Configuración básica para empezar sin Sobrea: los mismos sobres y conceptos de partida que Sobrea. */
export function configuracionBasica() {
  const st = {
    cfg: {
      saldo: 0, ahorro0: 0, inv0: 0, invVal: 0, sueldo: 0, extras: [], pct: { X: 0.05 }, pxh: [], tope: 3000, fondo0: 0, sob0: 0,
      sobres: [
        { k: 'F', n: 'Gastos fijos', p: 0.075, ph: [], f: 0, t: null, col: 0, c: ['Comida Puleva', 'Peluquería', 'Gasolina', 'Café', 'Regalo', 'Gimnasio', 'Biwenguer', 'Hucha'] },
        { k: 'C', n: 'Compras', p: 0.09, ph: [], f: 0, t: null, col: 1, c: ['Ropa', 'Tecnología', 'Hogar', 'Regalos', 'Otros'] },
        { k: 'O', n: 'Ocio', p: 0.135, ph: [], f: 0, t: null, col: 2, c: ['Desayuno', 'Almuerzo', 'Merienda', 'Cena', 'Copas', 'Eventos', 'Otros'] },
      ],
      cats: { X: ['Salud', 'Coche', 'Imprevistos', 'Otros'] },
    },
    mv: [], inv: [], rec: [], gl: [], gc: [],
  };
  return traducirSobrea(st);
}
