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

## Transiciones (Parte 12)

Todas las transiciones se ejecutan desde server functions en
`src/lib/revision.functions.ts` usando `supabaseAdmin`, previa
autorización por rol y membresía en el proyecto. Cada una registra
una entrada en `auditoria` y encola una notificación por correo a los
destinatarios devueltos por `destinatarios_notificacion(_proyecto_id)`.

| Acción | Actor | Estado origen | Estado destino | Efectos |
| --- | --- | --- | --- | --- |
| `enviarModuloARevision` | invitado (o interno) | `sin_iniciar` · `en_diligenciamiento` · `con_observaciones` | `en_revision` | Setea `enviado_at`/`enviado_por`, genera acta `v = max+1`, notifica. |
| `aprobarModulo` | admin · implementador | `en_revision` | `aprobado` | Setea `revisado_at`/`revisado_por`. Si todos los módulos quedan aprobados, el trigger `trg_autocompletar_proyecto` marca el proyecto como `completado`. |
| `devolverModuloConObservaciones` | admin · implementador | `en_revision` | `con_observaciones` | Inserta N filas en `observaciones` (por campo) con `estado='abierta'`, rehabilita al invitado, notifica. |
| `reabrirModulo` | admin · implementador | `aprobado` | `con_observaciones` | Permite volver a editar un módulo ya aprobado. |
| `reenviarModulo` | invitado (o interno) | `con_observaciones` | `en_revision` | Marca todas las observaciones abiertas como `resuelta`, setea `enviado_at`, genera acta `v+1`, notifica. |

## Acta por módulo (PDF)

Cada vez que un módulo se envía o reenvía a revisión, `renderYSubirActa`
(`src/lib/acta/acta.server.ts`) genera un PDF con `pdf-lib` y lo
persiste en el bucket privado `actas` en la ruta
`{proyecto_id}/{modulo_id}/acta-vN.pdf`. Se registra la fila en
`public.actas` con la versión secuencial (`v = max(previa) + 1`).

**Estructura del PDF** (`src/lib/acta/acta-pdf.ts`):

1. **Banda superior primario #0F2B8E** con marca EGIXIA y versión del acta.
2. **Título** "Acta de configuración del módulo" + nombre del módulo.
3. **Metadatos** (recuadro claro): proyecto, empresa, diligenciado
   por, correo, fecha/hora y versión.
4. **Secciones** del módulo con filas *campo → valor*:
   - Selects/radios muestran la etiqueta legible.
   - Multi-checkbox: lista separada por comas.
   - Archivos: `nombre_original (bucket/storage_path)`.
   - Tablas dinámicas: total + una línea por fila con las columnas.
5. **Declaración de conformidad** con banda azul: el cliente confirma
   que la información registrada es la que se implementará.
6. **Pie de página** con la fecha de generación y paginación.

**Previsualización antes de enviar**: el invitado dispone del botón
"Previsualizar acta" en `/mi-proyecto/modulo/{id}` que llama a
`previsualizarActa` (`src/lib/acta.functions.ts`). El PDF se genera en
memoria y se abre en una pestaña nueva sin persistir la versión ni el
archivo.

**Descarga tras enviar**: `descargarActaFirmada` devuelve una URL
firmada de 7 días para la versión más reciente. Los correos de
"acta / envío a revisión" incluyen esa URL directamente.

## Plantillas de correo y envío

`src/lib/acta/plantillas-correo.ts` define las plantillas HTML/texto
con identidad EGIXIA (banda #0F2B8E, fondo #F0F4F8, tipografía
sans-serif del sistema, CTA con radio 10 px) para:

- `invitacion` — enlace de registro por token.
- `acta_envio` — módulo enviado a revisión (adjunta URL firmada del PDF).
- `acta_devolucion` — devolución con observaciones (incluye conteo).
- `acta_aprobacion` — módulo aprobado.

`notificarProyecto` (`src/lib/acta/notificaciones.server.ts`) separa a
los destinatarios en internos (`admin` + `implementador` activos) e
invitados (miembros con rol `cliente`), renderiza la plantilla con el
CTA apuntando a la ruta que corresponde a cada portal (`/app/...` para
internos y `/mi-proyecto/...` para invitados) y llama a la Edge
Function `enviar-correo` con el batch. Cada intento se registra en
`auditoria` con el status devuelto por el proveedor.

### Requisitos previos

- **Envío/reenvío**: el servidor revalida que todos los campos
  requeridos, activos y visibles (`mostrarSi`) tengan valor no vacío.
  El botón se habilita solo cuando `proyecto_modulos.progreso === 100`.
- **RLS**: como el invitado no puede escribir `en_revision` ni tocar
  `observaciones`, estas mutaciones **deben** pasar por las server
  functions descritas — no hay ruta cliente-Supabase directa.

### Acta y versiones

Cada envío o reenvío genera una fila nueva en `actas` con
`version = max(version) + 1` para el módulo. La URL del archivo es un
marcador (`acta://modulo/{id}/vN`) que la Parte 11 sustituirá por el
PDF real.

### Notificaciones por correo

Mientras no exista proveedor de correo conectado, cada transición se
registra en `auditoria` con acción `notificacion_pendiente` y detalle
`{ proyecto_id, asunto, mensaje, destinatarios }`. El helper `notificar`
es el único punto a modificar cuando se integre Resend/Brevo.

### Regla de bloqueo por estado (invitado)

Un usuario con rol `cliente`/`invitado` **solo puede editar** un módulo

## Reflejo en la UI del invitado (Parte 4)

La UI del invitado replica las reglas del backend para dar
retroalimentación inmediata:

- **Pastilla de estado** con la paleta EGIXIA:
  - `sin_iniciar` → gris.
  - `en_diligenciamiento` → azul.
  - `en_revision` → azul información (bloqueado).
  - `con_observaciones` → ámbar/naranja.
  - `aprobado` → verde.
- **Solo lectura** cuando el estado es `en_revision` o `aprobado`, con
  aviso visible en la parte superior del módulo.
- **Observaciones abiertas** listadas al inicio del módulo cuando el
  estado es `con_observaciones`.

## Fecha límite en la UI

Con `fecha_limite` y `comportamiento_vencimiento` definidos, el
componente `VencimientoBanner` muestra:

- `bloquear` (vencido) → banner rojo + módulo en solo lectura.
- `editable_avisar` (vencido) → banner ámbar, edición habilitada.
- `solo_avisar` (vencido) → banner ámbar informativo.
- `extension_implementador` (vencido) → banner ámbar indicando que
  EGIXIA puede extender el plazo.
- **≤ 3 días** para el cierre → banner azul suave con recordatorio.

El topbar del invitado muestra además una pastilla con la **fecha
límite más próxima** entre sus módulos no aprobados.

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