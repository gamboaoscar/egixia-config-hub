# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.12.0] — 2026-07-02

### Añadido
- **Actas por módulo (PDF real)**: `src/lib/acta/acta-pdf.ts` genera el
  PDF con encabezado EGIXIA, metadatos (proyecto, empresa, módulo,
  quién diligenció, fecha/hora, versión), tabla campo→valor y
  declaración de conformidad. Funciona en cliente y servidor
  (Worker/Edge).
- **Persistencia del acta**: `src/lib/acta/acta.server.ts` sube el PDF
  al bucket privado `actas` (path
  `{proyecto_id}/{modulo_id}/acta-vN.pdf`) y registra la versión en
  la tabla `actas`. Cada envío/reenvío a revisión crea la siguiente
  versión.
- **Previsualización y descarga (invitado)**:
  `src/lib/acta.functions.ts` expone `previsualizarActa` (base64) y
  `descargarActaFirmada` (URL firmada 7 días). El botón
  "Previsualizar acta" aparece junto a "Enviar a revisión" en
  `/mi-proyecto/modulo/{id}`.
- **Plantillas de correo EGIXIA** (`src/lib/acta/plantillas-correo.ts`)
  para invitación, envío/acta, devolución con observaciones y
  aprobación. Layout calmado con banda primaria #0F2B8E y fondo suave.
- **Edge Function `enviar-correo`** (`supabase/functions/enviar-correo`)
  con soporte para Resend (`RESEND_API_KEY`, `CORREO_FROM`) y modo
  *dry-run* cuando no hay proveedor configurado.
- **Notificaciones automáticas**: `src/lib/acta/notificaciones.server.ts`
  segmenta destinatarios (internos vs invitados), renderiza la
  plantilla adecuada con el CTA a la ruta correcta de cada portal
  (`/app/...` o `/mi-proyecto/...`) e invoca la Edge Function.

### Cambiado
- `src/lib/revision.functions.ts` reemplaza el marcador
  `notificacion_pendiente` por notificaciones reales vía plantillas +
  Edge Function, y el acta pasa de una URL marcador a un PDF
  persistido en Storage.

## [0.11.0] — 2026-07-02

### Añadido
- **Flujo de revisión por módulo (Parte 12)**: transiciones de estado
  gobernadas por servidor (`src/lib/revision.functions.ts`) con las
  server functions `enviarModuloARevision`, `aprobarModulo`,
  `devolverModuloConObservaciones`, `reabrirModulo` y
  `reenviarModulo`. Toda escritura sobre `proyecto_modulos`,
  `observaciones` y `actas` se hace con `supabaseAdmin` porque las
  políticas RLS impiden explícitamente que el invitado cambie a
  `en_revision` y que el proveedor marque observaciones como
  resueltas; la autorización se valida en código (rol y membresía).
- **Generación de acta (v1..N)**: cada envío/reenvío inserta una fila
  en `actas` con `version` consecutiva por módulo. El PDF real lo
  producirá la Parte 11; hoy se guarda una URL marcador
  (`acta://modulo/{id}/vN`).
- **Notificaciones por correo (encoladas)**: helper `notificar` que
  usa la RPC `destinatarios_notificacion` y registra la intención en
  `auditoria` como `notificacion_pendiente` (destinatarios, asunto,
  mensaje). Cuando se conecte un proveedor de correo, este helper
  disparará el envío real sin cambiar los call-sites.
- **Autocompletado de proyecto**: trigger `trg_autocompletar_proyecto`
  sobre `proyecto_modulos` que ejecuta `autocompletar_proyecto()`
  cuando un módulo pasa a `aprobado` — si todos los módulos del
  proyecto quedan aprobados, el proyecto pasa a `completado`.
- **Vista del proveedor**: el botón "Enviar a revisión" en
  `src/routes/mi-proyecto.modulo.$moduloId.tsx` se habilita solo con
  `progreso === 100`, muestra "Reenviar tras corregir" cuando el
  módulo está `con_observaciones` y refresca datos al terminar.
