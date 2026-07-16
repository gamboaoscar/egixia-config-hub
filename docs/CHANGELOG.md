# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [1.0.8] — 2026-07-16 — Lote 1 de estabilización

### Añadido
- **`PasswordInput`** reutilizable (`src/components/ui/password-input.tsx`)
  con botón mostrar/ocultar (Eye/EyeOff, accesible con `aria-label` y
  `type="button"`). Aplicado en `/login`, `/reset-password` y
  `/invitacion/$token`.
- **Última actualización por módulo**: nueva columna
  `proyecto_modulos.updated_por` + trigger `BEFORE UPDATE` que setea
  `updated_at`/`updated_por` cuando cambian `datos`, `progreso` o
  `estado`. Visible en las tarjetas de módulo del detalle interno
  (`/app/proyectos/$id`) y del cliente (`/mi-proyecto/proyectos/$id`)
  cuando el módulo tiene progreso > 0 o estado ≠ `sin_iniciar`.
- **Helpers de fecha centralizados** en `src/lib/fechas.ts`
  (`formatoFechaHoraCO`, `formatoHoraCO`, `formatoFechaCO`,
  `fechaISOBogota`) — todas las horas visibles al usuario ahora se
  formatean en `America/Bogota`.

### Corregido
- **Autotransición de estado**: el módulo pasa de `sin_iniciar` a
  `en_diligenciamiento` automáticamente cuando el autosave sube el
  progreso por encima de 0 (trigger en BD + backfill de módulos ya
  existentes). El botón "Continuar" reemplaza a "Comenzar" al primer
  cambio.
- **Acta PDF**: pie de página y fila "Fecha y hora (Hora Colombia)"
  usan la zona `America/Bogota` en lugar de UTC.
- **Texto de roles personalizados** (módulo seguridad): se retira la
  mención a la mesa de servicio; ahora indica que los roles los define
  el implementador de EGIXIA según el alcance contratado.
- Indicador "Guardado hh:mm" del topbar del cliente, listado de
  invitaciones y auditoría reciente ahora muestran hora Colombia.

## [1.0.7] — 2026-07-04 — Selector de fecha con fines de semana y festivos CO

### Añadido
- **Selector de fecha hábil** (`src/components/ui/date-picker-habil.tsx`)
  basado en `Popover` + `Calendar` (`react-day-picker`, `date-fns`
  con locale `es`). Pinta:
  - **Sábados y domingos** en amarillo pastel.
  - **Festivos de Colombia** en rojo pastel — calculados en
    `src/lib/festivos-co.ts` combinando fechas fijas, la Ley
    Emiliani (traslado al lunes) y días basados en la Pascua
    (algoritmo de Meeus).
  - Leyenda inline con las convenciones de color.
- **Parámetro global "Bloquear fines de semana y festivos"** en
  `/app/configuracion` (sección *Parámetros generales*). Persistido
  como `parametros.bloquear_fines_semana_festivos` en
  `configuracion_sistema`. Nuevo hook `useParametrosSistema`
  (`src/hooks/use-parametros-sistema.ts`) que lo lee al montar la
  vista.

### Cambiado
- Las vistas de fecha límite (`/app/proyectos/nuevo` y
  `/app/modulo/{id}`) reemplazan el `<Input type="date">` por
  `DatePickerHabil`. Cuando el parámetro está activo, sábados,
  domingos y festivos quedan **deshabilitados** en el calendario y
  además se valida en el submit con un `toast` explicativo. Cuando
  el parámetro está desactivado, se muestran resaltados pero pueden
  seleccionarse.

### Archivos
- Nuevos: `src/lib/festivos-co.ts`,
  `src/components/ui/date-picker-habil.tsx`,
  `src/hooks/use-parametros-sistema.ts`.
- Editados: `src/routes/app.configuracion.tsx`,
  `src/routes/app.proyectos.nuevo.tsx`,
  `src/routes/app.modulo.$moduloId.tsx`.

## [1.0.6] — 2026-07-04 — Descarga directa del acta y bloqueo de reingreso al módulo enviado

