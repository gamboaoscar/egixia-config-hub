# Módulos del Portal

Los módulos se declaran con el motor de formularios (`src/lib/form-engine`)
usando la interfaz `ModuloDefinicion`. Cada módulo se registra en
`src/lib/form-engine/modulo-ejemplo.ts` y se renderiza con
`<FormularioModulo />`.

## Módulos definidos

| Key                 | Estado         | Archivo                                            |
| ------------------- | -------------- | -------------------------------------------------- |
| `imagen`            | ✅ Completo    | `src/lib/form-engine/modulos/imagen.ts`            |
| `sociedades`        | ✅ Completo    | `src/lib/form-engine/modulos/sociedades.ts`        |
| `seguridad`         | ✅ Completo    | `src/lib/form-engine/modulos/seguridad.ts`         |
| `usuarios_internos` | ✅ Completo    | `src/lib/form-engine/modulos/usuarios-internos.ts` |
| `matriz_documental` | ✅ Completo    | `src/lib/form-engine/modulos/matriz-documental.ts` |
| `integracion_erp`   | ✅ Completo    | `src/lib/form-engine/modulos/integracion-erp.ts`   |

---

## Módulo `imagen` — Imagen Corporativa

Define la identidad visual del portal del cliente, los documentos legales,
el pie de página, el correo de salida y las URLs del ambiente productivo y
de calidad. Se organiza en 7 secciones (algunas divididas en tarjetas para
facilitar el diligenciamiento).

### Sección 1 — Color corporativo

| Campo              | Tipo    | Req | Detalle                                                                  |
| ------------------ | ------- | :-: | ------------------------------------------------------------------------ |
| `color_principal`  | color   | ✅  | Azul Rey #0F2B8E · Negro #000000 · Rojo #ED1B2E · Verde #00ab4f · Verde Marino #008361. Recomendado: Azul Rey. |

### Sección 2 — Logotipos

PNG/SVG con fondo transparente salvo indicación. Se autoajustan con recorte
centrado ("cover") a las dimensiones exactas.

| Campo            | Tipo     | Req | Dimensiones | Notas                                    |
| ---------------- | -------- | :-: | ----------- | ---------------------------------------- |
| `logo_login`     | archivo  | ✅  | 400×110     | Pantalla de acceso.                      |
| `logo_menu`      | archivo  | ✅  | 180×50      | Barra del menú principal.                |
| `logo_favicon`   | archivo  | ✅  | 60×60       | Ícono del navegador. ICO o PNG.          |
| `logo_cabecera`  | archivo  | ✅  | 256×66      | Cabecera/pie. Transparente, color blanco.|

### Sección 3 — Imagen de fondo

| Campo        | Tipo    | Req | Dimensiones | Notas                                                    |
| ------------ | ------- | :-: | ----------- | -------------------------------------------------------- |
| `img_fondo`  | archivo | ✅  | 1360×635    | Cubre la mitad izquierda del inicio de sesión. JPG/PNG/WEBP. |

### Sección 4 — Términos y documentos legales

Solo PDF. Máximo 10 MB por archivo.

| Campo                     | Tipo    | Req | Notas                                           |
| ------------------------- | ------- | :-: | ----------------------------------------------- |
| `terminos`                | archivo | ✅  | Términos y condiciones de aceptación obligatoria. |
| `politica_datos`          | archivo | ⚪  | Opcional.                                       |
| `linea_etica`             | archivo | ⚪  | Opcional.                                       |
| `otros_documentos_1..3`   | archivo | ⚪  | Hasta 3 documentos adicionales.                 |

### Sección 5 — Pie de página (4 columnas)

**Branding**

| Campo             | Tipo     | Notas                                    |
| ----------------- | -------- | ---------------------------------------- |
| `pie_logo`        | archivo  | 256×66. PNG/SVG transparente.            |
| `pie_titulo`      | texto    | Título corto.                            |
| `pie_descripcion` | textarea | Descripción breve.                       |

**Enlaces:** `pie_url1`, `pie_url2`, `pie_url3`, `pie_url4` — todos `url` (https).

**Contacto:** `pie_direccion` (texto), `pie_celular` (texto), `pie_whatsapp` (texto), `pie_email` (email).

**Redes:** `red_facebook`, `red_x`, `red_linkedin`, `red_instagram` — todos `url` opcionales.

### Sección 6 — Correo de salida

Campo principal `correo_opcion` (radio_tarjetas, requerido) con 3 opciones:

1. **`egixia`** — Cuenta segura dominio EGIXIA (Recomendada). Muestra:
   `egixia_buzon` (texto, formato `proveedores[cliente]@egixia.com.co`).
