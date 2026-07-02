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