# Guía UX — EGIXIA Configurator

## Principios

1. **Simplicidad ante todo.** El cliente diligencia esto una sola vez y no es
   técnico. Interfaz limpia, poca carga visual, un módulo/sección a la vez.
2. **Guía por campo.** Cada campo tiene un ícono de información (**i**) que
   explica qué ingresar, formato y tamaño requerido. Fácil de encontrar, sin
   saturar la pantalla.
3. **Progreso siempre visible.** Porcentaje diligenciado por módulo y total.
4. **Guardar y continuar.** Autoguardado del avance; el cliente puede salir y
   retomar donde quedó.
5. **Confianza corporativa.** Identidad EGIXIA, nunca apariencia de plantilla.
6. **Tono tranquilo y moderno.** Formulario amigable, mucho espacio en blanco,
   colores suaves. Acompañar, no abrumar.

## Dashboard del invitado

La pantalla `/mi-proyecto` es la puerta de entrada del cliente y sigue
el estilo "cuadritos" con azul EGIXIA como acento:

- **Encabezado**: saludo personalizado, nombre del proyecto y empresa,
  mensaje amable de siguiente paso (p. ej. *“Te faltan 2 módulos”* o
  *“Tienes 1 módulo con observaciones por corregir”*) y **anillo de
  avance general** (promedio del % de sus módulos).
- **Tarjeta por módulo** con ícono, pastilla de estado, barra de
  avance, fecha límite (si aplica) y un botón contextual:
  - *Comenzar* (sin iniciar) · *Continuar* (en diligenciamiento) ·
    *Ver* (en revisión/aprobado) · *Corregir observaciones*
    (destacado en ámbar).
- **Sidebar** con *Inicio* y *Proyectos* (misma estructura que el
  equipo interno). Se evita listar cada módulo en la barra lateral
  porque el catálogo crecerá por encima de 15 módulos y saturaría el
  menú. La gestión de módulos vive dentro del detalle del proyecto.
- **Topbar** con nombre del proyecto, pastilla de fecha límite más
  próxima e indicador de guardado.

### Multiproyecto del invitado

Un invitado puede pertenecer a varios proyectos. `/mi-proyecto/proyectos`
lista los proyectos con su avance general; `/mi-proyecto/proyectos/$id`
abre el detalle con el avance por módulo y los botones contextuales
de siempre. En la home, los ítems de *Próximos a vencer* incluyen el
nombre del proyecto porque un mismo módulo puede aparecer en
proyectos distintos.

### Diligenciamiento de módulos

- **Barra de progreso fija en la parte inferior** mientras se llena
  el formulario, alimentada por el callback `onProgreso` del motor
  de formularios.
- **Envío a revisión**: al enviar, el usuario vuelve al detalle del
  proyecto (`/mi-proyecto/proyectos/$id`) para continuar con el
  siguiente módulo.
- **Previsualización del acta** en un `Dialog` inline con `iframe`
  embebido y botón *Descargar PDF*, para evitar bloqueos de popups y
  de blob URLs por extensiones del navegador.
- **Color corporativo**: en Imagen Corporativa el cliente elige entre
  la paleta predefinida o solicita un **color personalizado**.

### Pastillas de estado

Se usa el componente `<EstadoPastilla />` en dashboard, sidebar y
encabezado de módulo. Colores (Tailwind tokens, no hex directos):

| Estado                | Color                        |
| --------------------- | ---------------------------- |
| `sin_iniciar`         | gris (`slate-100/700`)       |
| `en_diligenciamiento` | azul (`blue-50/700`)         |
| `en_revision`         | azul info (`sky-50/700`)     |
| `con_observaciones`   | ámbar (`amber-50/800`)       |
| `aprobado`            | verde (`emerald-50/700`)     |

## Campos del motor de formularios

El motor renderiza cada **sección como una tarjeta** ("cuadrito") con
título opcional y descripción, y dentro de ella un campo por fila con
bastante aire alrededor. El azul EGIXIA solo aparece como acento:
opción seleccionada, botón primario, ícono "i" en hover.