### Cambiado
- **Botones "Ver acta" → "Descargar acta"** en todas las vistas
  (`/app/proyectos/$id`, `/mi-proyecto/proyectos/$id`). La acción
  ahora fuerza la descarga del PDF vía `<a download>` sobre un
  `Blob` same-origin, sin abrir pestañas emergentes ni depender de
  URLs de Storage. Nuevo helper `descargarPdfBlob` en
  `src/lib/acta/abrir-pdf.ts`.
- **`descargarActaFirmada` devuelve bytes base64** en lugar de una
  URL firmada. El servidor descarga el PDF del bucket privado
  `actas` (`descargarBytesActa` en `src/lib/acta/acta.server.ts`) y
  lo entrega al cliente para transformarlo en `Blob`. Elimina los
  bloqueos por ad-blocker (`ERR_BLOCKED_BY_CLIENT`) sobre el dominio
  del backend.
- **Tarjeta del módulo enviado en modo "en revisión" para el
  cliente**: una vez el invitado envía el módulo, la tarjeta de
  `/mi-proyecto/proyectos/$id` deja de permitir el reingreso al
  formulario. Solo se muestra el botón *Descargar acta* y una
  pastilla que comunica el estado. La transición es transparente:
  la tarjeta cambia de "En diligenciamiento" a "En revisión" al
  instante.

### Corregido
- **`Cannot destructure property '__extends'` en producción** al
  descargar el acta: se eliminó por completo la dependencia
  `pdf-lib` y se reemplazó por un generador PDF 1.4 propio y sin
  dependencias en `src/lib/acta/acta-pdf.ts`. El bundle de
  producción ya no incluye el `tslib` roto que originaba el error.
- **"Aún no hay un acta generada para este módulo"** al ver el acta
  de un módulo ya enviado: `descargarActaFirmada` autogenera y sube
  la versión faltante (`renderYSubirActa`) si el registro en
  `actas` no existe, en vez de rechazar la solicitud.

### Archivos
- Nuevo: `src/lib/acta/abrir-pdf.ts`.
- Editados: `src/lib/acta.functions.ts`, `src/lib/acta/acta.server.ts`,
  `src/lib/acta/acta-pdf.ts`, `src/lib/revision.functions.ts`,
  `src/routes/app.proyectos.$id.tsx`,
  `src/routes/mi-proyecto.proyectos.$id.tsx`,
  `src/components/form-engine/formulario-modulo.tsx`.

## [1.0.5] — 2026-07-03 — Fix login tras endurecimiento de RLS helpers

### Corregido
- **Login se quedaba cargando** con
  `permission denied for function has_role`. La migración anterior
  revocó `EXECUTE` a `authenticated` sobre las funciones
  `SECURITY DEFINER` de `public`, pero Postgres verifica `EXECUTE`
  sobre el rol del *caller* incluso cuando la función es invocada
  desde una política RLS, por lo que todo `SELECT` sobre `profiles`
  fallaba. Se restaura `EXECUTE` a `authenticated` sobre
  `has_role`, `is_project_member`, `comparten_proyecto`,
  `destinatarios_notificacion` y `registrar_auditoria`.
- `validar_invitacion` permanece server-only (solo `service_role`).

### Seguridad
- La memoria de seguridad documenta que los warnings
  `0029_authenticated_security_definer_function_executable` /
  `SUPA_authenticated_security_definer_function_executable` sobre
  estas 5 funciones son falsos positivos para este proyecto: son
  requeridas por las políticas RLS. Riesgo compensado por
  `search_path=public`, validaciones internas y RLS en las tablas
  destino.

## [1.0.4] — 2026-07-03 — UX del invitado, formularios y seguridad (4ª pasada)

Iteración de UX sobre el flujo del cliente/invitado, mejoras en el
motor de formularios y cuarta pasada del escáner de seguridad.

### Añadido
- **Menú del invitado unificado con el resto de roles**: la barra
  lateral del invitado muestra ahora *Inicio* y *Proyectos*, con la
  misma estructura visual que la del equipo interno. Se prepara el
  crecimiento del catálogo (>15 módulos) sin saturar la sidebar.
