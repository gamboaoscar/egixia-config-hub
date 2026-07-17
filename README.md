# EGIXIA Configurator

Portal de onboarding de **EGIXIA** (SaaS B2B, LATAM) para configurar el
**Portal de Proveedores** (procure-to-pay) de grandes empresas. Reemplaza el
intercambio manual de archivos Excel por formularios web guiados donde los
clientes diligencian toda la información necesaria (identidad visual,
sociedades, dominios, políticas de seguridad, etc.).

**Sitio productivo:** <https://configurador.egixia.app>

## Roles

- **Administrador** — control total del sistema, catálogo, usuarios e invitaciones.
- **Implementador** — consulta, filtra y exporta la información diligenciada.
- **Cliente (invitado)** — diligencia únicamente los formularios de su proyecto.

## Stack técnico

- React 19 + TypeScript
- Vite 7 + TanStack Start / TanStack Router (file-based routing)
- Tailwind CSS v4 + shadcn/ui
- Supabase integrado: autenticación (email + magic link), Postgres con
  RLS extensa (roles admin/implementador/cliente, membresías por
  proyecto) y Storage privado (avatares, logos-clientes, documentos,
  actas — acceso siempre por URL firmada).
- Edge Function `enviar-correo` con plantillas EGIXIA y Resend como
  proveedor SMTP transaccional.
- Generación del acta PDF con `pdf-lib` (server-side, import dinámico).
- Parametrización por proyecto desde el catálogo (secciones y opciones
  habilitables, con regla de protección de datos ya diligenciados).
- Idioma de la interfaz: **español neutro LATAM**

## Portales

- `/app` — equipo interno (admin + implementador): proyectos,
  revisiones, catálogo, usuarios, invitaciones, auditoría.
- `/mi-proyecto` — cliente invitado: solo los proyectos y módulos a
  los que pertenece.
- `/invitacion/$token` — aceptación pública de invitación.

## Estructura de carpetas

```
src/
  components/         Componentes reutilizables (incluye ui/ de shadcn)
    app-sidebar.tsx   Sidebar colapsable del área privada
  routes/             Rutas file-based de TanStack Router
    __root.tsx        Layout raíz (providers globales)
    index.tsx         Landing pública
    login.tsx         Inicio de sesión (temporal)
    app.tsx           Layout del área privada (sidebar + topbar)
    app.index.tsx     Pantalla índice del área privada
  hooks/              Hooks compartidos
  lib/                Utilidades
  styles.css          Tokens de diseño (paleta EGIXIA) y Tailwind v4
docs/                 Documentación viva del proyecto (ES)
```

## Documentación

La documentación viva del proyecto (español) vive en [`/docs`](./docs)
y se actualiza en cada entrega:

- [`ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — visión general,
  frontend, backend, motor de formularios, archivos, despliegue.
- [`MODELO_DE_DATOS.md`](./docs/MODELO_DE_DATOS.md) — tablas, enums,
  funciones, triggers y buckets de Storage.
- [`FLUJO_Y_ESTADOS.md`](./docs/FLUJO_Y_ESTADOS.md) — flujo de
  invitación, diligenciamiento, revisión y acta.
- [`MODULOS.md`](./docs/MODULOS.md) — catálogo de módulos y campos.
- [`ROLES_Y_PERMISOS.md`](./docs/ROLES_Y_PERMISOS.md) — matriz de
  permisos y acciones exclusivas del administrador.
- [`GUIA_UX.md`](./docs/GUIA_UX.md) — lineamientos de UX y copy.
- [`SEGURIDAD.md`](./docs/SEGURIDAD.md) — RLS, auditoría, buckets.
- [`DECISIONES.md`](./docs/DECISIONES.md) — ADR.
- [`QA_LOG.md`](./docs/QA_LOG.md) — bitácora de pruebas.
- [`CHANGELOG.md`](./docs/CHANGELOG.md) — historial de versiones.