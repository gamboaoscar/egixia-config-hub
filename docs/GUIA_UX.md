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

## Idioma

Español neutro LATAM en toda la interfaz.