- **Rutas dedicadas del invitado por proyecto**:
  - `src/routes/mi-proyecto.proyectos.index.tsx` — listado de
    proyectos del invitado con avance general por proyecto.
  - `src/routes/mi-proyecto.proyectos.$id.tsx` — detalle del proyecto
    con avance por módulo, mismo patrón que el panel interno.
- **Indicador de proyecto en "Próximos a vencer"**: la home del
  cliente muestra el nombre del proyecto junto al módulo, porque un
  mismo usuario puede tener el mismo módulo en varios proyectos.
- **Opción de color personalizado en Imagen Corporativa**: además de
  la paleta predefinida, el cliente puede solicitar un color propio
  desde `campo-renderer.tsx`.
- **Barra de progreso en vivo del módulo**: `FormularioModulo` emite
  `onProgreso` en cada cambio y `mi-proyecto.modulo.$moduloId.tsx`
  pinta una barra fija en la parte inferior con el porcentaje de
  avance mientras se diligencia.
- **Previsualización inline de actas**: la previsualización PDF se
  abre en un `Dialog` con `iframe` embebido y botón *Descargar PDF*,
  reemplazando el `window.open` que quedaba bloqueado por popups y
  restricciones a blob URLs.

### Cambiado
- **Redirección tras enviar a revisión**: al enviar el módulo, el
  cliente vuelve al detalle del proyecto (`/mi-proyecto/proyectos/$id`)
  para continuar con los módulos restantes en lugar de aterrizar en
  la home.
- **Implementador con permisos de edición sobre módulos del cliente**:
  la home del invitado y las rutas de módulo reconocen al
  implementador como editor válido de los formularios del proyecto,
  además del propio cliente.

### Seguridad
- **`EXECUTE` revocado sobre todas las funciones `SECURITY DEFINER`
  de `public`**: `has_role`, `is_project_member`,
  `comparten_proyecto`, `destinatarios_notificacion`,
  `validar_invitacion` y `registrar_auditoria` dejan de ser
  invocables por `PUBLIC`, `anon` y `authenticated`. Se otorga
  `EXECUTE` únicamente a `service_role`. Las políticas RLS que las
  consumen siguen funcionando (RLS no exige `EXECUTE` sobre las
  funciones referenciadas).
  Cierra los hallazgos `SUPA_anon_security_definer_function_executable`
  y `SUPA_authenticated_security_definer_function_executable`.

### Archivos
- Nuevos: `src/routes/mi-proyecto.proyectos.index.tsx`,
  `src/routes/mi-proyecto.proyectos.$id.tsx`,
  `supabase/migrations/20260703190333_*.sql`.
- Editados: `src/components/app-sidebar.tsx`,
  `src/components/cliente-shell.tsx`, `src/hooks/use-mi-proyecto.tsx`,
  `src/routes/mi-proyecto.index.tsx`,
  `src/routes/mi-proyecto.modulo.$moduloId.tsx`,
  `src/components/form-engine/formulario-modulo.tsx`,
  `src/components/form-engine/campo-renderer.tsx`.

## [1.0.3] — 2026-07-03 — Endurecimiento de seguridad (3ª pasada)

Tercera ronda de hallazgos del escáner de seguridad.

### Seguridad
- **`bootstrap-admin` con autenticación obligatoria**: la Edge Function
  exige el header `x-bootstrap-secret` comparado en tiempo constante
  contra el secreto `BOOTSTRAP_SECRET`. El correo del admin ya no está
  hardcodeado y se lee desde `BOOTSTRAP_ADMIN_EMAIL`. Sin ambos
  secretos responde `503 not_configured`.
- **`enviar-correo` con secreto obligatorio**: `CORREO_WEBHOOK_SECRET`
  pasa de opcional a requerido. La validación del header
  `x-egixia-secret` usa comparación en tiempo constante. Sin secreto
  la Function responde `503 not_configured`.
- **Guardia server-side en `/app`**: nuevo `beforeLoad` en
  `src/routes/app.tsx` que invoca la server function
  `exigirEquipoInterno` (`src/lib/rbac.functions.ts`) usando
  `requireSupabaseAuth`. Los clientes son redirigidos a
  `/mi-proyecto` antes de renderizar el layout privado, además del
  control de UI existente en `PrivateShell`.
