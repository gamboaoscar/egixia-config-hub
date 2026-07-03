# Seguridad

Documento de referencia sobre los principios de seguridad aplicados en
EGIXIA Configurator. Complementa `ROLES_Y_PERMISOS.md` y
`MODELO_DE_DATOS.md`.

## Principios

- **Mínimo privilegio**: cada rol accede únicamente a lo que necesita.
- **RLS obligatorio**: todas las tablas del esquema `public` tienen Row
  Level Security activo.
- **`SECURITY DEFINER` acotado**: las funciones sensibles son
  `SECURITY DEFINER` con `search_path = public` y `EXECUTE` revocado a
  `PUBLIC`, `anon` y `authenticated`. Solo `service_role` conserva
  `EXECUTE`; las políticas RLS pueden invocarlas sin necesidad de
  otorgar el privilegio al usuario final (`has_role`,
  `is_project_member`, `comparten_proyecto`,
  `destinatarios_notificacion`, `validar_invitacion`,
  `registrar_auditoria`). Los flujos que antes llamaban a RPCs desde
  el cliente (p. ej. `validar_invitacion`) pasan por server functions.
- **Sin secretos en el cliente ni en la documentación**.

## Envío de correo

- Toda la salida de correos pasa por la Edge Function
  `supabase/functions/enviar-correo`. El frontend **nunca** habla con el
  proveedor de correo ni conoce sus llaves.
- Secretos requeridos en el proyecto Supabase (variables de la Function):
  - `RESEND_API_KEY` — token del proveedor. Si falta, la Function opera
    en modo **dry-run** (registra en logs y responde OK) para no bloquear
    el flujo en desarrollo.
  - `CORREO_FROM` — remitente autorizado, ej.
    `EGIXIA <no-reply@egixia.com>`.
  - `CORREO_WEBHOOK_SECRET` **obligatorio** — secreto exigido en el
    header `x-egixia-secret`. Si no está configurado, la Function
    responde `503 not_configured` y no envía ningún correo.
- Autorización de la invocación: el servidor de la app llama con
  `Authorization: Bearer <SERVICE_ROLE_KEY>` (nunca expuesto al
  navegador) **y** con `x-egixia-secret: <CORREO_WEBHOOK_SECRET>`.
  La comparación del header se hace en tiempo constante para evitar
  ataques por temporización.
- Trazabilidad: cada envío (o error) se registra en `public.auditoria`
  con los destinatarios, asuntos y el status devuelto por la Function.
  Los cuerpos HTML no se persisten para no duplicar información de
  clientes.
- Renderizado seguro: las plantillas escapan el HTML de todos los
  valores dinámicos (`escaparHtml`) para evitar HTML injection.

## Bootstrap de administrador

- La Edge Function `supabase/functions/bootstrap-admin` sirve para
  crear la cuenta inicial de administrador en un entorno nuevo.
- Requiere **dos secretos**:
  - `BOOTSTRAP_SECRET` — comparado en tiempo constante contra el
    header `x-bootstrap-secret` de la petición.
  - `BOOTSTRAP_ADMIN_EMAIL` — correo del admin a crear. El código
    fuente ya no contiene ningún correo real.
- Sin ambos secretos configurados, la Function responde
  `503 not_configured`. Con secreto pero sin header válido responde
  `401 unauthorized`. Esto evita que un caller anónimo pueda
  confirmar o recrear la cuenta de admin.
- La contraseña generada nunca se persiste ni se devuelve: el admin
  usa "¿Olvidaste tu contraseña?" desde `/login`.

## Actas (PDF)

- Bucket `actas` privado. Los PDF se sirven exclusivamente por URL
  firmada emitida por `urlFirmadaActa` (7 días). Nunca se generan URLs
  públicas.
- La generación del PDF se hace server-side (`renderYSubirActa`) usando
  `pdf-lib`, para evitar que un invitado pueda inyectar un acta que no
  corresponda a los datos realmente guardados.
- La previsualización (`previsualizarActa`) valida rol o membresía en
  el proyecto antes de renderizar. El PDF se devuelve en base64 al
  cliente y no se persiste.

## Archivos y Storage

- **Todos los buckets son privados**: `logos-clientes`, `documentos`,
  `actas` y `avatares`. No hay URLs públicas.