2. **`smtp`** — SMTP cuenta propia del cliente (No recomendada). Muestra
   los campos condicionales:
   - `smtp_cuenta` (email) — con aviso de riesgo de SPAM/bloqueos.
   - `smtp_usuario` (texto, si aplica relay).
   - `smtp_password` (texto, contraseña sin vencimiento).
   - `smtp_puerto` (número, 1–65535). Aviso: **el puerto 25 no se admite**.
   - `smtp_autenticacion` (radio_tarjetas: Sí / No).
   - `smtp_protocolo` (radio_tarjetas: STARTTLS / TLS).
3. **`sendgrid`** — Nuevo dominio con SendGrid (servicios adicionales con costo).

La visibilidad condicional usa la nueva propiedad `mostrarSi` de
`CampoDefinicion` (`{ campo, igualA }`). El motor de validación y el
cálculo de progreso ignoran los campos ocultos.

### Sección 7 — URLs del portal

| Campo              | Tipo | Req | Formato                                                      |
| ------------------ | ---- | :-: | ------------------------------------------------------------ |
| `url_produccion`   | url  | ✅  | `https://[NombrePortalCliente-País].egixia.app`              |
| `url_calidad`      | url  | ⚪  | `https://www.egixia.net/[NombrePortalCliente-País]`          |

Ambas se validan con `url_https` (deben comenzar con `https://`).

---

## Cómo añadir un nuevo módulo

1. Crear `src/lib/form-engine/modulos/<key>.ts` exportando un
   `ModuloDefinicion`.
2. Importarlo y registrarlo en `REGISTRO` dentro de
   `src/lib/form-engine/modulo-ejemplo.ts`.
3. Actualizar este documento con la ficha del módulo.

---

## Módulo `sociedades` — Creación de Sociedades

Registra las sociedades del grupo que participarán en el portal. Se
implementa como una única **tabla dinámica** (`tipo: "tabla"`); una fila
por sociedad, sin límite fijo (capacidad mínima 8, se puede añadir más).

### Columnas

| Key                     | Tipo    | Req | Guía / Notas                                                    |
| ----------------------- | ------- | :-: | --------------------------------------------------------------- |
| `pais`                  | select  | ✅  | País donde opera legalmente. 15 países + "Otro".                |
| `tipo_documento`        | select  | ✅  | NIT · RUC · RFC · RUT · CUIT · Otro.                            |
| `numero_identificacion` | texto   | ✅  | Número de identificación tributaria, solo dígitos.              |
| `digito_verificacion`   | texto   | ⚪  | Exactamente 1 carácter numérico (aplica en Colombia).           |
| `razon_social`          | texto   | ✅  | Nombre legal completo.                                          |
| `descripcion`           | texto   | ⚪  | Descripción breve de la actividad.                              |
| `ciudad`                | texto   | ⚪  | Ciudad de la sede principal.                                    |
| `telefono`              | texto   | ⚪  | Con indicativo del país.                                        |
| `correo`                | email   | ⚪  | Correo de contacto de la sociedad.                              |
| `logo`                  | archivo | ⚪  | 200×200 px. PNG/SVG. Auto-ajuste con recorte centrado.          |

Cada columna incluye guía contextual (popover "i" en el encabezado) con
"qué ingresar" y formato. El archivo del logo reutiliza el componente
`CampoArchivo` de la Parte 6: valida formato/peso, muestra el panel de
ajuste cuando la imagen no cumple 200×200, y sube al bucket
`logos-clientes` con path único por celda (`campoKey_fila_columna`).

### Comportamiento

- **Añadir/eliminar filas** dinámicamente desde la tabla.
- **Sin límite** superior de filas.
- **Progreso**: para tablas con columnas requeridas, el motor cuenta las
  celdas requeridas llenas en todas las filas (`filas × columnas_req`).
  Si no hay filas todavía, cuenta como una unidad sin llenar para
  incentivar añadir la primera. Ver `calcularProgreso()` en
  `src/lib/form-engine/validacion.ts`.
- **Módulo iniciado**: se considera en diligenciamiento con ≥1 fila.

### Extensiones del motor (Parte 8)

- `ColumnaTabla` ahora soporta los tipos `select` (con `opciones`) y
  `archivo` (con `ConfigArchivo`), además de `guia`, `longitud`,
  `placeholder` y `ancho`.
- `TablaDinamica` renderiza cada celda con el control apropiado y expone
  la guía por columna con el mismo popover "i" que los campos.
- `calcularProgreso` maneja el caso especial de tablas con columnas

