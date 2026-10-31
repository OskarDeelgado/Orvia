# Orvia

Ecosistema personal: finanzas, objetivos, proyectos y conocimiento en una sola app, con una base de datos común.

- **App:** web instalable (PWA), alojada en GitHub Pages.
- **Datos:** Supabase (PostgreSQL). Cada fila solo la puede leer su propietario.
- **Sin compilación:** JavaScript con módulos nativos. Publicar = subir cambios a `main`.

## Estructura

```
index.html            carcasa: carga estilos, cliente de Supabase y la app
core/
  app.js              sesión, navegación y ajustes
  config.js           URL y clave pública de Supabase, áreas iniciales
  db.js               única puerta de acceso a la base de datos
  auth.js             acceso sin contraseña (código o enlace por correo)
  areas.js            áreas de vida
  enlaces.js          relaciones libres entre elementos
  ui/                 sistema de diseño común
modules/
  registro.js         lista de módulos
  panel/ accion/ finanzas/ conocimiento/
supabase/
  001_nucleo.sql      tablas del núcleo y seguridad por fila
vendor/               supabase-js y fuentes, servidos localmente
```

## Reglas

1. Un módulo nunca llama a otro: todo pasa por `core/db.js`.
2. Cualquier cambio de tablas se escribe como una migración nueva en `supabase/` (`002_…`, `003_…`).
3. Nunca se sube la clave secreta (`service_role`) de Supabase.
4. Al cambiar archivos de la carcasa, se sube `VERSION` en `sw.js`.

El documento de arquitectura completo está en el proyecto «Mi ecosistema» de Claude.