- **RLS de `invitaciones` para el invitado**: se reemplazó `inv_select`
  por dos políticas — `inv_select_admin` (rol `admin`) e
  `inv_select_invitado` (usuario autenticado cuyo `email` del JWT
  coincide con la invitación, `estado = 'pendiente'` y `expira_at > now()`).
  Se elimina así el acceso al rol `public` sobre la tabla.
- **RLS de `profiles` para pares del proyecto**: nueva función
  `SECURITY DEFINER` `comparten_proyecto(a,b)` y política
  `profiles_select_own_or_privileged` extendida para permitir que
  miembros con membresía activa en un mismo proyecto se vean entre sí.

### Documentación
- `docs/SEGURIDAD.md`: nuevas secciones "Bootstrap de administrador",
  actualización de "Envío de correo" y de la política de
  `invitaciones`; matriz RLS actualizada para `profiles`.
- `docs/ROLES_Y_PERMISOS.md`: doble capa cliente + server en `/app`.
- `docs/ARQUITECTURA.md`: mención de `rbac.functions.ts` y
  `comparten_proyecto`.

### Acciones manuales pendientes del usuario
- Configurar los secretos `BOOTSTRAP_SECRET`, `BOOTSTRAP_ADMIN_EMAIL`
  y `CORREO_WEBHOOK_SECRET` en el backend, o las funciones
  responderán `503`.

## [1.0.2] — 2026-07-02 — Endurecimiento de seguridad (2ª pasada)

Segunda ronda de hallazgos del escáner de seguridad, aplicada sobre
la v1.

### Seguridad
- **Validación de invitaciones movida al servidor**: se revocó
  `EXECUTE` sobre `public.validar_invitacion` para `anon` y
  `authenticated`. La validación del token se realiza ahora en la
  server function `validarInvitacion` (`src/lib/invitaciones.functions.ts`)
  usando el cliente admin. `src/routes/invitacion.$token.tsx` la
  consume vía `useServerFn`; el navegador ya no puede llamar a la
  RPC directamente.
- **Tokens de invitación ocultos al implementador**: la política
  `inv_select` en `public.invitaciones` se restringió a `admin`. Los
  implementadores siguen operando la cola de invitaciones a través
  de server functions (`crearInvitacion`, `reenviarInvitacion`,
  `revocarInvitacion`) sin recibir el token en el navegador.
- **Blindaje de campos privilegiados en `profiles`**: nuevo trigger
  `profiles_guard_privileged_fields_trg` que bloquea a nivel de base
  cualquier `UPDATE` de `rol`, `estado` o `email` realizado por un
  usuario no-admin sobre su propio perfil, incluso si burlara la
  política RLS del cliente.
- **`UPDATE` en Storage limitado al equipo interno**: las políticas
  de `storage.objects` para los buckets `logos-clientes`,
  `documentos` y `actas` ahora exigen rol `admin` o `implementador`
  para actualizar objetos. Los invitados siguen pudiendo subir y
  reemplazar archivos vía el flujo controlado del motor (que hace
  `INSERT` + `remove` del anterior), pero ya no pueden mutar
  objetos existentes construyendo un path ajeno.

### Documentación
- `docs/SEGURIDAD.md` actualizado: nueva sección "Validación de
  invitaciones" y ajuste de la matriz de RLS/Storage.
- `docs/ROLES_Y_PERMISOS.md`: aclaración de que el implementador
  gestiona invitaciones sin ver el token en claro.

## [1.0.1] — 2026-07-02 — SEO

### Añadido
- H1 semántico en `cliente-shell.tsx` y landmark `<main>` en la
  landing pública.
- Metadatos únicos por ruta pública (`/`, `/login`) con `og:*`,
  `twitter:card`, `og:url` y `canonical` autorreferenciados.
