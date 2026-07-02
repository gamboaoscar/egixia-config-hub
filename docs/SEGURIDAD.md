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