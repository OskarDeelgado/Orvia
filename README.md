# Orvia

Ecosistema personal: finanzas, objetivos, proyectos y conocimiento en una sola app, con una base de datos común.

- **App:** web instalable (PWA), alojada en GitHub Pages.
- **Datos:** Supabase (PostgreSQL). Cada fila solo la puede leer su propietario.
- **Sin compilación:** JavaScript con módulos nativos. Publicar = subir cambios a `main`.
- **Diseño:** solo modo oscuro. En el ordenador el Panel es una oficina 3D; en el móvil, fichas de los agentes. Cada módulo es un «mundo» con su color (`data-mundo`).

## Estructura

```
index.html            carcasa: carga estilos, cliente de Supabase y la app
core/
  app.js              sesión, navegación (#/ Panel, #/oficina, #/<módulo>, #/ajustes) y ajustes
  panel.js            el Panel: oficina 3D en el ordenador, fichas del equipo en el móvil
  oficina.js          la oficina 3D (se carga solo cuando se muestra)
  config.js           URL y clave pública de Supabase, áreas iniciales
  db.js               única puerta de acceso a la base de datos
  auth.js             acceso con correo y contraseña (registros cerrados)
  areas.js            áreas de vida
  enlaces.js          relaciones libres entre elementos
  ui/                 sistema de diseño común
modules/
  registro.js         lista de módulos (cada uno es un despacho con su agente)
  finanzas/ accion/ cerebro/
supabase/
  001_nucleo.sql      tablas del núcleo y seguridad por fila
vendor/               supabase-js, three.js (3D) y la fuente Manrope, servidos localmente
```

## Reglas

1. Un módulo nunca llama a otro: todo pasa por `core/db.js`.
2. Cualquier cambio de tablas se escribe como una migración nueva en `supabase/` (`002_…`, `003_…`).
3. Nunca se sube la clave secreta (`service_role`) de Supabase.
4. Al cambiar archivos de la carcasa, se sube `VERSION` en `sw.js`.

El documento de arquitectura completo está en el proyecto «Mi ecosistema» de Claude.
