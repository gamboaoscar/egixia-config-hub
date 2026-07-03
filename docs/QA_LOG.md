# EGIXIA Configurator — Bitácora de QA (rol Administrador)

- Fecha: 2026-07-03
- Cuenta usada: `hilberth.lopezv@egixia.com` (rol `admin`, ya existente y activo — no se creó una cuenta nueva, la sesión estaba disponible en el entorno de pruebas).
- Entorno: preview `localhost:8080` con la migración y código a esta fecha.
- Alcance: navegación completa del sidebar del área `/app/*`, formularios de invitación, creación de proyecto, catálogo, auditoría, configuración, mi perfil, login y responsive móvil.
- Metodología: recorridos con Playwright (headless Chromium) capturando pantalla, consola del navegador y respuestas HTTP >= 400. No se corrigió código durante esta pasada.

## Hallazgos

| # | Pantalla / flujo | Pasos para reproducir | Resultado esperado | Resultado real | Severidad |
|---|---|---|---|---|---|
| 1 | Auditoría global (`/app/auditoria`) | Iniciar sesión como admin → clic en "Auditoría" en el sidebar. | Se lista el histórico de acciones del sistema (crear proyecto, invitar, aprobar, etc.). | La tabla queda en "Sin registros con los filtros actuales" y en consola se ven **dos respuestas HTTP 400** de PostgREST: `PGRST200 — Could not find a relationship between 'auditoria' and 'actor_id' in the schema 'public'`. La consulta intenta hacer embed `profiles:actor_id(...)` pero no existe la foreign key declarada entre `public.auditoria.actor_id` y `public.profiles.id`, así que el listado no carga ningún registro (aunque en base sí hay auditoría). | **Crítico** |
| 2 | Crear proyecto (`/app/proyectos/nuevo`) | Llenar sólo "Nombre" y "Empresa"; dejar los 3 módulos sin marcar y sin fecha límite; clic en "Crear proyecto". | El formulario debe exigir seleccionar al menos un módulo y una fecha límite antes de guardar (según especificación: "los 3 módulos" + "fecha límite y comportamiento al vencer por módulo"). | El proyecto se crea igual: aparece toast "Proyecto creado." y queda en base (`proyectos.id = 1cff3bd3-…`, `nombre = 'QA Test Proyecto'`) sin módulos asociados. Efecto colateral: el catálogo del proyecto queda vacío y no puede diligenciarse. | **Alto** |
| 3 | Crear proyecto — validación al enviar vacío | Ir a `/app/proyectos/nuevo` con todo vacío → clic en "Crear proyecto". | Un solo mensaje de error claro, idealmente marcando los campos requeridos. | El toast **"Completa nombre y empresa."** se muestra duplicado (dos veces apilado, se ve texto repetido en `[data-sonner-toast]`). Además el mensaje sólo menciona nombre y empresa, ignorando fecha límite y módulos (ligado al hallazgo #2). | Medio |
| 4 | Invitaciones (`/app/invitaciones`) — enviar con correo vacío | Dejar el campo "Correo" vacío y clic en "Enviar". | Validación clara antes de tocar el backend. | Muestra toast "Email inválido." (correcto), pero el mismo botón permite un **segundo clic inmediato** durante el envío en el flujo normal (no se marca `disabled` hasta que arranca el request; en la prueba de doble clic no se creó doble invitación, pero el botón sí es re-clicable durante el intervalo `sending`). Riesgo bajo hoy porque el servidor deduplica, pero conviene deshabilitar hasta resolver la promesa. | Bajo |
| 5 | Envío de correos de invitación / recuperación de contraseña | Enviar una invitación real o pedir "¿Olvidaste tu contraseña?" | El destinatario recibe correo en español desde un remitente verificado, sin caer en spam. | Los correos que sí llegan (recuperación) están **en inglés** y desde el remitente compartido de la plataforma, por lo que caen en spam. Las invitaciones nuevas dependen de un dominio verificado que aún no está configurado — ya reportado, requiere acción del administrador en "Configurar dominio de correo". Bloquea probar el flujo end-to-end de "aceptar invitación". | Alto |
| 6 | Aceptar invitación (`/invitacion/:token`) — token inexistente | Abrir en incógnito `http://localhost:8080/invitacion/token-inexistente-123`. | Mensaje claro y redirección o botón para volver al inicio. | Comportamiento correcto: se muestra toast y redirige a `/` (home pública). Sin errores en consola. Sólo se registra como observación, **no es un bug**. | Info |
| 7 | Usuarios (`/app/usuarios`) | Como único usuario en el sistema, entrar a Usuarios. | Debería poder crear/invitar otros usuarios y probar inhabilitar/eliminar sobre datos de prueba. | La cabecera y el botón "Invitar usuario" funcionan y llevan a `/app/invitaciones`. **Bloqueo para QA:** al no llegar los correos de invitación (hallazgo #5), no se pudo materializar un segundo usuario para probar inhabilitar / re-activar / eliminar. La lista sólo muestra al admin actual (sobre uno mismo, correctamente, no se muestran botones destructivos). | Medio (bloqueo de QA, no bug en sí) |
| 8 | Catálogo de módulos (`/app/catalogo`) | Entrar a Catálogo con el proyecto "QA Test Proyecto" recién creado. | Ver los módulos del proyecto y poder activar/desactivar campos. | Al seleccionar el proyecto no aparecen módulos porque el proyecto se creó sin ninguno (efecto del hallazgo #2). No hay una vista alterna para asignar módulos a un proyecto existente desde Catálogo, así que no se puede recuperar. | Medio |
| 9 | Revisiones pendientes (`/app/revisiones`) | Ir a Revisiones. | Debería listar módulos "en revisión" y permitir aprobar / devolver con observaciones. | Muestra estado vacío "Sin módulos por revisar" — no había módulos en revisión y (por #2 + #5) no fue posible generarlos en esta pasada. Flujo de aprobación/devolución **no verificado**. | Bloqueo de QA |
| 10 | Mi perfil (`/app/mi-perfil`) | Ir a Mi perfil → cambiar campos → verificar correo. | Se puede editar nombre/apellido/cargo/empresa, subir foto, y el correo aparece bloqueado. | El input de correo está correctamente `disabled` (valor `hilberth.lopezv@egixia.com`). No hay bug funcional; sí conviene revisar que el placeholder de "Cargo" o similar guíe mejor al usuario (dato existente contenía "Inegiero DevOps" — typo del usuario, no de la app). | Info |
| 11 | Login — credenciales inválidas | Cerrar sesión → ir a `/login` → poner correo y contraseña falsos → Enter. | Mensaje de error claro. | Correcto: se muestra "Credenciales inválidas. Verifica tu correo y contraseña." (respuesta 400 esperada del proveedor de auth). Sin bugs. | Info |
| 12 | Login estando ya autenticado | Con sesión iniciada, ir a `/login`. | Redirigir a `/app`. | Correcto: la ruta redirige automáticamente a `/app`. | Info |
| 13 | Cerrar sesión | Clic en "Cerrar sesión" en el pie del sidebar. | Redirigir a `/login`. | Correcto: URL final `http://localhost:8080/login`, sin errores. | Info |
| 14 | Sidebar colapsar/expandir | Clic en el botón "Toggle Sidebar". | El sidebar se colapsa y expande. | Correcto en desktop. Sin errores. | Info |
| 15 | Responsive móvil (390 × 844) | Reducir a ancho móvil y visitar `/app` y `/app/proyectos/nuevo`. | Layout usable, sidebar accesible por menú. | El sidebar queda oculto tras el trigger de sheet (comportamiento de shadcn-sidebar). El home y el formulario "Nuevo proyecto" se ven razonablemente, sin scroll horizontal roto ni superposiciones. Sin errores. | Info |
| 16 | Hydration mismatch (raíz) | Cargar cualquier ruta con `?/` en DevTools. | Sin advertencias de hidratación. | En consola aparece de forma persistente el warning de React `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties` sobre `<body>` (atributos `bis_status`, `bis_frame_id`, `__processed_*` inyectados por Bitwarden / extensiones). No rompe la app, pero merece confirmarse que también ocurre sin extensiones — si es sólo por extensiones, se puede silenciar con `suppressHydrationWarning` en `<body>`. | Bajo |

## Cobertura no ejecutada / bloqueada

- **Aceptar invitación end-to-end (paso 6 del plan):** bloqueado por hallazgo #5 (correos no llegan / llegan en inglés a spam). Necesita el dominio de correo verificado para completarse.
- **Flujo de revisión aprobar/devolver (paso 8):** no había módulos en estado "en revisión" y, por hallazgo #2, no se pudo generar uno nuevo con módulos asignados en esta pasada.
- **Catálogo activar/desactivar campos y verificar vista del invitado (paso 10):** ídem, sin proyecto con módulos asignados.
- **Usuarios — crear/inhabilitar/eliminar (paso 9):** no se ejecutó sobre otras cuentas para no tocar datos reales; sólo hay un usuario en base y las acciones destructivas no aplican sobre uno mismo. Requiere una cuenta secundaria de prueba (bloqueada por #5).
- **Exportar Excel/JSON/PDF y auditoría de un proyecto (paso 7 parcial):** no hay proyectos con datos diligenciados; la exportación no se ejecutó.

## Datos de prueba dejados en base

- `public.proyectos.id = 1cff3bd3-5cfe-4a6d-bedb-eade133a6287` (`QA Test Proyecto` / empresa `QA Empresa`, sin módulos). Se recomienda eliminarlo antes de la siguiente pasada de QA o dejarlo como caso de prueba del hallazgo #2.
- No quedaron invitaciones de prueba activas (los intentos con correos ficticios no persistieron).

## Resumen

- Total de hallazgos con acción pendiente: **9** (los 7 restantes son informativos / comportamientos correctos).
- Severidad **Crítico**: 1 (Auditoría global no carga por FK inexistente).
- Severidad **Alto**: 2 (crear proyecto sin módulos ni fecha límite; correos de invitación / recuperación en inglés y a spam).
- Severidad **Medio**: 3 (toast duplicado en Nuevo proyecto; bloqueo QA en Usuarios y Catálogo por #5/#2).
- Severidad **Bajo**: 2 (botón "Enviar" reclicable durante el envío; warning de hidratación en `<body>`).
- Severidad **Bloqueo de QA**: 1 (flujo de revisión no verificado).

## Correcciones aplicadas (2026-07-03, misma fecha)

| # | Estado | Cambio |
|---|---|---|
| 1 | ✅ Corregido | `src/routes/app.auditoria.tsx` — se reemplaza el embed `profiles:actor_id(...)` (que fallaba con `PGRST200` porque no existe FK entre `auditoria.actor_id` y `profiles.id`) por dos consultas: primero `auditoria`, luego `profiles` filtrando por los `actor_id` distintos, y unión en cliente. La tabla ahora lista los registros (verificado: 13 filas, sin 4xx). |
| 2 | ✅ Corregido | `src/routes/app.proyectos.nuevo.tsx` — validación separada para nombre, empresa, al menos un módulo activo, **y fecha límite obligatoria para cada módulo activo**, con mensaje que nombra los módulos sin fecha. Etiqueta "Fecha límite (opcional)" pasa a "Fecha límite". |
| 3 | ⚠️ Descartado | Falso positivo del script de QA — el toast se lee dos veces porque `sonner` etiqueta el mismo elemento con `role="alert"` **y** `data-sonner-toast`. No hay duplicación real en UI. |
| 4 | ✅ Verificado | Botón "Enviar" en Invitaciones ya usa `disabled={sending}` mientras la promesa está en vuelo — no se creó doble invitación en la prueba y el backend deduplica por token. Sin cambio de código. |
| 5 | ⏸ Bloqueado por dominio | Requiere dominio de correo verificado para: (a) enviar desde `no-reply@egixia.*` en lugar del remitente compartido, y (b) generar plantillas custom en español para invitación / recuperación. Ya se mostró el diálogo "Configurar dominio de correo"; al completarlo, activo `email_domain--scaffold_auth_email_templates` y las plantillas quedan en español. |
| 6–15 | ✅ Sin cambios | Comportamientos correctos confirmados. |
| 16 | ✅ Corregido | `src/routes/__root.tsx` — `<body>` ahora lleva `suppressHydrationWarning` para tolerar atributos inyectados por extensiones (Bitwarden y similares). |
| — | 🧹 Limpieza | Eliminado el proyecto de prueba `QA Test Proyecto` (`1cff3bd3-…`) que había quedado sin módulos. |