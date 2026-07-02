# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.3.0] — 2026-07-02

### Añadido

- **Integración con Supabase** (auth + base de datos + storage) usando el
  cliente ya presente en `src/integrations/supabase/`.
- **Autenticación por email + contraseña**. Registro público
  **deshabilitado**: al Configurator solo se entra por invitación.
- **Tabla `profiles`** vinculada 1:1 con `auth.users` (mismo `id`):
  `nombre`, `apellido`, `email` (no editable), `foto_perfil`, `cargo`,
  `empresa`, `rol` (`admin` | `implementador` | `cliente`, por defecto
  `cliente`), `estado` (`activo` | `inhabilitado`, por defecto `activo`),
  `created_at`. Fila creada automáticamente al registrarse un usuario
  mediante trigger.
- **Trigger `profiles_guard_before_update`** que impide a los no-admin
  modificar `email`, `rol` y `estado`.
- **Función `has_role(rol)`** (`SECURITY DEFINER`) para verificaciones de
  permisos desde RLS.
- **Tabla `auditoria`**: `id`, `actor_id`, `accion`, `entidad`,
  `entidad_id`, `detalle` (jsonb), `created_at`, con RLS que restringe
  lectura a `admin`/`implementador`. Helper `registrar_auditoria(...)`
  (`SECURITY DEFINER`) para inserción segura desde el resto de la app.
- **Bucket privado `avatares`** en Storage con políticas que limitan
  lectura/escritura a la carpeta `auth.uid()/…` del propio usuario.
- **Usuario administrador inicial** `hilberth.lopezv@egixia.com` creado
  con Edge Function `bootstrap-admin`. La contraseña definitiva se
  establece desde `/login → ¿Olvidaste tu contraseña?`.
- **`AuthProvider`** (`src/hooks/use-auth.tsx`) que expone sesión, perfil
  y URL firmada del avatar; persiste la sesión al recargar y se
  sincroniza con `onAuthStateChange`.
- **`PrivateShell`** (`src/components/private-shell.tsx`): shell del área
  privada con sidebar + topbar y guard de rol. Redirige a `/login` si no
  hay sesión, aplica redirección por rol y bloquea el acceso cuando el
  perfil está `inhabilitado`.
- **Rutas protegidas**:
  - `/app` (admin/implementador) con secciones stub `proyectos`,
    `revisiones`, `invitaciones`, `usuarios`, `catalogo`, `auditoria`,
    `configuracion`.
  - `/mi-proyecto` (cliente) con sección stub `modulos`.
  - `/app/mi-perfil` y `/mi-proyecto/mi-perfil` con la pantalla
    **Mi perfil** compartida.
- **Pantalla `/login`** con identidad EGIXIA, manejo de errores en
  español (credenciales inválidas, cuenta inhabilitada, límite de
  intentos, correo no confirmado) y enlace "¿Olvidaste tu contraseña?"
  que abre un diálogo y dispara la recuperación de Supabase.
- **Pantalla `/reset-password`** para completar el flujo de
  recuperación (definir nueva contraseña).
- **Pantalla "Mi perfil"** (`src/components/mi-perfil.tsx`): editar
  nombre, apellido, cargo y empresa; ver correo en solo lectura; subir
  avatar (PNG/JPG/WEBP, ≤ 2 MB); y solicitar por correo el cambio de
  contraseña.
- **Sidebar dinámico por rol** con avatar + nombre + rol del usuario
  autenticado y botón "Cerrar sesión" funcional:
  - cliente: Inicio · Mis módulos.
  - implementador: Inicio · Proyectos · Revisiones pendientes ·
    Invitaciones.
  - admin: Inicio · Proyectos · Revisiones pendientes · Invitaciones ·
    Usuarios · Catálogo de módulos · Auditoría · Configuración.

### Seguridad

- RLS activa en `profiles` y `auditoria`.
- `has_role`, `handle_new_user` y `registrar_auditoria` con
  `SECURITY DEFINER`, `search_path` fijado y acceso revocado a
  `anon`/`public`.
- Bucket `avatares` privado; el frontend usa URLs firmadas (1 h).
- **HIBP** (Have I Been Pwned) activado para contraseñas.
- Registro público de Supabase deshabilitado.

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