- JSON-LD `Organization` + `WebSite` en la ruta raíz.
- `public/robots.txt` (bloquea `/app/`, `/mi-proyecto/`,
  `/invitacion/`, `/reset-password`), `public/llms.txt` y
  `src/routes/sitemap[.]xml.ts` (mapa dinámico).

### Ajustado
- Contraste del footer subido a 90 % de opacidad.
- Eliminación de metatags duplicados en `src/routes/__root.tsx`.

## [1.0.0] — 2026-07-02 — Cierre v1

EGIXIA Configurator v1 está listo para uso interno y con clientes.
Este cierre no añade nuevas capacidades; consolida acabado, accesibilidad,
manejo de errores y seguridad sobre el trabajo previo.

### Ajustado
- **Viewport móvil**: pantallas de altura completa migradas de
  `min-h-screen` a `min-h-dvh` en `login`, `reset-password`,
  `invitacion.$token`, landing pública, `__root`, `private-shell` y
  `cliente-shell` para evitar cortes con la barra de navegación móvil.
- **Sidebar colapsable**: verificado en móvil (variante offcanvas) y en
  escritorio (variante `icon`) — el disparador queda siempre visible
  en la topbar.
- **Accesibilidad**: todos los inputs tienen `<Label>` asociada;
  botones ícono llevan `aria-label`; foco visible respetado por los
  primitivos shadcn; contraste sobre tokens del sistema
  (`text-foreground`, `text-muted-foreground`) — no se usan colores
  arbitrarios.
- **Estados vacíos** presentes en todas las listas (proyectos,
  invitaciones, usuarios, auditoría, revisiones, módulos del invitado)
  con mensajes amables en español neutro LATAM.
- **Skeletons** de carga en dashboards, detalles de proyecto,
  configuración, catálogo y módulos.
- **Toasts** de éxito/error (`sonner`) en toda mutación; los mensajes
  se muestran en español y evitan tecnicismos.

### Seguridad revisada
- **RLS activa** en las 11 tablas del esquema `public`
  (`profiles`, `proyectos`, `proyecto_miembros`, `proyecto_modulos`,
  `invitaciones`, `observaciones`, `actas`, `archivos`, `auditoria`,
  `catalogo_overrides`, `configuracion_sistema`).
- **Acceso cruzado bloqueado**: los invitados solo ven sus proyectos
  vía `is_project_member`; las tablas hijas (módulos, observaciones,
  actas, archivos) heredan la restricción por FK al proyecto.
- **Bloqueo por estado**: `puede_editar_modulo` impide que el
  invitado edite un módulo en `en_revision` o `aprobado`.
- **Sin secretos en el frontend**: `SUPABASE_SERVICE_ROLE_KEY` y las
  llaves de correo viven solo en el runtime del servidor
  (`client.server.ts`, secretos de la Edge Function `enviar-correo`).
  Las server functions administrativas verifican el rol del llamante
  antes de instanciarlas.
- **Validación de archivos** en `campo-archivo.tsx`: formato contra
  `formatosPermitidos` y tamaño contra `tamanoMaxBytes(config)` antes
  de subir. Nombre saneado (slug) al construir el path
  `{proyecto_id}/{modulo_id}/{campo_key}/...`.
- **Buckets privados** (`avatares`, `logos-clientes`, `documentos`,
  `actas`) con políticas ancladas al primer segmento del path
  (proyecto).

### Rendimiento
- Consultas con selects columnares (no `*`) y filtros con índice
  natural por FK.
- `refreshModulos` y `refreshOverrides` disparados solo al cambiar
  de proyecto activo, no en cada render.
- Autoguardado con debounce configurable (parámetro global).
- Auditoría global limitada a 1.000 registros por vista con
  exportación CSV completa.

### Documentación
- `README.md` refleja el estado final del stack, rutas y roles.
- `/docs`:
  - `ARQUITECTURA.md`, `MODELO_DE_DATOS.md`, `MODULOS.md`,
    `FLUJO_Y_ESTADOS.md`, `ROLES_Y_PERMISOS.md`, `SEGURIDAD.md`,
    `GUIA_UX.md`, `DECISIONES.md`, `CHANGELOG.md` completos y en
    español.