---

## Módulo `seguridad` — Seguridad

Define la política de contraseñas del portal y los roles que estarán
disponibles para usuarios internos y contactos de proveedores. Se
organiza en 4 secciones.

> **Nota (M7+M8).** Los roles disponibles (internos y de proveedor)
> se parametrizan por proyecto desde el catálogo. Cada proyecto puede
> tener un subconjunto distinto de opciones según el alcance
> contratado; las opciones no marcadas en el catálogo no se muestran
> al cliente.

### Sección 1 — Política de contraseñas

Todos los campos son numéricos y **requeridos**. El valor estándar
recomendado por EGIXIA se muestra como `placeholder` y en la guía "i".

| Campo             | Estándar | Detalle                                                          |
| ----------------- | :------: | ---------------------------------------------------------------- |
| `pass_dias`       |   180    | Periodo de cambio de contraseña (días).                          |
| `pass_espera`     |    0     | Tiempo mínimo entre cambios (días). 0 = sin espera.              |
| `pass_largo`      |    12    | Largo mínimo de la contraseña.                                   |
| `pass_numeros`    |    1     | Mínimo de caracteres numéricos (0–9).                            |
| `pass_mayusculas` |    1     | Mínimo de letras mayúsculas (A–Z).                               |
| `pass_especiales` |    1     | Mínimo de caracteres especiales (!, @, #, $, %, …).              |
| `pass_historial`  |    6     | Cantidad de contraseñas previas recordadas para impedir reúso.   |

### Sección 2 — Roles internos

Campo `roles_internos_seleccion` de tipo `checkbox_multiple`. Perfiles
predefinidos disponibles para asignar a usuarios internos:

Gestor de configuración · Gestor de contenido · Gestor de usuarios ·
Gestor de proveedores · Gestor de riesgos · Gestor de datos maestros ·
Gestor de solicitudes · Gestor de negociaciones · Gestor de
evaluaciones · Colaborador de evaluaciones · Gestor de órdenes de
compra · Gestor de contabilidad · Gestor de facturas · Gestor de
pagos · Gestor de contratos · Gestor de soporte.

Cada opción incluye una descripción breve visible en la tarjeta.

### Sección 3 — Roles de proveedor

Campo `roles_proveedor_seleccion` de tipo `checkbox_multiple`. Roles
disponibles para los contactos de las empresas proveedoras:

Contacto Principal · Contacto solicitudes · Contacto comercial ·
Contacto pedidos · Contacto financiero · Contacto contabilidad.

Aviso visible en el formulario: **cada proveedor puede asignar como
máximo 5 de estos roles a sus contactos**. Este límite es informativo
en la configuración y se aplica más adelante en el módulo de
proveedores.

### Sección 4 — Roles personalizados

Nota informativa (campo tipo `info`, sin valor): se pueden habilitar
hasta **3 roles personalizados adicionales**, que se solicitan por la
mesa de servicio de EGIXIA indicando nombre y permisos.

### Persistencia y progreso

- Las selecciones se guardan en `proyecto_modulos.datos` bajo las
  claves `roles_internos_seleccion` y `roles_proveedor_seleccion` como
  arrays de strings.
- El % de avance solo cuenta los **7 numéricos requeridos** de la
  política; los checkbox y la nota informativa no penalizan el
  progreso.

### Extensiones del motor (Parte 9)

- Nuevo tipo `checkbox_multiple`: selección múltiple de opciones,
  guarda un `string[]` en `datos`.
- Nuevo tipo `info`: campo puramente informativo, no cuenta para
  validación ni progreso. Renderiza una tarjeta suave con el `label`
  como título y el `aviso` como cuerpo.
  requeridas.

---

## Módulo `usuarios_internos` — Usuarios internos

Registra a las personas del equipo del cliente que usarán el Portal de
Proveedores y el rol que tendrá cada una. EGIXIA crea las cuentas con
estos datos. Se organiza en 2 secciones.

### Sección 1 — Usuarios del portal (`usuarios`)

Campo único `tabla_usuarios` (tipo `tabla`, **requerido**), una fila por
persona:

| Columna    | Tipo   | Req | Guía / Notas                                                          |
| ---------- | ------ | :-: | --------------------------------------------------------------------- |
| `nombre`   | texto  | ✅  | Nombre(s) de la persona.                                              |
| `apellido` | texto  | ✅  | Apellido(s) de la persona.                                            |
| `correo`   | email  | ✅  | Correo corporativo con el que iniciará sesión.                        |
| `cargo`    | texto  | ⚪  | Cargo dentro de la organización.                                      |
| `sociedad` | texto  | ⚪  | Razón social a la que pertenece (de las registradas en Sociedades).   |
| `rol`      | select | ✅  | Perfil del portal. Opciones dinámicas desde Seguridad (ver abajo).    |

### Sección 2 — Responsable del portal (`responsable`)

| Campo         | Tipo  | Req | Notas                                                              |
| ------------- | ----- | :-: | ------------------------------------------------------------------ |
| `resp_nombre` | texto | ✅  | Punto de contacto principal con EGIXIA.                            |
| `resp_correo` | email | ✅  | Correo corporativo del responsable.                                |

### Opciones dinámicas entre módulos (`opcionesDesde`)

La columna `rol` reutiliza las **16 opciones de `ROLES_INTERNOS`**
(exportadas por `src/lib/form-engine/modulos/seguridad.ts`) y declara:

```ts
opcionesDesde: { moduloKey: "seguridad", campoKey: "roles_internos_seleccion" }
```

Regla (`resolverOpcionesDinamicas` en
`src/lib/form-engine/opciones-dinamicas.ts`, helper puro):

- Si el módulo `seguridad` del **mismo proyecto** tiene en
  `datos.roles_internos_seleccion` un array no vacío, las opciones del
  select se **filtran** a las seleccionadas allí.
- Si el módulo origen no existe en el proyecto o la selección está
  vacía, se muestran las opciones completas.
- El filtro se aplica en los 3 consumidores de la definición —
  formulario del invitado (`/mi-proyecto/modulo/:id`), revisión interna
  (`/app/modulo/:id`) y `cargarDefinicionEfectiva` (acta PDF y
  revalidación server-side de envío) — de modo que todos ven las mismas
  opciones.

Tanto `CampoDefinicion` como `ColumnaTabla` aceptan `opcionesDesde`, por
lo que cualquier módulo futuro puede encadenar sus opciones a la
selección de otro.

### Persistencia y progreso

- La tabla se guarda en `proyecto_modulos.datos.tabla_usuarios` como
  array de filas; el responsable en `resp_nombre` / `resp_correo`.
- Progreso: columnas requeridas de la tabla (`nombre`, `apellido`,
  `correo`, `rol`) por fila + los 2 campos del responsable, con la misma
  regla de tablas del módulo Sociedades.

---

## Módulo `matriz_documental` — Matriz documental de proveedores

Define qué documentos exigirá el portal a los proveedores, según su
tipo, con obligatoriedad y vigencia. Se organiza en 3 secciones.

### Sección 1 — Tipos de proveedor (`tipos_proveedor`)

Cómo el cliente clasifica a sus proveedores; cada documento de la
matriz aplicará a uno o varios de estos tipos. Incluye un campo `info`
(`tipos_info`) con ejemplos habituales: Nacional de bienes, Nacional de
servicios, Proveedor del exterior, Persona natural.

Campo `tabla_tipos` (tipo `tabla`, **requerido**), una fila por tipo:

| Columna       | Tipo  | Req | Guía / Notas                                   |
| ------------- | ----- | :-: | ---------------------------------------------- |
| `nombre`      | texto | ✅  | Nombre corto del tipo (ej. "Nacional — bienes"). |
| `descripcion` | texto | ⚪  | Cuándo aplica esta clasificación.              |

### Sección 2 — Documentos exigidos (`documentos`)

La matriz de documentos que el proveedor deberá cargar al registrarse.
Incluye un campo `info` (`documentos_info`) con documentos frecuentes en
Colombia: RUT, Certificado de Cámara de Comercio (no mayor a 90 días),
certificación bancaria, estados financieros, certificado SG-SST,
certificaciones de calidad (ISO).

Campo `tabla_documentos` (tipo `tabla`, **requerido**), una fila por
documento:

| Columna       | Tipo   | Req | Guía / Notas                                                                 |
| ------------- | ------ | :-: | ---------------------------------------------------------------------------- |
| `documento`   | texto  | ✅  | Nombre del documento (ej. "RUT actualizado").                                 |
| `aplica_a`    | texto  | ✅  | Tipos a los que aplica, separados por coma; "Todos" si aplica a todos.        |
| `obligatorio` | select | ✅  | `obligatorio` (para activar al proveedor) · `opcional`.                       |
| `vigencia`    | select | ✅  | `no_vence` · `seis_meses` · `un_ano` · `dos_anos` · `personalizada` (en notas). |
| `notas`       | texto  | ⚪  | Aclaraciones, vigencias especiales o excepciones.                             |

### Sección 3 — Políticas de la matriz (`politicas`)

| Campo                   | Tipo           | Req | Notas                                                                  |
| ----------------------- | -------------- | :-: | ---------------------------------------------------------------------- |
| `aviso_renovacion_dias` | numero         | ✅  | Días de anticipación del aviso de vencimiento. Validación `min: 1`.     |
| `bloquear_vencidos`     | radio_tarjetas | ✅  | `bloquear` (bloquear al proveedor con documentos vencidos) · `avisar` (solo avisar sin bloquear). |
| `responsable_correo`    | email          | ✅  | Correo del responsable de validar los documentos cargados.              |

### Persistencia y progreso

- Se guarda en `proyecto_modulos.datos`: `tabla_tipos` y
  `tabla_documentos` como arrays de filas; las políticas en
  `aviso_renovacion_dias` / `bloquear_vencidos` / `responsable_correo`.
- Progreso: columnas requeridas por fila de ambas tablas + los 3 campos
  de políticas, con la misma regla de tablas del módulo Sociedades. Los
  campos `info` no cuentan para validación ni progreso.
- La relación documento → tipos se captura en texto libre (`aplica_a`)
  usando los nombres definidos en `tabla_tipos`.

---

## Módulo `integracion_erp` — Integración ERP / SAP

Recoge los datos técnicos necesarios para conectar el Portal de
Proveedores con el ERP del cliente (SAP u otro). Pensado para el
equipo de TI del cliente. Puede ocultarse por proyecto vía la
parametrización M8 (`/app/catalogo`) cuando el alcance contratado no
incluye integración, y en `/app/proyectos/nuevo` no se marca por
defecto.

**Seguridad:** el formulario NO solicita contraseñas, tokens ni llaves
privadas. Esos secretos se coordinan con EGIXIA por canal cifrado; hay
un aviso destacado en la sección "Ambientes y conexión".

### Sección 1 — Tu ERP (`erp`)

| Campo               | Tipo            | Req | Notas                                                                            |
| ------------------- | --------------- | :-: | -------------------------------------------------------------------------------- |
| `tiene_integracion` | radio_tarjetas  | ✅  | `si` (requiere integración) · `no` (sin integración por ahora).                  |
| `sistema`           | select          | ⚪  | `sap_ecc` · `sap_s4` · `oracle` · `dynamics` · `siesa` · `world_office` · `otro`. Solo si `tiene_integracion = si`. |
| `version`           | texto           | ⚪  | Versión y release del ERP. Solo si `tiene_integracion = si`.                     |

### Sección 2 — Alcance de la integración (`alcance`)

| Campo         | Tipo               | Req | Notas                                                                        |
| ------------- | ------------------ | :-: | ---------------------------------------------------------------------------- |
| `interfaces`  | checkbox_multiple  | ⚪  | `proveedores` · `ordenes` · `entradas` · `facturas` · `pagos` · `contratos`. Solo si `tiene_integracion = si`. |

El alcance definitivo se confirma en el levantamiento técnico con
EGIXIA (aviso informativo `alcance_info`).

### Sección 3 — Ambientes y conexión (`ambientes`)

`tabla_ambientes` (visible solo si `tiene_integracion = si`) con
columnas por fila:

| Columna         | Tipo   | Req | Guía / Notas                                                     |
| --------------- | ------ | :-: | ---------------------------------------------------------------- |
| `ambiente`      | select | ✅  | `qa` (QA / Pruebas) · `prod` (Producción).                       |
| `tipo_conexion` | select | ✅  | `api` · `odata` · `rfc` · `sftp` · `archivo`.                    |
| `host`          | texto  | ⚪  | Host o endpoint base, sin credenciales.                          |
| `notas`         | texto  | ⚪  | Observaciones adicionales.                                        |

| Campo                 | Tipo   | Req | Notas                                                                    |
| --------------------- | ------ | :-: | ------------------------------------------------------------------------ |
| `contacto_ti_nombre`  | texto  | ⚪  | Responsable técnico de la integración en tu organización.                |
| `contacto_ti_correo`  | email  | ⚪  | Correo del responsable técnico. Solo si `tiene_integracion = si`.         |

### Persistencia y progreso

- Se guarda en `proyecto_modulos.datos`; `tabla_ambientes` como array
  de filas.
- Los campos `info` (`alcance_info`, `seguridad_info`) no cuentan para
  validación ni progreso.
- La visibilidad de `sistema`, `version`, `interfaces`,
  `tabla_ambientes` y los contactos de TI depende de
  `tiene_integracion = si` vía `mostrarSi`; cuando el cliente elige
  `no`, esos campos se ocultan y no cuentan para el progreso.