### Tipos de campo

- **texto / textarea / número / email / url** — inputs estándar de
  shadcn; placeholders discretos, sin ejemplos ruidosos.
- **select** — desplegable para listas cortas y valores conocidos.
- **radio_tarjetas** — opciones de ancho completo como tarjetas
  clickeables (título + descripción), una seleccionable. Se usa para
  decisiones importantes que merecen contexto.
- **color** — fichas con muestra de color + nombre + hex. La opción
  seleccionada se resalta con borde y anillo azul.
- **archivo** — área punteada con ícono de nube y botón "Seleccionar
  archivo". La carga real se completa en la Parte 6.
- **tabla** — tabla dinámica de filas con botón "Añadir fila" y
  papelera por fila.

### Botón de información

Junto a la etiqueta de cada campo, un ícono **"i"** discreto abre un
popover con la guía:

- **Qué ingresar** (siempre).
- **Formato** (opcional).
- **Tamaño recomendado** — resaltado en fondo azul suave cuando
  aplica (imágenes, PDFs).

La guía **no** se muestra expandida por defecto: solo al pulsar el
ícono. Así se evita saturar el formulario cuando el usuario ya sabe
qué ingresar.

### Requeridos y errores

- Los campos requeridos muestran un asterisco `*` en color primario
  junto a la etiqueta.