- **Previsualización con URLs firmadas**: la miniatura del campo
  `archivo` se muestra con `createSignedUrl(bucket, path, 3600)`. La URL
  vive máximo 1 hora y no es indexable.
- **Path predecible por proyecto**: los archivos se guardan en
  `{proyecto_id}/{modulo_id}/{campo_key}/{timestamp}-{slug}`. Las
  políticas RLS de `storage.objects` usan el primer segmento (el
  `proyecto_id`) para decidir si el usuario es miembro del proyecto.
- **Validación en cliente y en servidor**:
  - Cliente (`src/lib/form-engine/archivo.ts`): `formatoPermitido()` y
    `tamanoMaxBytes()` rechazan tipos y tamaños fuera de la
    configuración del campo antes de tocar la red.
  - Servidor: RLS en `storage.objects` y en `public.archivos` impide
    subir a rutas de proyectos ajenos, y `puede_editar_modulo()`
    bloquea escrituras cuando el módulo está `en_revision` o
    `aprobado`.
- **Auto-ajuste de imagen**: cuando el campo declara
  `dimensiones: { ancho, alto }`, el motor redimensiona en el
  navegador con recorte centrado (canvas `cover`) y sube **solo la
  imagen ya ajustada**. La original nunca llega a Storage. SVG y PDF
  no se re-encodean.
- **Reemplazo limpio**: al reemplazar un archivo, el binario anterior
  se elimina de Storage (`remove([path])`) tras insertar el nuevo
  registro; la fila anterior en `public.archivos` queda como histórico
  auditable.

## Tokens de invitación

- `invitaciones.token`: cadena única con índice; asignada por quien
  crea la invitación.
- `expira_at`: obligatorio; el flujo lo compara con `now()` en cada
  validación.
- **Un solo uso**: la aceptación se realiza con un `UPDATE ... WHERE
  token = $1 AND estado = 'pendiente' AND expira_at > now() RETURNING
  ...`. Este reclamo atómico impide que dos solicitudes simultáneas
  utilicen el mismo token.
- **Sin acceso directo desde el navegador**: ni `anon` ni
  `authenticated` tienen `EXECUTE` sobre `validar_invitacion`; la RPC
  se llama únicamente desde el servidor. El flujo `/invitacion/:token`
  invoca la server function `validarInvitacion`
  (`src/lib/invitaciones.functions.ts`), que usa el cliente admin y
  devuelve al navegador solo los datos mínimos (email, rol, proyecto,
  expiración). La aceptación pasa por `aceptarInvitacion`.
- **Token invisible para implementadores**: la lectura directa de
  `invitaciones` se controla con dos políticas RLS
  (`inv_select_admin` e `inv_select_invitado`). Los implementadores
  gestionan la cola (crear / reenviar / revocar) exclusivamente a
  través de server functions que no exponen el token en claro.
- **Lectura del invitado**: `inv_select_invitado` permite a un usuario
  autenticado ver únicamente su propia invitación cuando el `email`
  del JWT coincide, la invitación está `pendiente` y no ha expirado.
  Ya no existe ninguna política sobre el rol `public`.

## Buckets privados

Todos los buckets del proyecto son **privados**; el frontend obtiene
URLs firmadas con TTL corto.

| Bucket           | Estructura del path    | Acceso                                       |
| ---------------- | ---------------------- | -------------------------------------------- |
| `avatares`       | `{user_id}/…`          | Solo el propio usuario                       |
| `logos-clientes` | `{proyecto_id}/…`      | Admin, implementador y miembros del proyecto |
| `documentos`     | `{proyecto_id}/…`      | Ídem                                         |
| `actas`          | `{proyecto_id}/…`      | Ídem; borrado solo admin/implementador       |

El helper `storage_proyecto_from_path(name)` extrae el `proyecto_id`
del primer segmento del path y se usa en las políticas de
`storage.objects` para verificar membresía.

## Matriz resumida de RLS

