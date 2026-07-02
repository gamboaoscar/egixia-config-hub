# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.2.0] — 2026-07-02

### Añadido

- **Landing pública** (`/`) con identidad EGIXIA:
  - Barra superior con marca "EGIXIA" y botón "Ingresar" → `/login`.
  - Hero centrado con degradado sutil `--primary-soft` → `--background`,
    título "Portal de Configuración de tu Implementación", subtítulo y CTA
    "Acceder con mi invitación".
  - Sección "¿Cómo funciona?" con 3 tarjetas: Ingresa, Diligencia, Confirma.
  - Pie de página en primario oscuro (`--primary-dark`) con marca y aviso
    de copyright.
- **Ruta `/login`** temporal ("se construye en el siguiente paso").
- **Layout privado** en `/app` con sidebar colapsable (ícono + texto ↔
  solo íconos, ~256 px / ~64 px) en fondo primario oscuro y texto blanco,
  topbar sticky con título de sección y área de contenido con padding.
  - Zona de usuario y botón "Cerrar sesión" en el pie del sidebar (sin
    lógica todavía).
- **Ruta `/app/`** (índice del área privada) con placeholder.

### Cambiado

- El root layout ya no monta el sidebar; ahora sólo renderiza `<Outlet />`
  para que la landing sea completamente pública.
- Tokens `--sidebar-*` remapeados al primario oscuro EGIXIA.

### Eliminado

- Rutas stub `/formularios`, `/proyectos`, `/configuracion` (se
  reintroducirán como hijas de `/app` cuando se construyan los módulos).

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