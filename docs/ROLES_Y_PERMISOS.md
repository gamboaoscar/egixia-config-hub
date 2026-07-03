# Roles y permisos

Los roles se persisten en `profiles.rol` (enum `app_role`) y el estado
en `profiles.estado` (enum `user_estado`).

## Administrador (`admin`)

Control total: usuarios, clientes/proyectos, catálogo de módulos y campos,
fechas límite, invitaciones. Es el único que puede cambiar `rol` y
`estado` de otras cuentas y eliminar perfiles.

## Implementador (`implementador`)

Consulta formularios diligenciados, ve avance por formulario y global,
filtra y exporta. Puede leer todos los perfiles y la auditoría. No
modifica el catálogo del sistema ni gestiona usuarios.

## Cliente (`cliente`)

Diligencia únicamente los formularios de su propio proyecto. Puede guardar y
continuar más tarde, y confirmar al finalizar. Nunca ve auditoría ni
vistas internas.

Un mismo `cliente`/invitado puede tener membresía activa en varios
proyectos. Su sidebar muestra *Inicio* y *Proyectos* (misma estructura
que el equipo interno) y accede a cada proyecto en
`/mi-proyecto/proyectos/$id`, con avance general por proyecto en el
listado y avance por módulo en el detalle. En la home, la sección
"Próximos a vencer" incluye el nombre del proyecto junto al módulo,
porque el mismo módulo puede repetirse entre proyectos.

El `implementador` también puede editar los módulos de los proyectos
de los invitados (con auditoría), no solo consultarlos.

## Redirección tras iniciar sesión

| Rol             | Destino inicial |
| --------------- | --------------- |
| `admin`         | `/app`          |
| `implementador` | `/app`          |
| `cliente`       | `/mi-proyecto`  |

- Sin sesión → `/login` (la ruta original se guarda en `?next=`).
- Un `cliente` que intente abrir `/app/*` se redirige a `/mi-proyecto`.
- Un `admin`/`implementador` que intente abrir `/mi-proyecto/*` se
  redirige a `/app`.
- Una cuenta `inhabilitada` se desconecta automáticamente al iniciar
  sesión y no puede acceder.

## Matriz de permisos (resumen)

| Acción                              | Admin | Implementador | Cliente |
| ----------------------------------- | :---: | :-----------: | :-----: |
| Leer todos los perfiles             |   ✓   |       ✓       |   —    |
| Leer/editar el propio perfil        |   ✓   |       ✓       |   ✓    |
| Cambiar `rol` / `estado` / borrar   |   ✓   |       —       |   —    |
| Leer la auditoría                   |   ✓   |       ✓       |   —    |
| Insertar en auditoría (vía helper)  |   ✓   |       ✓       |   ✓    |

## Acciones del panel del Implementador / Administrador

El área privada `/app` está reservada a `admin` e `implementador`.
`PrivateShell` bloquea el acceso de cualquier otro rol.

| Acción del panel                        | Admin | Implementador |
| --------------------------------------- | :---: | :-----------: |
| Ver dashboard con métricas globales     |   ✓   |       ✓       |
| Ver **todos** los proyectos             |   ✓   |       ✓       |
| Crear proyecto (nombre, empresa, mods.) |   ✓   |       ✓       |
| Editar respuestas de un módulo (audit.) |   ✓   |       ✓       |
| Ver / descargar actas versionadas       |   ✓   |       ✓       |
| Exportar proyecto (JSON / CSV)          |   ✓   |       ✓       |
| Enviar invitación (implementador/inv.)  |   ✓   |       ✓       |
| Reenviar o revocar invitación pendiente |   ✓   |       ✓       |
| Inhabilitar / reactivar miembro         |   ✓   |       ✓       |
| Desvincular invitado de un proyecto     |   ✓   |       ✓       |

> El implementador puede crear, reenviar y revocar invitaciones,
> pero **no ve el token en claro**: la lectura de la tabla
> `invitaciones` está restringida a `admin`. Toda la gestión pasa
> por server functions que devuelven metadatos (email, rol, estado,
> expiración) sin exponer el enlace de aceptación.

Todas las mutaciones anteriores se realizan mediante server functions
en `src/lib/admin.functions.ts`, que verifican el rol del llamante y
registran cada acción en la tabla `auditoria` (RPC
`registrar_auditoria`). El invitado nunca ve estas rutas ni las
funciones — se guarda por `PrivateShell` + validación server-side.
## Acciones exclusivas del Administrador

| Acción                                          | Admin | Implementador |
|-------------------------------------------------|:-----:|:-------------:|
| Cambiar rol de un usuario                       |  ✅   |      ❌       |
| Habilitar / inhabilitar cuenta                  |  ✅   |      ❌       |
| Eliminar cuenta de usuario                      |  ✅   |      ❌       |
| Eliminar proyecto (y su información)            |  ✅   |      ❌       |
| Editar catálogo (overrides por proyecto)        |  ✅   |      ❌       |
| Configurar branding / correo / parámetros       |  ✅   |      ❌       |
| Consultar auditoría global y exportarla         |  ✅   |      ✅       |
| Invitar usuarios internos                       |  ✅   |      ✅       |

Las mutaciones sensibles se ejecutan en server functions
(`src/lib/admin.functions.ts`) que verifican el rol del llamante contra
`profiles.rol` antes de tocar la base o el servicio de Auth.

## Doble capa de autorización en `/app`

El acceso al área privada del equipo interno (`/app/*`) se protege en
dos capas:

1. **Servidor**: el `beforeLoad` de `src/routes/app.tsx` invoca
   `exigirEquipoInterno` (`src/lib/rbac.functions.ts`), una server
   function con `requireSupabaseAuth` que consulta `profiles.rol` y
   lanza `redirect` si el usuario no es `admin`/`implementador`.
2. **Cliente**: `PrivateShell` mantiene la lógica de UX (loader, toast
   y redirección amigable). Un cliente que intente saltarse el redirect
   del navegador es rechazado por el `beforeLoad` antes de renderizar.

Los invitados siempre son redirigidos a `/mi-proyecto`, cuya UI
depende de RLS: solo ven proyectos donde tienen membresía activa.
