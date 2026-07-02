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
  `anon` salvo cuando el flujo lo requiere (por ejemplo,
  `validar_invitacion`).
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
  - `CORREO_WEBHOOK_SECRET` *(opcional)* — segundo secreto exigido en
    el header `x-egixia-secret` para endurecer la invocación.
- Autorización de la invocación: el servidor de la app llama con
  `Authorization: Bearer <SERVICE_ROLE_KEY>` (nunca expuesto al
  navegador). Con `CORREO_WEBHOOK_SECRET` se refuerza con un segundo
  factor por header.
- Trazabilidad: cada envío (o error) se registra en `public.auditoria`
  con los destinatarios, asuntos y el status devuelto por la Function.
  Los cuerpos HTML no se persisten para no duplicar información de
  clientes.
- Renderizado seguro: las plantillas escapan el HTML de todos los
  valores dinámicos (`escaparHtml`) para evitar HTML injection.

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
- **Sin acceso directo desde el navegador**: `anon` no tiene privilegios
  sobre la tabla `invitaciones`; solo puede llamar a la RPC
  `validar_invitacion(token)` (lectura acotada) y a la server function
  `aceptarInvitacion` (proceso completo).

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
| `invitaciones`      | Admin / implementador            | Admin / implementador                                  | Solo admin            |
| `observaciones`     | Internos / miembros              | Admin / implementador                                  | Solo admin            |
| `actas`             | Internos / miembros              | Admin / implementador                                  | Solo admin            |
| `archivos`          | Internos / miembros              | Internos siempre; invitado si puede editar el módulo   | Admin / implementador |
| `auditoria`         | Admin / implementador            | Vía helper `registrar_auditoria`                       | —                     |

## Auditoría

Toda operación sensible (aceptación de invitaciones, cambios de rol,
envíos a revisión, aprobaciones) queda registrada en la tabla
`auditoria`. Los usuarios `cliente` nunca ven este registro.