# Módulos del Portal

Los módulos se declaran con el motor de formularios (`src/lib/form-engine`)
usando la interfaz `ModuloDefinicion`. Cada módulo se registra en
`src/lib/form-engine/modulo-ejemplo.ts` y se renderiza con
`<FormularioModulo />`.

## Módulos definidos

| Key           | Estado         | Archivo                                          |
| ------------- | -------------- | ------------------------------------------------ |
| `imagen`      | ✅ Completo    | `src/lib/form-engine/modulos/imagen.ts`          |
| `sociedades`  | ✅ Completo    | `src/lib/form-engine/modulos/sociedades.ts`      |
| `seguridad`   | 🚧 Demo        | `src/lib/form-engine/modulo-ejemplo.ts`          |

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
  requeridas.