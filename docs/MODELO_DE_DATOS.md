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

## Storage

- Bucket **`avatares`** (privado). Estructura: `{user_id}/archivo.ext`.
  Cada usuario solo puede leer/subir/actualizar/borrar archivos bajo su
  propia carpeta `auth.uid()`. El frontend accede vía URLs firmadas
  (TTL 1 h). Tipos permitidos: PNG, JPG, WEBP (≤ 2 MB).

## Entidades previstas (próximos pasos)

- Clientes / Proyectos
- Módulos y campos del catálogo
- Respuestas por proyecto
- Invitaciones y fechas límite
- Archivos adjuntos (logos, imágenes)