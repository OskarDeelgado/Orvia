// Service worker de Orvia.
// Estrategia: primero la red (para ver siempre la última versión) y, si no hay
// conexión, la copia guardada. Las llamadas a Supabase no se tocan nunca.
// Al cambiar archivos de la carcasa, sube VERSION para refrescar la caché.

const VERSION = 'orvia-v5';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'core/app.js',
  'core/auth.js',
  'core/areas.js',
  'core/config.js',
  'core/db.js',
  'core/enlaces.js',
  'core/panel.js',
  'core/ui/componentes.js',
  'core/ui/estilos.css',
  'modules/registro.js',
  'modules/finanzas/index.js',
  'modules/accion/index.js',
  'modules/cerebro/index.js',
  'vendor/supabase.js',
  'vendor/fuentes/manrope-latin-wght-normal.woff2',
  'vendor/fuentes/manrope-latin-ext-wght-normal.woff2',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const peticion = e.request;
  if (peticion.method !== 'GET') return;
  if (new URL(peticion.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((c) => c.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() =>
        caches
          .match(peticion, { ignoreSearch: true })
          .then((r) => r || caches.match('index.html')),
      ),
  );
});