### Estado
**v1 completa.** La aplicación queda lista para invitar al primer
cliente real y ejecutar el proceso completo:
Invitación → Diligenciamiento → Acta → Revisión → Aprobación → Cierre.

## [0.13.0] — 2026-07-02

### Añadido
- **Panel del Implementador / Administrador** (`/app`) con estilo
  calmado y tarjetas:
  - **Dashboard analítico** (`src/routes/app.index.tsx`) con 4 métricas
    clave (proyectos activos, pendientes de revisión, próximos a
    vencer, módulos aprobados), gráfica de barras `recharts` por
    estado de módulos, y listas cortas de revisiones pendientes y
    próximos vencimientos.
  - **Proyectos**:
    - `src/routes/app.proyectos.index.tsx`: listado con búsqueda por
      nombre/empresa y filtro por estado.
    - `src/routes/app.proyectos.nuevo.tsx`: alta de proyecto con
      selección de módulos (imagen, sociedades, seguridad), fecha
      límite por módulo y comportamiento al vencer.
    - `src/routes/app.proyectos.$id.tsx`: detalle con miembros
      (equipo interno + invitados), módulos con estado y avance,
      accesos a revisión/edición y a actas descargables, exportación
      (JSON y CSV) y bloque de auditoría del proyecto.
  - **Revisiones pendientes** (`src/routes/app.revisiones.tsx`): cola
    de módulos `en_revision` ordenada por antigüedad.
  - **Invitaciones** (`src/routes/app.invitaciones.index.tsx`):
    envío (email + rol + proyecto), **reenvío**, **revocación** y
    estado (pendiente / aceptada / revocada / expirada).
  - **Edición de respuestas por el implementador**: en la vista de
    revisión del módulo, botón "Editar respuestas" que activa el
    formulario en modo edición y guarda vía server function
    `editarDatosModulo`, dejando traza en `auditoria`.
  - **Gestión de invitados**: en el detalle del proyecto, se puede
    **inhabilitar** / reactivar y **desvincular** un invitado sin
    eliminar su cuenta.
- **Server functions** (`src/lib/admin.functions.ts`):
  `crearProyecto`, `editarDatosModulo`, `crearInvitacion`,
  `reenviarInvitacion`, `revocarInvitacion`, `actualizarMiembroEstado`,
  `desvincularMiembro`. Todas requieren rol interno y registran la
  acción en `auditoria` con detalle relevante.
- **Motor de formularios**: `useFormModulo` y `FormularioModulo` ahora
  aceptan `onCambio` para desactivar el autoguardado y delegar la
  persistencia al padre (necesario para el modo edición del
  implementador con auditoría). Además `useFormModulo` usa
  `useMiProyectoOptional`, lo que permite renderizar el formulario
  fuera del portal del invitado.

### Cambiado
- `src/routes/app.$section.tsx` deja de servir `proyectos`,
  `revisiones` e `invitaciones` (ahora rutas dedicadas) y solo se
  usa como stub para `usuarios`, `catalogo`, `auditoria` y
  `configuracion`.
- `src/routes/app.tsx` reconoce nuevos títulos de topbar para
  `Nuevo proyecto` y `Detalle del proyecto`.

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
## Panel del Administrador

- Ruta `/app/usuarios`: listado con filtros por rol y búsqueda; el admin
  puede cambiar rol, habilitar/inhabilitar y eliminar cuentas (los
  implementadores solo consultan).
- Ruta `/app/catalogo`: catálogo maestro de módulos con overrides por
  proyecto — activar/desactivar campos y editar etiqueta, requerido y guía.
- Ruta `/app/auditoria`: histórico global (últimos 1.000 eventos) con
  búsqueda, filtro por entidad y exportación CSV.
- Ruta `/app/configuracion`: branding, parámetros de correo (proveedor y
  remitente, sin llaves en el frontend) y parámetros generales.
- Detalle de proyecto: acción "Eliminar" visible solo para admin.
- Motor de formularios: `aplicarOverrides` inyecta la personalización
  administrativa tanto en la vista del invitado como en la de revisión,
  respetando el cálculo de progreso.
