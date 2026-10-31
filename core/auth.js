// Inicio de sesión sin contraseña.
// Supabase envía un email con un enlace y un código. El código sirve para
// entrar desde la app instalada en el móvil: en iPhone, la app instalada y
// Safari no comparten la sesión, así que el enlace abriría Safari y no la app.

import { cliente } from './db.js';

export async function sesionActual() {
  const { data } = await cliente.auth.getSession();
  return data.session;
}

export function alCambiarSesion(funcion) {
  const { data } = cliente.auth.onAuthStateChange((_evento, sesion) => funcion(sesion));
  return () => data.subscription.unsubscribe();
}

export async function enviarAcceso(email) {
  const volverA = window.location.origin + window.location.pathname;
  const { error } = await cliente.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: volverA, shouldCreateUser: true },
  });
  if (error) throw new Error(traducir(error));
}

export async function entrarConCodigo(email, codigo) {
  const { error } = await cliente.auth.verifyOtp({ email, token: codigo, type: 'email' });
  if (error) throw new Error(traducir(error));
}

export async function cerrarSesion() {
  await cliente.auth.signOut();
}

function traducir(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('rate limit') || error.status === 429) {
    return 'Has pedido demasiados correos seguidos. Espera un minuto y vuelve a intentarlo.';
  }
  if (m.includes('expired') || m.includes('invalid')) {
    return 'El código no es válido o ha caducado. Pide un correo nuevo.';
  }
  if (m.includes('signups not allowed')) {
    return 'Este correo no tiene acceso a Orvia.';
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Sin conexión con el servidor. Comprueba tu conexión a internet.';
  }
  return error.message;
}
