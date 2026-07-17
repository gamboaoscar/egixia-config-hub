# Arquitectura

## Visión general

El configurador EGIXIA es un portal web guiado que reemplaza el
intercambio manual de Excel entre EGIXIA y sus clientes durante la
puesta en marcha del Portal de Proveedores. El flujo end-to-end es:

1. **Invitación** — el equipo interno (admin o implementador) crea
   un proyecto y envía invitaciones por correo (Edge Function
   `enviar-correo`, plantillas EGIXIA, Resend). Cada invitación es
   un token de un solo uso con vencimiento.
2. **Diligenciamiento guiado** — el cliente entra a `/mi-proyecto`,
   ve solo los módulos que le corresponden y los completa en un
   motor de formularios declarativo con autoguardado, validación en
   línea, indicador de progreso y adjuntos con URL firmada.
3. **Revisión** — el equipo interno revisa cada módulo, deja
   observaciones por campo y aprueba o devuelve al cliente. El
   estado del módulo/proyecto avanza automáticamente.
4. **Acta** — cuando un módulo queda aprobado se genera el PDF con
   `pdf-lib` (server-side), con portada, imágenes incrustadas y
   anexos fusionados, y se notifica por correo.

Toda la información sensible vive en Supabase con RLS extensa;
`/app` solo lo pueden abrir admin/implementador y `/mi-proyecto` solo
los invitados activos del proyecto.

## Frontend

- React + Vite + TypeScript
- TanStack Router (file-based) + TanStack Query
- Tailwind CSS v4 + shadcn/ui

## Backend

- Supabase (por integrar): autenticación, PostgreSQL, storage.

## Despliegue

- **Hosting frontend:** Lovable (SSR/edge) con dominio propio
  `https://configurador.egixia.app` gestionado en AWS Route 53
  (registros A/CNAME apuntando a la infraestructura de Lovable, TLS
  automático). El dominio interno `egixia-config-hub.lovable.app`
  queda como URL secundaria del hosting.
- **Backend:** Supabase (Auth, Postgres con RLS, Storage privado).
  Las claves publicables se inyectan en el bundle vía
  `VITE_SUPABASE_*`; la service role solo se usa en server functions
  y Edge Functions.
- **Edge Functions:** `enviar-correo` para todo el correo
  transaccional del portal (invitaciones, envío/aprobación/
  devolución de acta, avisos) — usa `RESEND_API_KEY` y plantillas
  EGIXIA compartidas con el frontend en `src/lib/acta/plantillas-
  correo.ts`.
- **Server functions (TanStack Start):** toda la lógica interna del
  frontend (validaciones, catálogo, generación de PDF, invitaciones)
  se resuelve con `createServerFn` protegido por
  `requireSupabaseAuth`.

## Motor de formularios dinámicos

Los módulos del portal (Imagen, Sociedades, Seguridad, …) no se
programan a mano cada vez: se **declaran** con una estructura
TypeScript y un renderizador genérico se encarga de pintarlos y
gestionar su estado.

### Formato de definición

Ubicación: `src/lib/form-engine/tipos.ts`.

- **ModuloDefinicion** → `key`, `nombre`, `icono?`, `descripcion?`,
  `secciones[]`.
- **SeccionDefinicion** → `key`, `titulo`, `descripcion?`, `campos[]`.
- **CampoDefinicion**:
  - `key` (único dentro del módulo)
  - `label`
  - `tipo`: `'texto' | 'textarea' | 'numero' | 'email' | 'url' |
    'select' | 'radio_tarjetas' | 'color' | 'archivo' | 'tabla'`
  - `requerido?`
  - `guia?`: `{ que, formato?, tamano? }` — se muestra en el popover
    del botón "i".
  - `opciones?`: para `select`, `radio_tarjetas` y `color`.
  - `validacion?`: `{ url_https?, email?, min?, max?, longitud? }`.
  - `columnas?`: para `tabla`.
  - `activo?`: si es `false`, el campo **no se renderiza** y **no
    cuenta para el % de progreso**.

Los datos se persisten en `proyecto_modulos.datos` como un JSONB
plano `{ [campoKey]: valor }`.

### Renderizador

- `src/components/form-engine/formulario-modulo.tsx` — pinta las
  secciones como tarjetas ("cuadritos") y delega cada campo al
  renderizador según su tipo.
- `src/components/form-engine/campo-renderer.tsx` — implementa cada
  tipo (`texto`, `select`, `radio_tarjetas`, `color`, `archivo`,
  `tabla`, …). La carga real de archivos se completa en la Parte 6;
  por ahora se guarda el nombre del archivo seleccionado.
- `src/components/form-engine/campo-info.tsx` — botón "i" con
  popover: se muestra solo al pulsarlo, nunca expandido por defecto.

### Estado y autoguardado

`src/lib/form-engine/use-form-modulo.ts` centraliza:

- Estado local (`datos`, `errores`, `tocados`).
- **Validación en línea** por campo (`validarCampo`) — no bloquea el
  autoguardado.
- **Autoguardado con debounce** (~700 ms) sobre
  `proyecto_modulos.datos`; el indicador del topbar refleja
  `Guardando… / Guardado hh:mm / No se pudo guardar` a través del
  `MiProyectoProvider`.
- **% de progreso** (`calcularProgreso`): campos requeridos + activos
  con valor ÷ total requeridos + activos × 100. Se guarda en
  `proyecto_modulos.progreso` en cada autosave, alimentando pastillas
  y anillos del dashboard/sidebar.

### Solo lectura

El renderizador respeta `soloLectura` cuando el módulo está en
revisión, aprobado, o vencido con `comportamiento_vencimiento =
bloquear`. Los campos se desactivan y los cambios se ignoran.

### Módulos de ejemplo

