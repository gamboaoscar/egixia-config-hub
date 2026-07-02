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