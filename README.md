# EGIXIA Configurator

Portal de onboarding de **EGIXIA** (SaaS B2B, LATAM) para configurar el
**Portal de Proveedores** (procure-to-pay) de grandes empresas. Reemplaza el
intercambio manual de archivos Excel por formularios web guiados donde los
clientes diligencian toda la información necesaria (identidad visual,
sociedades, dominios, políticas de seguridad, etc.).

## Roles

- **Administrador** — control total del sistema, catálogo, usuarios e invitaciones.
- **Implementador** — consulta, filtra y exporta la información diligenciada.
- **Cliente (invitado)** — diligencia únicamente los formularios de su proyecto.

## Stack técnico

- React 19 + TypeScript
- Vite 7 + TanStack Start / TanStack Router (file-based routing)
- Tailwind CSS v4 + shadcn/ui
- Supabase (auth, base de datos, almacenamiento) — se integrará más adelante
- Idioma de la interfaz: **español neutro LATAM**

## Estructura de carpetas

```
src/
  components/         Componentes reutilizables (incluye ui/ de shadcn)
    app-sidebar.tsx   Sidebar colapsable de la aplicación
  routes/             Rutas file-based de TanStack Router
    __root.tsx        Layout raíz (sidebar + header + contenido)
    index.tsx         Pantalla de bienvenida
  hooks/              Hooks compartidos
  lib/                Utilidades
  styles.css          Tokens de diseño (paleta EGIXIA) y Tailwind v4
docs/                 Documentación viva del proyecto (ES)
```

## Documentación

La documentación vive en [`/docs`](./docs) y se mantiene actualizada en cada
entrega. Ver especialmente [`docs/GUIA_UX.md`](./docs/GUIA_UX.md) y
[`docs/CHANGELOG.md`](./docs/CHANGELOG.md).