- **Vista interna de revisión**: nueva ruta `/app/modulo/:moduloId`
  (`src/routes/app.modulo.$moduloId.tsx`) que muestra el módulo en
  solo lectura, lista las observaciones abiertas/resueltas y ofrece
  Aprobar, Devolver (constructor de observaciones por campo) y
  Reabrir (para módulos aprobados).
- **Bandeja de revisiones**: `src/components/revisiones-pendientes.tsx`
  reemplaza el stub de `/app/revisiones` con la lista real de módulos
  en estado `en_revision`, ordenados por antigüedad del envío.

### Cambiado
- Cada transición registra una entrada en `auditoria`
  (`modulo_enviado_revision`, `modulo_aprobado`,
  `modulo_devuelto_con_observaciones`, `modulo_reabierto`,
  `modulo_reenviado`) más la `notificacion_pendiente` asociada.

## [0.10.0] — 2026-07-02

### Añadido
- **Módulo `seguridad` — Seguridad (Parte 9)**: definición completa en
  `src/lib/form-engine/modulos/seguridad.ts` con 4 secciones: política
  de contraseñas (7 numéricos requeridos con estándar EGIXIA como
  placeholder/guía), roles internos (16 perfiles predefinidos), roles
  de proveedor (6 opciones con aviso de máx. 5 por empresa) y nota
  informativa sobre roles personalizados adicionales (mesa de servicio).
- **Motor de formularios — nuevos tipos de campo**:
  - `checkbox_multiple`: selección múltiple de opciones renderizada
    como tarjetas con checkbox; persiste `string[]` en `datos`.
  - `info`: campo puramente informativo (sin valor). No cuenta para
    validación ni para el cálculo de progreso.
- Registro del módulo en `src/lib/form-engine/modulo-ejemplo.ts` (se
  eliminó la definición demo previa de `seguridad`).
- **Documentación**: ficha completa del módulo `seguridad` en
  `docs/MODULOS.md` y detalle de las extensiones del motor.

## [0.9.0] — 2026-07-02

### Añadido
- **Módulo `sociedades` — Creación de Sociedades (Parte 8)**: definición
  completa en `src/lib/form-engine/modulos/sociedades.ts` como tabla
  dinámica con 10 columnas (país, tipo doc., n.º identificación, DV,
  razón social, descripción, ciudad, teléfono, correo, logo 200×200).
  Sin límite de filas; capacidad mínima 8.
- **Motor de tablas extendido**: `ColumnaTabla` ahora admite los tipos
  `select` (con `opciones: OpcionCampo[]`) y `archivo` (con
  `ConfigArchivo`), además de `guia`, `longitud`, `placeholder` y
  `ancho`. `TablaDinamica` renderiza el control adecuado por celda y
  muestra el popover "i" en el encabezado cuando la columna tiene guía.
- **Auto-ajuste en celdas de archivo**: cada logo de sociedad usa
  `CampoArchivo` (Parte 6) con path único por celda
  (`campoKey_fila_columna`), heredando validación de formato/peso y el
  panel de ajuste con recorte centrado a 200×200 px.
- **Progreso ponderado para tablas**: `calcularProgreso()` cuenta las
  celdas requeridas llenas en todas las filas
  (`filas × columnas_requeridas`). Si aún no hay filas, la tabla cuenta
  como una unidad sin llenar; con ≥1 fila el módulo pasa a estar
  "iniciado".
- **Documentación**: `docs/MODULOS.md` incluye la ficha completa del
  módulo `sociedades` y las extensiones del motor.

## [0.8.0] — 2026-07-02

### Añadido
- **Módulo `imagen` — Imagen Corporativa (Parte 7)**: definición
  declarativa completa en `src/lib/form-engine/modulos/imagen.ts`
  cubriendo las 7 secciones del brief (color corporativo, logotipos,
  imagen de fondo, documentos legales, pie de página en 4 columnas,
  correo de salida y URLs del portal). Cada campo incluye guía
  contextual (qué / formato / tamaño) y marca los requeridos.
