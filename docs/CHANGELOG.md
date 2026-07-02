# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.1.0] — 2026-07-02

### Añadido

- Esqueleto visual del proyecto **EGIXIA Configurator**.
- Tema de Tailwind v4 con la paleta EGIXIA como variables (`src/styles.css`):
  Azul Rey `#0F2B8E`, primario oscuro `#0b1e62`, primario claro `#e8eef8`,
  éxito `#00ab4f`, advertencia `#f59e0b`, error `#ef4444`, fondo `#f0f4f8`,
  tarjetas `#ffffff`, borde `#d1d9e6`, texto `#1e2d4f`, texto secundario
  `#64748b`. Tipografía: system font stack.
- Layout base con **sidebar izquierdo colapsable** (ícono + texto ↔ solo
  íconos), con estado persistido por cookie, ítem activo resaltado y header
  superior con botón para colapsar/expandir.
- Pantalla de bienvenida temporal con la identidad EGIXIA.
- Rutas stub: `/formularios`, `/proyectos`, `/configuracion`.
- Documentación inicial en `/docs`: `ARQUITECTURA`, `MODELO_DE_DATOS`,
  `ROLES_Y_PERMISOS`, `MODULOS`, `DECISIONES`, `CHANGELOG`, `GUIA_UX`.
- `README.md` con descripción del proyecto, stack y estructura de carpetas.

### Pendiente para próximos pasos

- Integración con Supabase (auth, DB, storage).
- Modelo de datos y catálogo de módulos/campos.
- Formularios guiados con progreso, autoguardado y ayuda por campo.