| Tabla               | Lectura                          | Escritura                                              | Borrado               |
| ------------------- | -------------------------------- | ------------------------------------------------------ | --------------------- |
| `proyectos`         | Internos / miembros del proyecto | Admin / implementador                                  | Solo admin            |
| `proyecto_miembros` | Internos / propias membresías    | Admin / implementador                                  | Admin / implementador |
| `proyecto_modulos`  | Internos / miembros              | Internos siempre; invitado solo en estados editables   | Admin / implementador |
| `invitaciones`      | Admin / invitado (su fila)       | Admin / implementador                                  | Solo admin            |
| `observaciones`     | Internos / miembros              | Admin / implementador                                  | Solo admin            |
| `actas`             | Internos / miembros              | Admin / implementador                                  | Solo admin            |
| `archivos`          | Internos / miembros              | Internos siempre; invitado si puede editar el módulo   | Admin / implementador |
| `auditoria`         | Admin / implementador            | Vía helper `registrar_auditoria`                       | —                     |
| `profiles`          | Uno mismo / internos / pares de proyecto | Uno mismo (campos no privilegiados) / admin    | Solo admin            |

## Blindaje de `profiles`

Además de la política RLS que sólo permite a un usuario actualizar su
propio perfil, el trigger `profiles_guard_privileged_fields_trg`
bloquea a nivel de base cualquier intento de un usuario no-admin de
modificar `rol`, `estado` o `email` en su propia fila. Esto ofrece
defensa en profundidad frente a un cliente comprometido que intente
escalar privilegios saltándose el `WITH CHECK` del cliente.

La política `profiles_select_own_or_privileged` fue extendida para
permitir que miembros con membresía activa en el mismo proyecto se
vean entre sí, mediante la función `SECURITY DEFINER`
`comparten_proyecto(a, b)` (revocada para `PUBLIC`, `EXECUTE` para
`authenticated`). Esto habilita la colaboración entre invitados de
un mismo proyecto sin exponer al resto de la organización.

## Doble capa de autorización en `/app`

El layout privado del equipo interno (`src/routes/app.tsx`) combina:

1. **`beforeLoad` server-side**: invoca la server function
   `exigirEquipoInterno` (`src/lib/rbac.functions.ts`) protegida por
   `requireSupabaseAuth`. Verifica el rol del llamante contra
   `profiles` y lanza `redirect` a `/mi-proyecto` si no es
   `admin`/`implementador`, o a `/login` si no hay sesión.
2. **`PrivateShell` client-side**: mantiene la lógica de UX (loader,
   redirección por rol, mensajes) sobre la comprobación server-side.

Todas las mutaciones sensibles siguen pasando por server functions
con `requireSupabaseAuth` + `exigirInterno`/`exigirAdmin`, y las
lecturas están cubiertas por RLS.

## Escrituras en Storage

Los buckets `logos-clientes`, `documentos` y `actas` permiten
`INSERT` a miembros del proyecto (para que el invitado suba
archivos de su módulo), pero `UPDATE` está restringido a `admin` e
`implementador`. El flujo de reemplazo del motor de formularios hace
`INSERT` del nuevo binario y luego `remove()` del anterior, por lo
que el invitado no necesita permiso de `UPDATE`. Esto evita que un
cliente construya un path ajeno para sobrescribir un objeto de otro
proyecto.

## Auditoría

Toda operación sensible (aceptación de invitaciones, cambios de rol,
envíos a revisión, aprobaciones) queda registrada en la tabla
`auditoria`. Los usuarios `cliente` nunca ven este registro.
## Superficies añadidas por el panel de Administrador

- **`catalogo_overrides`**: RLS permite lectura a miembros del proyecto
  (los invitados sí necesitan leer para renderizar su formulario) y
  escritura solo a `admin`. La escritura pasa por
  `guardarOverrideCampo`, que audita cada cambio.
- **`configuracion_sistema`**: lectura para todo usuario autenticado
  (necesaria para branding); escritura reservada a `admin` vía
  `guardarConfiguracion`. Las llaves de API de correo se almacenan como
  secretos de la Edge Function `enviar-correo` y nunca viajan al
  frontend.
- **Eliminación de usuarios**: `eliminarUsuario` usa el cliente admin de
  Supabase Auth (`auth.admin.deleteUser`), lo que dispara el borrado en
  cascada de `profiles` a través del FK a `auth.users`. El endpoint
  exige rol `admin` y registra la acción en `auditoria`.
- **Eliminación de proyectos**: `eliminarProyecto` está protegida por el
  mismo control y borra en cascada módulos, observaciones, actas y
  miembros.
