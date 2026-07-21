# Modelo de datos

Fuente autoritativa: migraciones de Supabase. Este documento resume las
entidades ya creadas y las políticas RLS aplicadas.

## Enums

- `app_role`: `admin` | `implementador` | `cliente`.
- `user_estado`: `activo` | `inhabilitado`.

## Tabla `profiles`

Perfil extendido de cada usuario, vinculado 1:1 a `auth.users` por `id`.

| Columna       | Tipo          | Notas                                       |
| ------------- | ------------- | ------------------------------------------- |
| `id`          | `uuid`        | PK; FK → `auth.users.id` (on delete cascade). |
| `nombre`      | `text`        | Simple, sin segundos nombres.               |
| `apellido`    | `text`        | Simple, sin segundos apellidos.             |
| `email`       | `text`        | No editable por el usuario.                 |
| `foto_perfil` | `text` null   | Ruta dentro del bucket `avatares`.          |
| `cargo`       | `text` null   | Cargo en su empresa.                        |
| `empresa`     | `text` null   | Empresa donde trabaja.                      |
| `rol`         | `app_role`    | Por defecto `cliente`.                      |
| `estado`      | `user_estado` | Por defecto `activo`.                       |
| `created_at`  | `timestamptz` | `now()`.                                    |

### Automatismos

- Trigger `on_auth_user_created` (AFTER INSERT ON `auth.users`) ejecuta
  `handle_new_user()` que crea la fila en `profiles`.
- Trigger `profiles_guard_before_update` bloquea cambios a `email`,
  `rol` y `estado` para cualquiera que no sea `admin`.

### RLS en `profiles`

- SELECT: cada usuario ve su propia fila; `admin` e `implementador` ven
  todas.
- UPDATE: cada usuario actualiza su propia fila (los campos protegidos
  los bloquea el trigger). Solo `admin` puede editar filas ajenas
  (incluyendo `rol` y `estado`).
- INSERT: solo el trigger interno; no hay política pública.
- DELETE: solo `admin`.

## Tabla `auditoria`

Registro de acciones que se usa en toda la app. **Nunca** se muestra a
usuarios `cliente`.

| Columna      | Tipo          | Notas                                    |
| ------------ | ------------- | ---------------------------------------- |
| `id`         | `uuid`        | PK, `gen_random_uuid()`.                 |
| `actor_id`   | `uuid`        | Usuario que ejecutó la acción.           |
| `accion`     | `text`        | Verbo, p. ej. `perfil.actualizado`.      |
| `entidad`    | `text`        | Entidad afectada.                        |
| `entidad_id` | `text` null   | Id (uuid o texto).                       |
| `detalle`    | `jsonb` null  | Payload libre.                           |
| `created_at` | `timestamptz` | `now()`.                                 |

### RLS en `auditoria`

- SELECT: solo `admin` e `implementador`.
- INSERT: cualquier autenticado, a través del helper `registrar_auditoria`.
- UPDATE / DELETE: no permitidos (registro inmutable).

## Funciones

- `has_role(_rol app_role) → boolean` — `SECURITY DEFINER`,
  `search_path = public`. Verifica rol + `estado = 'activo'`.
- `handle_new_user() → trigger` — crea la fila en `profiles`.
- `registrar_auditoria(accion, entidad, entidad_id, detalle)` —
  inserta usando `auth.uid()` como `actor_id`. `SECURITY DEFINER`;
  acceso revocado a `anon`.

### Triggers de auditoría automática (M11)

Cubren las acciones que no pasan por `registrar_auditoria` desde
código de aplicación. Todos son `SECURITY DEFINER` con
`search_path = public`.

- **`proyecto_modulos_auditar_datos`** — `AFTER UPDATE ON
  proyecto_modulos` cuando `OLD.datos IS DISTINCT FROM NEW.datos`.
  Ejecuta `auditar_datos_modulo()`, que calcula el arreglo de claves
  cuyo valor cambió (unión de `jsonb_object_keys` de `OLD.datos` y
  `NEW.datos`) e inserta en `auditoria` con acción
  `modulo_datos_actualizados` y detalle
  `{ proyecto_id, modulo_key, campos_modificados, progreso }`. Solo
  inserta cuando `auth.uid()` no es nulo — las ediciones internas
  ya se auditan como `modulo_editado_admin` desde
  `admin.functions.ts`.
- **`archivos_auditar_subida`** — `AFTER INSERT ON archivos`.
  Ejecuta `auditar_archivo_subido()`, que inserta la acción
  `archivo_subido` (`actor_id = COALESCE(auth.uid(), NEW.created_by)`,
  detalle con `nombre_original`, `campo_key`, `proyecto_modulo_id`,
  `tamano`).
- **`actas_auditar_generacion`** — `AFTER INSERT ON actas`. Ejecuta
  `auditar_acta_generada()`, que inserta la acción `acta_generada`
  (`actor_id = COALESCE(auth.uid(), NEW.generada_por)`, detalle con
  `proyecto_modulo_id`, `version`, `archivo_url`).

## Storage

- Bucket **`avatares`** (privado). Estructura: `{user_id}/archivo.ext`.
  Cada usuario solo puede leer/subir/actualizar/borrar archivos bajo su
  propia carpeta `auth.uid()`. El frontend accede vía URLs firmadas
  (TTL 1 h). Tipos permitidos: PNG, JPG, WEBP (≤ 2 MB).
- Buckets **`logos-clientes`**, **`documentos`** y **`actas`** (privados).
  Estructura: `{proyecto_id}/…`. Los usuarios internos (admin,
  implementador) tienen acceso total; los invitados solo si son miembros
  activos del proyecto. Borrado restringido a usuarios internos.