- La validación de formato ocurre **en línea, debajo del campo**,
  con tono amable y en español (p. ej. *"La dirección debe comenzar
  con https://"*).
- Las validaciones **no bloquean el autoguardado del borrador**. La
  exigencia de campos requeridos completos ocurre solo al *Enviar a
  revisión* (Parte 10).


## Paleta de colores

El Azul Rey es el color de marca y se usa **con mesura**: la interfaz es
calmada, dominada por blancos y grises suaves; el azul aparece en acciones
principales, elementos activos y acentos, nunca como grandes áreas saturadas.

| Rol                          | Hex       | Token CSS / Tailwind        |
| ---------------------------- | --------- | --------------------------- |
| Primario (marca / acciones)  | `#0F2B8E` | `--primary` / `bg-primary`  |
| Primario oscuro (hover)      | `#0b1e62` | `--primary-dark`            |
| Primario claro (fondos)      | `#e8eef8` | `--primary-soft`            |
| Éxito                        | `#00ab4f` | `--success`                 |
| Advertencia                  | `#f59e0b` | `--warning`                 |
| Error                        | `#ef4444` | `--destructive`             |
| Fondo app                    | `#f0f4f8` | `--background`              |
| Tarjetas                     | `#ffffff` | `--card`                    |
| Borde                        | `#d1d9e6` | `--border`                  |
| Texto                        | `#1e2d4f` | `--foreground`              |
| Texto secundario             | `#64748b` | `--muted-foreground`        |

> Los valores se definen en `src/styles.css` en formato `oklch` y se exponen
> como utilidades Tailwind (`bg-primary`, `text-foreground`, etc.). **Nunca**
> se escriben colores hardcodeados en los componentes.

## Tipografía

System font stack, para sentirse nativo en cualquier plataforma:

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif
```

## Componentes clave

- **Tarjetas ("cuadritos")** blancas, esquinas redondeadas (12–16 px), sombra
  muy suave, aire interno generoso. Agrupan campos y formularios.
- **Sidebar izquierdo colapsable** estilo Claude/Linear: ícono + texto,
  colapsable a solo íconos con botón; recuerda su estado entre sesiones. Ítem
  activo en azul suave (`--primary-soft` con texto `--primary`).
- **Ayuda por campo**: ícono `i` a la derecha de la etiqueta, abre popover
  con instrucciones cortas y formato esperado.

## Landing pública (`/`)

La landing es la cara pública de EGIXIA. Debe transmitir confianza
corporativa y estar libre de ruido visual. Estructura:

1. **Topbar** — marca "EGIXIA" a la izquierda (texto, color `--primary`,
   tipografía fuerte) y botón "Ingresar" (relleno primario) a la derecha
   que navega a `/login`.
2. **Hero** — fondo con degradado sutil de `--primary-soft` a
   `--background`, mucho aire, título grande, subtítulo en
   `--muted-foreground` y un CTA primario grande ("Acceder con mi
   invitación"). Sin imágenes recargadas.
3. **"¿Cómo funciona?"** — tres tarjetas blancas en fila (Ingresa,
   Diligencia, Confirma), cada una con ícono simple en `--primary` sobre
   `--primary-soft`, título corto y una línea de descripción.
4. **Pie de página** — fondo `--primary-dark`, texto blanco. Sólo la
   marca "EGIXIA · Portal de Proveedores" y la línea de copyright.

## Layout privado (`/app`)

Layout reutilizable para toda el área privada. Se compone de:

- **Sidebar izquierdo colapsable** (~256 px expandido, ~64 px colapsado)
  con fondo `--sidebar` (primario oscuro EGIXIA) y texto blanco. Arriba
  la marca "EGIXIA Configurator" (reducida a un ícono al colapsar), en
  el medio los ítems de navegación y abajo la zona de usuario (avatar +
  nombre + correo) con la acción "Cerrar sesión". Estado persistido por
  cookie.
- **Topbar sticky** dentro del área de contenido: botón para
  colapsar/expandir el sidebar y título de la sección actual.
- **Área de contenido** con fondo `--background`, padding amplio y
  scroll vertical.

## Idioma

Español neutro LATAM en toda la interfaz.

## Panel del Implementador / Administrador

El panel `/app` está pensado para ser **silencioso y accionable**:
pocas métricas, mucho aire, tarjetas ("cuadritos") sobre fondo
`--background`. El azul EGIXIA se reserva para acentos (íconos,
valores destacados, botones primarios) — nada de fondos saturados.

### Dashboard (`/app`)

- Saludo personalizado y una frase breve de contexto.
- **4 métricas** en tarjetas: *Proyectos activos*, *Pendientes de
  revisión* (acento primario suave), *Próximos a vencer*, *Módulos
  aprobados*. Ícono lucide + etiqueta + valor grande + hint.
- **Gráfica de barras** (recharts) con módulos por estado, en
  primario `#0F2B8E`.
- Dos listas cortas: *Revisiones pendientes* (primeros 5, con
  vínculo directo al módulo) y *Próximos a vencer* (chips coloreados
  por urgencia: rojo si vencido, ámbar ≤3 días, primario suave si
  ≤7 días).

### Proyectos (`/app/proyectos`)

- Barra de búsqueda con lupa y filtro por estado. Vacío = tarjeta
  guiada, no bloque de error.
- Cada proyecto se presenta como una fila-tarjeta con nombre, empresa,
  estado, próxima fecha límite y % de avance promedio.
- El detalle (`/app/proyectos/{id}`) organiza el contenido en
  bloques: encabezado con estado + botones de exportación, módulos
  (cada uno con estado, avance, "Ver/editar" y "Acta vN"), miembros
  (dos sublistas: equipo interno vs invitados) y auditoría reciente.

### Nuevo proyecto (`/app/proyectos/nuevo`)

Formulario en dos bloques: **Datos** (nombre, empresa) y **Módulos a
asignar**. Cada módulo es un cuadrito que se resalta con
`--primary-soft` al activarse, y despliega inline los campos de fecha
límite y comportamiento al vencer.

### Revisiones (`/app/revisiones`)

Cola simple, ordenada por antigüedad. Cada módulo enlaza a la vista
de revisión, donde el implementador aprueba, devuelve con
observaciones, reabre o **edita respuestas** (con banner ámbar que
recuerda que quedará en auditoría).

### Invitaciones (`/app/invitaciones`)

- Formulario compacto de una fila: correo, rol, proyecto (deshabilitado
  cuando el rol es implementador) y botón *Enviar*.
- Debajo, listado con pastilla de estado (`pendiente`, `aceptada`,
  `revocada`, `expirada` — esta última se infiere si el token venció).
  Botones *Reenviar* y *Revocar* solo aparecen mientras la invitación
  esté `pendiente`.