`src/lib/form-engine/modulo-ejemplo.ts` registra definiciones mínimas
para probar el motor (Imagen / Sociedades / Seguridad). Las
definiciones reales se cargan en las Partes 7–9.

### Overrides por proyecto (secciones, campos y opciones)

`src/lib/form-engine/overrides.ts` aplica tres niveles de
parametrización sobre la definición estática antes de renderizar:

1. **Secciones** (tabla `catalogo_overrides_seccion`): si
   `habilitada = false`, la sección se elimina de la definición
   resultante (no se renderiza, no cuenta para progreso ni validación
   y no aparece en el acta). Si `obligatoria = false`, todos los
   campos de la sección pasan a `requerido: false`.
2. **Campos** (tabla `catalogo_overrides`): habilita/oculta, cambia
   etiqueta, requerido y guía por proyecto.
3. **Opciones** (columna `catalogo_overrides.opciones_permitidas`):
   restringe qué valores están disponibles en campos con `opciones`
   (select, radio_tarjetas, checkbox_multiple). `null` significa
   "todas las opciones".

La misma definición efectiva se usa en el motor de formularios, en
`calcularProgreso` (server-side, tras cada `guardarOverride*`) y en
`construirDatosActa` (para que el acta refleje solo lo parametrizado).
Los datos del cliente nunca se borran: si una sección/campo se oculta,
la información persiste en `proyecto_modulos.datos` y reaparece al
rehabilitarla.

## Flujo de archivos y auto-ajuste

Los campos `tipo: 'archivo'` se declaran con un bloque `archivo` en la
definición:

```ts
{
  key: 'logo',
  tipo: 'archivo',
  archivo: {
    bucket: 'logos-clientes',        // o 'documentos' para PDFs
    formatosPermitidos: ['image/png', '.svg'],
    tamanoMaxMB: 5,
    dimensiones: { ancho: 400, alto: 110 },
  },
}
```

### Ciclo de vida de una subida

1. **Selección** — el usuario elige un archivo. Se valida en cliente
   tipo (`formatoPermitido`) y tamaño (`tamanoMaxBytes`).
2. **Rama por tipo**:
   - **PDF** → se sube tal cual al bucket `documentos`.
   - **SVG** → se valida que contenga la etiqueta `<svg>` y se sube sin
     re-encodear (los buckets guardan el binario original).
   - **Imagen raster** (PNG / JPG / WEBP / ICO):
     - Si el campo declara `dimensiones` y la imagen **ya coincide**,
       se sube sin tocarla.
     - Si no coincide, se abre el **panel de ajuste** con vista previa
       en modo `object-fit: cover` y dos sliders para reposicionar el
       encuadre. Al confirmar, `redimensionarCover()` genera un PNG a
       las dimensiones exactas usando canvas y esa es la versión que
       se sube.
     - Si no hay `dimensiones` declaradas, la imagen se sube tal cual.
3. **Storage** — el binario se guarda en el bucket privado del campo,
   con path `{proyecto_id}/{modulo_id}/{campo_key}/{timestamp}-{slug}`.
4. **Metadatos** — se inserta una fila en `public.archivos`
   (`nombre_original`, `storage_path`, `tipo`, `tamano`,
   `dimensiones`).
5. **Referencia en el módulo** — `proyecto_modulos.datos[campoKey]`
   recibe un `ValorArchivo`:
   ```ts
   {
     archivoId, bucket, storagePath,
     nombre, tipo, tamano, dimensiones, ajustado?
   }
   ```
6. **Autosave** — el hook `useFormModulo` persiste el `datos` completo
   y recalcula `progreso`. La subida no depende del debounce del
   autosave: viaja en cuanto se confirma.

### Previsualización

La miniatura del componente `<CampoArchivo />` obtiene una **URL
firmada** con `createSignedUrl(bucket, path, 3600)`. Los buckets son
privados: nunca se exponen URLs públicas.

### Reemplazo y quitar

- **Reemplazar** — subida nueva → registro nuevo → borrado del binario
  anterior (`remove([path])`). La fila anterior en `public.archivos`
  se conserva como histórico.
- **Quitar** — borra el binario y limpia la referencia del `datos`.

### Piezas del código

- `src/lib/form-engine/archivo.ts` — validación, redimensionado
  (canvas cover), subida y firma de URL. `firmarUrl(bucket, path,
  segundos?, download?)` admite un parámetro opcional `download` que
  usa `createSignedUrl(..., { download: <nombre> })` para forzar
  descarga con el nombre original.
- `src/components/form-engine/campo-archivo.tsx` — UI: dropzone,
  panel de ajuste con sliders, tarjeta de archivo cargado con
  acciones **Ver** (abre pestaña con URL firmada) y **Descargar**
  (URL firmada con `download` = nombre original). Miniatura clicable
  para ver el archivo. **Reemplazar** y **Quitar** solo se muestran
  cuando el campo es editable.

## Autorización de rutas y RBAC

- `src/lib/rbac.functions.ts` — server function
  `exigirEquipoInterno`, protegida por `requireSupabaseAuth`. La
  invoca el `beforeLoad` de `src/routes/app.tsx` para bloquear la
  entrada de invitados al área interna.
- `src/lib/admin.functions.ts` — server functions administrativas;
  cada mutación autoriza al llamante (`exigirInterno` /
  `exigirAdmin`) antes de tocar la base o Supabase Auth y registra
  la acción en `auditoria`.
- Función DB `comparten_proyecto(a, b)` — helper `SECURITY DEFINER`
  utilizado por las políticas RLS de `profiles` para permitir que
  los miembros de un mismo proyecto se vean entre sí.
  "Reemplazar" / "Quitar" y etiqueta *"Ajustado a 400×110 px"*.