- Bucket **`ayudas`** (privado) — imágenes de la "Ayuda enriquecida por
  campo". Estructura:
  `{proyecto_id}/{modulo_key}/{campo_key}/{timestamp}-{archivo}`.
  INSERT/UPDATE/DELETE solo usuarios internos (admin/implementador);
  SELECT internos o miembros activos del proyecto (el `proyecto_id` es el
  primer segmento del path, `storage_proyecto_from_path`). El frontend
  accede vía URLs firmadas al abrir el popup de ayuda. Migración:
  `20260721200000_bucket_ayudas.sql`.

### Estructura de `catalogo_overrides.guia` (jsonb)

Guía enriquecida por campo, retrocompatible (todas las claves nuevas son
opcionales). Se persiste como objeto completo desde el editor del
Catálogo:

```jsonc
{
  "titulo": "Banner del carrusel",        // título del popup (opcional; default: label)
  "que": "Imagen principal del home…",     // párrafo principal
  "formato": "PNG o JPG",                  // etiqueta "Formato"
  "tamano": "1920x480 px, máx 2 MB",       // etiqueta "Recomendación"
  "imagenes": [                             // hasta 3, bucket privado `ayudas`
    {
      "bucket": "ayudas",
      "storagePath": "{proyecto}/{modulo}/{campo}/1721594400000-ejemplo.png",
      "nombre": "ejemplo.png",             // opcional
      "caption": "Así se verá en el home"  // opcional
    }
  ]
}
```

Para columnas de tabla, la fila de override usa la convención
`campo_key = "{campoKey}.{columnaKey}"` y solo transporta `guia`
(la fusión la aplica `aplicarGuiaColumnas` en
`src/lib/form-engine/overrides.ts`).

## Tablas de negocio (Parte 3)

### `proyectos`
- `id`, `nombre`, `empresa`, `estado` (enum `proyecto_estado`:
  `nuevo` | `en_proceso` | `en_revision` | `completado` | `cerrado`),
  `created_by → profiles`, `created_at`, `updated_at`.
- RLS: admin/implementador ven y editan todos; el invitado ve solo los
  proyectos donde es miembro activo (`is_project_member`). Borrar: solo
  admin.

### `proyecto_miembros`
- `id`, `proyecto_id`, `profile_id`, `rol_en_proyecto`
  (`implementador` | `invitado`), `estado` (`activo` | `inhabilitado`),
  `created_at`. Único por `(proyecto, profile, rol)`.
- RLS: admin/implementador gestionan; cada usuario ve sus propias
  membresías. Inhabilitar (no borrar) es la vía recomendada para
  desvincular sin perder trazabilidad.

### `proyecto_modulos`
- `id`, `proyecto_id`, `modulo_key` (`imagen` | `sociedades` | `seguridad`),
  `estado` (enum `modulo_estado`), `fecha_limite`,
  `comportamiento_vencimiento` (enum), `datos` (jsonb), `progreso`
  (0–100), `enviado_at/por`, `revisado_at/por`, `updated_por` (uuid del
  último autor de cambios en `datos`/`progreso`/`estado`, sincronizado
  por el trigger `proyecto_modulos_before_update`), timestamps.
- RLS: admin/implementador acceso total. El invitado puede leer los
  módulos de sus proyectos y **solo puede actualizar** cuando el módulo
  está en `sin_iniciar`, `en_diligenciamiento` o `con_observaciones`.
- Trigger `autocompletar_proyecto`: al pasar un módulo a `aprobado`, si
  todos los módulos del proyecto están aprobados, el proyecto pasa a
  `completado` (salvo si estaba `cerrado`).

### `invitaciones`
- `id`, `email`, `rol_invitado`, `proyecto_id` (obligatorio si el rol es
  `invitado`), `token` único, `expira_at`, `estado`
  (`pendiente` | `aceptada` | `revocada` | `expirada`), `invited_by`,
  timestamps.
- RLS: gestión reservada a admin/implementador; borrar solo admin. La
  validación y aceptación pública se hace mediante funciones
  `SECURITY DEFINER` (`validar_invitacion` y la server function
  `aceptarInvitacion`). Reclamo atómico del token para garantizar
  un solo uso.

### `observaciones`
- `id`, `proyecto_modulo_id`, `campo_key`, `comentario`, `estado`
  (`abierta` | `resuelta`), `created_by`, `created_at`, `resuelta_at`.
- RLS: admin/implementador crean/resuelven; el invitado puede leer las de
  los módulos de sus proyectos.

### `actas`
- `id`, `proyecto_modulo_id`, `archivo_url`, `version`, `generada_at/por`.
- RLS: crear/actualizar reservado a admin/implementador; los miembros del
  proyecto pueden leerlas.

### `archivos`
- Metadatos de archivos en Storage: `proyecto_modulo_id`, `campo_key`,
  `nombre_original`, `storage_path`, `tipo`, `tamano`, `dimensiones`.
- RLS: los miembros del proyecto pueden leer; para insertar, un invitado
  debe cumplir `puede_editar_modulo` (regla de bloqueo por estado).

### Funciones auxiliares
- `is_project_member(uid, proyecto_id)`.
- `puede_editar_modulo(uid, modulo_id)`.
- `destinatarios_notificacion(proyecto_id)` — devuelve los correos de
  admins + implementadores + invitados activos del proyecto.
- `validar_invitacion(token)` — pública (anon) para el flujo de registro.
- `storage_proyecto_from_path(name)` — helper para políticas de Storage.
- Archivos adjuntos (logos, imágenes)