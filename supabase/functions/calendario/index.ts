// @ts-nocheck  (JavaScript sin tipos, válido como TypeScript; así también se prueba con Node)
// Orvia · Función «calendario» (Supabase Edge Function)
//
// Lee tus calendarios publicados (enlace «Calendario público» de iCloud) y devuelve los
// eventos de un rango de días. Solo lectura: nunca escribe en tu calendario.
//
// - Los enlaces se guardan en la tabla `calendarios` (supabase/006_calendarios.sql), protegida
//   por RLS: la función los lee con TU sesión, así que solo ve los tuyos.
// - El navegador no puede leer iCloud directamente (CORS); por eso pasa por aquí.
// - Entiende eventos de día completo, zonas horarias, repeticiones (RRULE), excepciones
//   (EXDATE) y cambios de una sola repetición (RECURRENCE-ID).
// - Devuelve las horas en la hora de España (Europe/Madrid).
//
// Petición:  POST { desde: 'AAAA-MM-DD', hasta: 'AAAA-MM-DD' }   (hasta no incluido; máx. 62 días)
// Respuesta: { eventos: [{ id, titulo, inicio, fin, todoElDia, lugar, calendario_id, color }], errores: [...] }
//
// Escrito sin tipos de TypeScript a propósito: así el mismo código se prueba con Node.

const ZONA = 'Europe/Madrid';
const HOSTS_PERMITIDOS = [/(^|\.)icloud\.com$/i, /^calendar\.google\.com$/i, /^outlook\.(live|office365)\.com$/i];

// ---------- Fechas como campos (año, mes, día, hora, minuto), sin zona ----------

const dos = (n) => String(n).padStart(2, '0');
const diasMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate(); // m: 1–12
const aDia = (f) => `${f.a}-${dos(f.m)}-${dos(f.d)}`;
const aTexto = (f) => `${aDia(f)}T${dos(f.h)}:${dos(f.min)}`;
const desdeUTC = (ms) => { const d = new Date(ms); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() }; };
const aUTC = (f) => Date.UTC(f.a, f.m - 1, f.d, f.h || 0, f.min || 0);
const sumarDias = (f, n) => ({ ...desdeUTC(aUTC(f) + n * 864e5), h: f.h, min: f.min });
const sumarMinutos = (f, n) => desdeUTC(aUTC(f) + n * 6e4);
const diaSemana = (f) => new Date(Date.UTC(f.a, f.m - 1, f.d)).getUTCDay(); // 0 domingo
const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Hora de pared en una zona → instante UTC (ms). Ajusta con el desfase real de esa zona.
function desfase(zona, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}
function zonaValida(z) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; }
}
function deZonaAUTC(f, zona) {
  const pared = aUTC(f);
  let ms = pared - desfase(zona, pared);
  ms = pared - desfase(zona, ms); // segunda pasada para los cambios de hora
  return ms;
}
const aMadrid = (ms) => desdeUTC(ms + desfase(ZONA, ms));

// ---------- Lectura del .ics ----------

