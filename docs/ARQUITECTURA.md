# Arquitectura

## Visión general

_Pendiente de detallar._

## Frontend

- React + Vite + TypeScript
- TanStack Router (file-based) + TanStack Query
- Tailwind CSS v4 + shadcn/ui

## Backend

- Supabase (por integrar): autenticación, PostgreSQL, storage.

## Despliegue

_Pendiente._

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
  (canvas cover), subida y firma de URL.
- `src/components/form-engine/campo-archivo.tsx` — UI: dropzone,
  panel de ajuste con sliders, tarjeta de archivo cargado con botones
  "Reemplazar" / "Quitar" y etiqueta *"Ajustado a 400×110 px"*.