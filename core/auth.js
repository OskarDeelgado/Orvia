// Acceso con correo y contraseña.
// Los registros están cerrados en Supabase: el usuario se crea a mano desde el panel.
// La sesión queda guardada en cada dispositivo, así que la contraseña se escribe
// una sola vez por dispositivo.

import { cliente } from './db.js';

export async function sesionActual() {
  const { data } = await cliente.auth.getSession();
  return data.session;
}

/** Avisa de cada cambio: funcion(evento, sesion). Evento 'PASSWORD_RECOVERY' = viene del correo de recuperación. */
export function alCambiarSesion(funcion) {
  const { data } = cliente.auth.onAuthStateChange((evento, sesion) => funcion(evento, sesion));
  return () => data.subscription.unsubscribe();
}

export async function entrar(email, contrasena) {
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasena });
  if (error) throw new Error(traducir(error));
}

/** Envía un correo con un enlace para poner una contraseña nueva. */
export async function recuperarContrasena(email) {
  const volverA = window.location.origin + window.location.pathname;
  const { error } = await cliente.auth.resetPasswordForEmail(email, { redirectTo: volverA });
  if (error) throw new Error(traducir(error));
}

export async function cambiarContrasena(nueva) {
  const { error } = await cliente.auth.updateUser({ password: nueva });
  if (error) throw new Error(traducir(error));
}

/** Guarda el nombre con el que te saluda el Panel y devuelve la sesión actualizada. */
export async function guardarNombre(nombre) {
  const { error } = await cliente.auth.updateUser({ data: { nombre: nombre.slice(0, 40) } });
  if (error) throw new Error(traducir(error));
  await cliente.auth.refreshSession();
  return sesionActual();
}

export async function cerrarSesion() {
  await cliente.auth.signOut();
}

export const LONGITUD_MINIMA = 8;

function traducir(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (m.includes('email not confirmed')) {
    return 'Tu usuario no está confirmado. En Supabase, crea el usuario con «Auto Confirm User» marcado.';
  }
  if (m.includes('rate limit') || error.status === 429) {
    return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.';
  }
  if (m.includes('should be different')) return 'La contraseña nueva debe ser distinta de la actual.';
  if (m.includes('password') && (m.includes('short') || m.includes('at least'))) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`;
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Sin conexión con el servidor. Comprueba tu conexión a internet.';
  }
  return error.message;
}
