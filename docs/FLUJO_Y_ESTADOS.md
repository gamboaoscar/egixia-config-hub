# Flujo y estados

## Estados de un proyecto (`proyecto_estado`)

`nuevo` → `en_proceso` → `en_revision` → `completado` → `cerrado`.

- El paso a `completado` es automático: cuando todos los
  `proyecto_modulos` del proyecto quedan en `aprobado`, el trigger
  `autocompletar_proyecto` actualiza el proyecto (salvo si estaba
  `cerrado`).
- `cerrado` es un estado terminal manual (admin) para archivar.

## Estados de un módulo (`modulo_estado`)

`sin_iniciar` → `en_diligenciamiento` → `en_revision` →
`con_observaciones` (opcional) → `aprobado`.

### Regla de bloqueo por estado (invitado)

Un usuario con rol `cliente`/`invitado` **solo puede editar** un módulo
cuando su estado es:

- `sin_iniciar`
- `en_diligenciamiento`
- `con_observaciones`

En los estados `en_revision` y `aprobado` el módulo queda en **solo
lectura** para el invitado. Esta regla se aplica tanto en el frontend
como en RLS (`policy pmod_update` y helper `puede_editar_modulo`).

Los usuarios internos (admin, implementador) no están sujetos a esta
restricción.

## Comportamiento ante fecha de vencimiento

El campo `comportamiento_vencimiento` en cada módulo controla qué pasa
cuando `fecha_limite` es superada:

- `bloquear`: el invitado no puede seguir editando.
- `editable_avisar`: sigue editable, se muestra un aviso.
- `solo_avisar`: solo aviso, sin bloqueo.
- `extension_implementador`: el implementador puede otorgar prórroga.

## Flujo de invitación

1. Un admin/implementador crea la invitación (email + rol + proyecto).
2. Se emite `token` único con `expira_at`.
3. El usuario abre `/invitacion/:token`; se valida vía RPC
   `validar_invitacion`.
4. Al enviar el formulario, `aceptarInvitacion` reclama el token de
   forma atómica, crea el usuario en Auth, upserta su perfil con el rol
   correcto y lo vincula al proyecto.
5. La invitación queda `aceptada`; el token no puede reutilizarse.
6. Se registra en `auditoria` la acción `invitacion.aceptada`.

## Destinatarios de notificaciones/actas

La función `destinatarios_notificacion(proyecto_id)` devuelve los correos
de todos los admin + todos los implementadores + los invitados activos
del proyecto. Es la fuente única para notificaciones automáticas y para
adjuntar destinatarios de las actas.