- **Visibilidad condicional (`mostrarSi`)**: nueva propiedad opcional
  en `CampoDefinicion` (`{ campo, igualA }`). El motor la usa en
  `formulario-modulo.tsx` para renderizar solo los campos aplicables
  (p. ej. subcampos de SMTP cuando `correo_opcion === "smtp"`,
  buzón EGIXIA cuando se elige la opción recomendada). `validarModulo`
  y `calcularProgreso` ignoran los campos ocultos.
- **Aviso suave por campo (`aviso`)**: bloque informativo ámbar debajo
  del control (sin bloquear el guardado). Se usa para riesgos de SPAM
  del SMTP propio y para recordar que el puerto 25 no se admite.
- **Validaciones URL**: `url_produccion` y `url_calidad` usan
  `url_https` con placeholders que muestran el formato esperado
  (`https://[NombrePortalCliente-País].egixia.app` y
  `https://www.egixia.net/[NombrePortalCliente-País]`).
- **Documentación**: `docs/MODULOS.md` reescrito con la ficha
  completa del módulo `imagen` y la guía para añadir nuevos módulos.

## [0.7.0] — 2026-07-02

### Añadido
- **Carga real de archivos (Parte 6)**: el motor de formularios sube
  binarios a los buckets privados `logos-clientes` (imágenes / logos)
  y `documentos` (PDFs), registra metadatos en `public.archivos` y
  guarda la referencia (`archivoId`, `bucket`, `storagePath`,
  `dimensiones`, `ajustado`) en `proyecto_modulos.datos`.
- **Configuración `archivo` por campo**: nueva forma en
  `CampoDefinicion.archivo` con `bucket`, `formatosPermitidos`,
  `tamanoMaxMB` y `dimensiones: { ancho, alto }` opcionales.
- **Validación en cliente**: `formatoPermitido()` acepta mimes
  (`image/png`) o extensiones (`.svg`); `tamanoMaxBytes()` rechaza con
  mensaje claro en español los archivos que superan el límite (5 MB
  por defecto).
- **Auto-ajuste al tamaño exacto**: cuando la imagen raster no
  coincide con las dimensiones declaradas, se abre un panel de ajuste
  con vista previa en modo `cover` y dos sliders para reposicionar el
  encuadre. Al confirmar, `redimensionarCover()` genera un PNG a las
  dimensiones exactas con canvas y sube esa versión. La original nunca
  llega a Storage.
- **SVG y PDF**: no se re-encodean; SVG se valida contenido y PDF solo
  tipo/tamaño.
- **Previsualización con URLs firmadas** (`createSignedUrl`, 1 hora)
  porque los buckets son privados.
- **Tarjeta del archivo cargado**: miniatura + nombre + peso +
  dimensiones + pastilla *"Ajustado a 400×110 px"* + acciones
  Reemplazar / Quitar. Al reemplazar se borra el binario anterior de
  Storage.

## [0.6.0] — 2026-07-02

### Añadido
- **Motor de formularios dinámicos (Parte 5)**: definición
  declarativa de módulos en `src/lib/form-engine/tipos.ts`
  (`ModuloDefinicion`, `SeccionDefinicion`, `CampoDefinicion`) con
  soporte para 10 tipos de campo (`texto`, `textarea`, `numero`,
  `email`, `url`, `select`, `radio_tarjetas`, `color`, `archivo`,
  `tabla`), guía por campo, validaciones (`url_https`, `email`,
  `min`, `max`, `longitud`) y bandera `activo` para desactivar
  campos por configuración del proyecto (no se muestran ni cuentan).
- **Renderizador genérico** `<FormularioModulo />` que pinta cada
  sección como tarjeta ("cuadrito") y delega en `<CampoRenderer />`
  por tipo. `radio_tarjetas`, `color` y `tabla` con estilo EGIXIA.
- **Botón "i" con popover** (`<CampoInfo />`) que muestra *qué
  ingresar*, *formato* y *tamaño recomendado* solo al pulsarlo;
  nunca expandido por defecto.
