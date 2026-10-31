// Configuración pública de Orvia.
// La URL y la clave "anon" de Supabase están pensadas para ir en el navegador:
// la seguridad la ponen las reglas por fila de la base de datos (supabase/001_nucleo.sql).
// La clave "service_role" / "secret" NUNCA debe aparecer en este repositorio.

export const SUPABASE_URL = 'https://ofepgabdhdwnqtjyaraj.supabase.co';
export const SUPABASE_CLAVE_PUBLICA =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mZXBnYWJkaGR3bnF0anlhcmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDQwMjgsImV4cCI6MjEwOTAyMDAyOH0.6q1gyjOl6FpwrLZNvY1qgC6LVnldfMq2dg7JJAiyRm8';

// Áreas de vida que se crean la primera vez que entras.
export const AREAS_INICIALES = [
  { nombre: 'Personal', color: 'azul' },
  { nombre: 'Salud', color: 'verde' },
  { nombre: 'Profesional', color: 'violeta' },
  { nombre: 'Finanzas', color: 'ambar' },
  { nombre: 'Relaciones', color: 'coral' },
  { nombre: 'Ocio', color: 'cian' },
];
