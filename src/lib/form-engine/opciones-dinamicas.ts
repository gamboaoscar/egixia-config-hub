import type {
  CampoDefinicion,
  ColumnaTabla,
  ModuloDefinicion,
  OpcionesDesde,
} from "./tipos";

/**
 * Opciones dinámicas entre módulos.
 *
 * Un campo (o columna de tabla) puede declarar `opcionesDesde`
 * (`{ moduloKey, campoKey }`): sus `opciones` estáticas se filtran
 * dejando solo las que el cliente marcó en el campo `checkbox_multiple`
 * de otro módulo del mismo proyecto (p. ej. el select de "Rol" en
 * Usuarios internos solo ofrece los roles marcados en Seguridad).
 *
 * `resolverOpcionesDinamicas` es un helper PURO: no muta la definición
 * original ni realiza I/O; recibe un lector de datos por módulo y
 * devuelve una nueva definición con las opciones ya resueltas.
 */

/** Extrae la selección (array de strings no vacío) del módulo origen. */
function seleccionDelOrigen(
  desde: OpcionesDesde,
  obtenerDatos: (moduloKey: string) => Record<string, unknown> | null,
): Set<string> | null {
  const datos = obtenerDatos(desde.moduloKey);
  if (!datos) return null;
  const valor = datos[desde.campoKey];
  if (!Array.isArray(valor)) return null;
  const seleccion = valor.filter((v): v is string => typeof v === "string");
  if (seleccion.length === 0) return null;
  return new Set(seleccion);
}

/**
 * Filtra las opciones de un campo o columna según `opcionesDesde`.
 * Devuelve el mismo objeto si no hay nada que filtrar (sin mutar).
 * Si la intersección quedara vacía (selección del origen sin
 * correspondencia con las opciones estáticas), se conservan las
 * opciones completas para no dejar el control inutilizable.
 */
function filtrarItem<T extends CampoDefinicion | ColumnaTabla>(
  item: T,
  obtenerDatos: (moduloKey: string) => Record<string, unknown> | null,
): T {
  if (!item.opcionesDesde || !item.opciones || item.opciones.length === 0) {
    return item;
  }
  const seleccion = seleccionDelOrigen(item.opcionesDesde, obtenerDatos);
  if (!seleccion) return item;
  const filtradas = item.opciones.filter((o) => seleccion.has(o.valor));
  if (filtradas.length === 0) return item;
  if (filtradas.length === item.opciones.length) return item;
  return { ...item, opciones: filtradas };
}

/**
 * Recorre campos y columnas de la definición y resuelve `opcionesDesde`
 * contra los datos de los módulos del mismo proyecto.
 *
 * @param definicion   Definición (base o con overrides ya aplicados).
 * @param obtenerDatos Lector de `proyecto_modulos.datos` por `modulo_key`
 *                     (devuelve `null` si el módulo no existe en el proyecto).
 */
export function resolverOpcionesDinamicas(
  definicion: ModuloDefinicion,
  obtenerDatos: (moduloKey: string) => Record<string, unknown> | null,
): ModuloDefinicion {
  return {
    ...definicion,
    secciones: definicion.secciones.map((seccion) => ({
      ...seccion,
      campos: seccion.campos.map((campo) => {
        const campoFiltrado = filtrarItem(campo, obtenerDatos);
        if (!campoFiltrado.columnas) return campoFiltrado;
        const columnas = campoFiltrado.columnas.map((col) =>
          filtrarItem(col, obtenerDatos),
        );
        return { ...campoFiltrado, columnas };
      }),
    })),
  };
}