- **Validaciones en línea** en español, con tono amable, mostradas
  debajo del campo. No bloquean el autoguardado del borrador; solo
  se exigen los requeridos al enviar a revisión (Parte 10).
- **Autoguardado + progreso**: hook `useFormModulo` con debounce
  (~700 ms) que persiste `proyecto_modulos.datos` y recalcula
  `proyecto_modulos.progreso` (campos requeridos activos con valor
  ÷ total requeridos activos × 100). El indicador del topbar
  refleja `Guardando…`, `Guardado hh:mm` o `No se pudo guardar`.
- **Solo lectura** automático cuando el módulo está en revisión,
  aprobado o vencido con bloqueo: los campos se deshabilitan y el
  autosave no se dispara.
- **Módulos de ejemplo** (`modulo-ejemplo.ts`) con definiciones
  mínimas de Imagen, Sociedades y Seguridad para validar el motor.
  El contenido real llega en las Partes 7–9.

## [0.5.0] — 2026-07-02

### Añadido
- **Espacio del invitado (Parte 4)**: shell dedicado en `/mi-proyecto`
  con `MiProyectoProvider` que carga el proyecto donde el usuario es
  miembro y sus `proyecto_modulos` (respeta RLS: solo su proyecto).
- **Sidebar dinámico del invitado**: enlace a *Inicio* y un ítem por
  cada módulo asignado con ícono, pastilla de estado y % de avance.
- **Topbar del invitado**: nombre del proyecto, empresa, pastilla con la
  fecha límite más próxima e indicador de guardado (`Guardando…`,
  `Guardado hh:mm`, `No se pudo guardar`).
- **Dashboard del proyecto** (`/mi-proyecto`): tarjeta de bienvenida con
  avance general (anillo SVG), grid de tarjetas por módulo con botón
  contextual (*Comenzar*, *Continuar*, *Ver*, *Corregir observaciones*)
  y mensaje amable de siguiente paso.
- **Shell de módulo** (`/mi-proyecto/modulo/:moduloId`): encabezado con
  estado y avance, listado de observaciones abiertas, marcadores de
  secciones (los campos reales llegan en la Parte 5), botón *Enviar a
  revisión* visible pero deshabilitado.
- **Bloqueo por estado y fecha límite** en la UI: modo solo lectura si
  el módulo está `en_revision`/`aprobado` o si venció con
  `comportamiento_vencimiento = bloquear`.
- **Banners de vencimiento** (`VencimientoBanner`) con variantes según
  `comportamiento_vencimiento` y recordatorio suave a ≤ 3 días.
- **Autoguardado con debounce** (`useAutosaveModulo`): actualiza
  `proyecto_modulos.datos`/`progreso` y refresca el indicador del
  topbar. Cableado listo para la Parte 5.

## [0.4.0] — 2026-07-02

### Añadido
- **Modelo de datos de negocio (Parte 3)**: tablas `proyectos`,
  `proyecto_miembros`, `proyecto_modulos`, `invitaciones`, `observaciones`,
  `actas` y `archivos`, con sus enums y triggers de `updated_at`.
- **Buckets privados** en Storage: `logos-clientes`, `documentos` y `actas`
  (acceso mediante URLs firmadas, política basada en membresía de proyecto
  mediante el primer segmento del path `{proyecto_id}/…`).
- **Flujo público de invitación**: función RPC `validar_invitacion(token)`,
  server function `aceptarInvitacion` (SECURITY DEFINER + service role) y
  ruta pública `/invitacion/:token` con formulario de nombre, apellido y
  contraseña. Tokens de un solo uso, con expiración y reclamo atómico.
- **Funciones de negocio**: `is_project_member`, `puede_editar_modulo`,
  `destinatarios_notificacion` y trigger `autocompletar_proyecto` (marca el
  proyecto como `completado` cuando todos sus módulos quedan aprobados).
- **RLS por rol** en todas las tablas nuevas siguiendo el principio de
  mínimo privilegio (ver `docs/SEGURIDAD.md`).

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