function desplegar(texto) {
  return texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
function linea(l) {
  // NOMBRE;PARAM=valor;PARAM2="valor":contenido  (los dos puntos pueden ir entre comillas)
  let i = 0, comillas = false;
  for (; i < l.length; i++) {
    if (l[i] === '"') comillas = !comillas;
    else if (l[i] === ':' && !comillas) break;
  }
  const cabeza = l.slice(0, i), valor = l.slice(i + 1);
  const [nombre, ...ps] = cabeza.split(';');
  const params = {};
  for (const p of ps) { const [k, v = ''] = p.split('='); params[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
  return { nombre: nombre.toUpperCase(), params, valor };
}
const desescapar = (t) => t.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** Fecha del .ics → { f: campos en su zona, todoElDia, zona } */
function leerFecha(valor, params) {
  const v = valor.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const f = { a: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), min: +(m[5] || 0) };
  if (params.VALUE === 'DATE' || !m[4]) return { f, todoElDia: true, zona: null };
  if (m[7]) return { f, todoElDia: false, zona: 'UTC' };
  const tz = params.TZID && zonaValida(params.TZID) ? params.TZID : ZONA;
  return { f, todoElDia: false, zona: tz };
}
/** Campos de una fecha de su zona a la hora de España. */
function aEspana(f, zona) {
  if (!zona) return f; // día completo: sin zona
  if (zona === ZONA) return f;
  return aMadrid(zona === 'UTC' ? aUTC(f) : deZonaAUTC(f, zona));
}
function duracion(t) {
  const m = t.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const s = m[1] === '-' ? -1 : 1;
  return s * ((+m[2] || 0) * 10080 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0));
}

export function leerIcs(texto) {
  const eventos = [];
  let ev = null;
  for (const l of desplegar(texto)) {
    if (l === 'BEGIN:VEVENT') { ev = { exdates: [] }; continue; }
    if (l === 'END:VEVENT') { if (ev?.inicio) eventos.push(ev); ev = null; continue; }
    if (!ev || !l) continue;
    const { nombre, params, valor } = linea(l);
    if (nombre === 'UID') ev.uid = valor.trim();
    else if (nombre === 'SUMMARY') ev.titulo = desescapar(valor);
    else if (nombre === 'LOCATION') ev.lugar = desescapar(valor);
    else if (nombre === 'STATUS') ev.estado = valor.trim().toUpperCase();
    else if (nombre === 'DTSTART') ev.inicio = leerFecha(valor, params);
    else if (nombre === 'DTEND') ev.fin = leerFecha(valor, params);
    else if (nombre === 'DURATION') ev.duracion = duracion(valor.trim());
    else if (nombre === 'RRULE') ev.rrule = Object.fromEntries(valor.split(';').map((p) => p.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
    else if (nombre === 'EXDATE') for (const v of valor.split(',')) { const x = leerFecha(v, params); if (x) ev.exdates.push(x); }
    else if (nombre === 'RECURRENCE-ID') ev.recurrenceId = leerFecha(valor, params);
  }
  return eventos;
}

// ---------- Repeticiones (RRULE) ----------

/** Días del mes que cumplen BYDAY (con ordinal: 1MO, -1FR) y BYMONTHDAY. */
function diasDelMes(a, m, rrule, diaInicio) {
  const n = diasMes(a, m);
  if (rrule.BYMONTHDAY) {
    return rrule.BYMONTHDAY.split(',').map(Number).map((x) => (x < 0 ? n + x + 1 : x)).filter((x) => x >= 1 && x <= n).sort((x, y) => x - y);
  }
  if (rrule.BYDAY) {
    const out = new Set();
    for (const parte of rrule.BYDAY.split(',')) {
      const mm = parte.match(/^([+-]?\d+)?([A-Z]{2})$/);
      if (!mm) continue;
      const dia = DIAS_ICS.indexOf(mm[2]);
      const todos = [];
      for (let d = 1; d <= n; d++) if (diaSemana({ a, m, d }) === dia) todos.push(d);
      if (!mm[1]) todos.forEach((d) => out.add(d));
      else { const k = +mm[1]; const d = k > 0 ? todos[k - 1] : todos[todos.length + k]; if (d) out.add(d); }
    }
    let lista = [...out].sort((x, y) => x - y);
    if (rrule.BYSETPOS) {
      const pos = rrule.BYSETPOS.split(',').map(Number);
      lista = pos.map((p) => (p > 0 ? lista[p - 1] : lista[lista.length + p])).filter(Boolean).sort((x, y) => x - y);
    }
    return lista;
  }
  return diaInicio <= n ? [diaInicio] : [];
}

/**
 * Inicios de cada repetición (campos en la zona del evento), en orden, hasta `limite` (ms UTC en la zona).
 */
export function repeticiones(inicio, rrule, limiteF) {
  const freq = (rrule.FREQ || '').toUpperCase();
  const intervalo = Math.max(1, +rrule.INTERVAL || 1);
  const cuenta = rrule.COUNT ? +rrule.COUNT : Infinity;
  let hasta = null;
  if (rrule.UNTIL) {
    // UNTIL suele venir en UTC: se pasa a la zona del evento para compararlo con sus repeticiones.
    const u = leerFecha(rrule.UNTIL, {});
    if (u) hasta = u.zona === 'UTC' && inicio.zona && inicio.zona !== 'UTC' ? desdeUTC(aUTC(u.f) + desfase(inicio.zona, aUTC(u.f))) : u.f;
  }
  const tope = hasta && aUTC(hasta) < aUTC(limiteF) ? hasta : limiteF;
  const fuera = (f) => aUTC(f) > aUTC(tope);
  const out = [];
  let n = 0;
  const empezar = aUTC(inicio.f);
  const meter = (f) => {
    if (aUTC(f) < empezar) return true;
    if (n >= cuenta || fuera(f)) return false;
    n++;
    out.push(f);
    return true;
  };
  const base = inicio.f;
  const conHora = (a, m, d) => ({ a, m, d, h: base.h, min: base.min });
  for (let k = 0, vueltas = 0; vueltas < 20000; k++, vueltas++) {
    let candidatos = [];
    if (freq === 'DAILY') candidatos = [sumarDias(base, k * intervalo)];
    else if (freq === 'WEEKLY') {
      const lunes = sumarDias(base, -((diaSemana(base) + 6) % 7) + k * 7 * intervalo);
      const dias = rrule.BYDAY ? rrule.BYDAY.split(',').map((x) => DIAS_ICS.indexOf(x.slice(-2))).filter((x) => x >= 0) : [diaSemana(base)];
      candidatos = dias.map((d) => sumarDias(lunes, (d + 6) % 7)).sort((x, y) => aUTC(x) - aUTC(y));
    } else if (freq === 'MONTHLY') {
      const total = base.m - 1 + k * intervalo;
      const a = base.a + Math.floor(total / 12), m = (total % 12) + 1;
      candidatos = diasDelMes(a, m, rrule, base.d).map((d) => conHora(a, m, d));
    } else if (freq === 'YEARLY') {
      const a = base.a + k * intervalo;
      const meses = rrule.BYMONTH ? rrule.BYMONTH.split(',').map(Number) : [base.m];
      for (const m of meses) {
        const r = rrule.BYDAY || rrule.BYMONTHDAY ? rrule : {};
        candidatos.push(...diasDelMes(a, m, r, base.d).map((d) => conHora(a, m, d)));
      }
    } else {
      return [base];
    }
    if (candidatos.length && candidatos.every((f) => fuera(f))) break;
    let seguir = true;
    for (const f of candidatos) if (!meter(f)) { seguir = false; break; }
    if (!seguir || n >= cuenta) break;
  }
  return out;
}

// ---------- Eventos de un rango ----------

/**
 * @param {string} texto  contenido del .ics
 * @param {string} desde  'AAAA-MM-DD' (incluido)
 * @param {string} hasta  'AAAA-MM-DD' (no incluido)
 */
export function eventosEnRango(texto, desde, hasta) {
  const todos = leerIcs(texto).filter((e) => e.estado !== 'CANCELLED');
  const cambios = new Map(); // uid|inicio original → evento que lo sustituye
  for (const e of todos) if (e.recurrenceId) cambios.set(`${e.uid}|${aTexto(aEspana(e.recurrenceId.f, e.recurrenceId.zona))}`, e);
  const limiteF = { ...sumarDias({ a: +hasta.slice(0, 4), m: +hasta.slice(5, 7), d: +hasta.slice(8, 10), h: 0, min: 0 }, 2) };
  const salida = [];

  const anadir = (e, inicioZona) => {
    const todoElDia = e.inicio.todoElDia;
    const ini = aEspana(inicioZona, e.inicio.zona);
    let fin;
    if (e.fin) {
      const minutos = Math.round((aUTC(e.fin.f) - aUTC(e.inicio.f)) / 6e4);
      fin = aEspana(sumarMinutos(inicioZona, minutos), e.inicio.zona);
    } else if (e.duracion) fin = aEspana(sumarMinutos(inicioZona, e.duracion), e.inicio.zona);
    else fin = todoElDia ? sumarDias(ini, 1) : ini;
    // Se queda si se cruza con [desde, hasta)
    const finDia = todoElDia ? aDia(sumarDias(fin, -1)) : aDia(fin.h === 0 && fin.min === 0 && aUTC(fin) > aUTC(ini) ? sumarMinutos(fin, -1) : fin);
    if (aDia(ini) >= hasta || finDia < desde) return;
    salida.push({
      id: `${e.uid || e.titulo}|${aTexto(ini)}`,
      titulo: e.titulo || '(Sin título)',
      inicio: todoElDia ? aDia(ini) : aTexto(ini),
      fin: todoElDia ? aDia(fin) : aTexto(fin),
      todoElDia,
      lugar: e.lugar || null,
    });
  };

  for (const e of todos) {
    if (e.recurrenceId) { anadir(e, e.inicio.f); continue; }
    if (!e.rrule) { anadir(e, e.inicio.f); continue; }
    const excluidos = new Set(e.exdates.map((x) => aTexto(aEspana(x.f, x.zona))));
    // El límite se calcula en la zona del evento (pequeño margen de 2 días).
    for (const f of repeticiones(e.inicio, e.rrule, limiteF)) {
      const clave = aTexto(aEspana(f, e.inicio.zona));
      if (excluidos.has(clave) || cambios.has(`${e.uid}|${clave}`)) continue;
      anadir(e, f);
    }
  }
  return salida.sort((x, y) => x.inicio.localeCompare(y.inicio));
}

// ---------- Servidor ----------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

export function urlPermitida(url) {
  try {
    const u = new URL(String(url).trim().replace(/^webcal:\/\//i, 'https://'));
    if (u.protocol !== 'https:') return null;
    if (!HOSTS_PERMITIDOS.some((r) => r.test(u.hostname))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function leerUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'text/calendar' }, redirect: 'follow' });
    if (!r.ok) throw new Error(`iCloud respondió ${r.status}`);
    const texto = await r.text();
    if (texto.length > 8_000_000) throw new Error('El calendario es demasiado grande');
    if (!texto.includes('BEGIN:VCALENDAR')) throw new Error('El enlace no es un calendario');
    return texto;
  } finally {
    clearTimeout(t);
  }
}

const esDia = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t || '');

if (typeof Deno !== 'undefined') {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return responder({ error: 'Usa POST' }, 405);
    const auth = req.headers.get('Authorization');
    if (!auth) return responder({ error: 'Falta la sesión' }, 401);
    let cuerpo = {};
    try { cuerpo = await req.json(); } catch { /* vacío */ }
    const { desde, hasta } = cuerpo;
    if (!esDia(desde) || !esDia(hasta) || hasta <= desde) return responder({ error: 'Rango de días no válido' }, 400);
    if ((Date.parse(hasta) - Date.parse(desde)) / 864e5 > 62) return responder({ error: 'Pide como mucho 62 días' }, 400);

    const clave = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), clave, { global: { headers: { Authorization: auth } } });
    const { data: calendarios, error } = await supabase.from('calendarios').select('id, nombre, url, color').eq('archivado', false).eq('activo', true);
    if (error) return responder({ error: error.message }, 400);

    const eventos = [], errores = [];
    await Promise.all((calendarios || []).map(async (c) => {
      const url = urlPermitida(c.url);
      if (!url) { errores.push({ calendario_id: c.id, nombre: c.nombre, mensaje: 'El enlace no es de iCloud' }); return; }
      try {
        const lista = eventosEnRango(await leerUrl(url), desde, hasta);
        for (const e of lista) eventos.push({ ...e, calendario_id: c.id, calendario: c.nombre, color: c.color });
      } catch (e) {
        errores.push({ calendario_id: c.id, nombre: c.nombre, mensaje: e.name === 'AbortError' ? 'iCloud tardó demasiado' : e.message });
      }
    }));
    eventos.sort((x, y) => x.inicio.localeCompare(y.inicio));
    return responder({ eventos, errores });
  });
}
