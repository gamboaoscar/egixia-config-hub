import type { CampoDefinicion, ModuloDefinicion, GuiaCampo } from "./tipos";

export interface CampoOverride {
  modulo_key: string;
  campo_key: string;
  activo?: boolean | null;
  label?: string | null;
  guia?: Partial<GuiaCampo> | null;
  requerido?: boolean | null;
  opciones_permitidas?: string[] | null;
}

export interface SeccionOverride {
  modulo_key: string;
  seccion_key: string;
  habilitada: boolean;
  obligatoria: boolean | null;
}

/**
 * Aplica los overrides administrativos a la definición estática de un
 * módulo. Los campos con `activo === false` se marcan como inactivos,
 * de modo que el motor de formularios los ignora tanto para renderizado
 * como para cálculo de progreso y validación.
 *
 * Si se entregan `seccionOverrides`, las secciones con `habilitada=false`
 * se ELIMINAN de la definición resultante (no se renderizan, no cuentan
 * para progreso/validación, no salen en el acta; los datos guardados
 * NUNCA se tocan). Si `obligatoria === false`, todos los campos de la
 * sección pasan a `requerido: false`.
 */
export function aplicarOverrides(
  def: ModuloDefinicion,
  overrides: CampoOverride[],
  seccionOverrides?: SeccionOverride[],
): ModuloDefinicion {
  const map = new Map<string, CampoOverride>();
  for (const o of overrides ?? []) {
    if (o.modulo_key !== def.key) continue;
    map.set(o.campo_key, o);
  }
  const secMap = new Map<string, SeccionOverride>();
  for (const s of seccionOverrides ?? []) {
    if (s.modulo_key !== def.key) continue;
    secMap.set(s.seccion_key, s);
  }
  if (map.size === 0 && secMap.size === 0) return def;

  const secciones = def.secciones
    .filter((s) => {
      const ov = secMap.get(s.key);
      return !ov || ov.habilitada !== false;
    })
    .map((s) => {
      const secOv = secMap.get(s.key);
      const forzarNoRequerido = secOv?.obligatoria === false;
      return {
        ...s,
        campos: s.campos.map((c) => {
          let campo = aplicarACampo(c, map.get(c.key));
          campo = aplicarGuiaColumnas(campo, map);
          if (forzarNoRequerido && campo.requerido) {
            campo = { ...campo, requerido: false };
          }
          return campo;
        }),
      };
    });
  return { ...def, secciones };
}

function aplicarACampo(
  campo: CampoDefinicion,
  o: CampoOverride | undefined,
): CampoDefinicion {
  if (!o) return campo;
  const next: CampoDefinicion = { ...campo };
  if (o.activo === false) next.activo = false;
  if (o.activo === true) next.activo = true;
  if (typeof o.label === "string" && o.label.trim().length > 0) next.label = o.label;
  if (typeof o.requerido === "boolean") next.requerido = o.requerido;
  if (o.guia && typeof o.guia === "object") {
    // Fusión con el objeto override COMPLETO: el spread transporta todas
    // las claves de la guía enriquecida (que, formato, tamano, titulo,
    // imagenes). Una clave presente en el override —aunque sea cadena
    // vacía o arreglo vacío— reemplaza a la de la definición estática.
    next.guia = { ...(campo.guia ?? { que: "" }), ...o.guia } as GuiaCampo;
  }
  if (Array.isArray(o.opciones_permitidas) && Array.isArray(campo.opciones)) {
    const permitidas = new Set(o.opciones_permitidas);
    next.opciones = campo.opciones.filter((op) => permitidas.has(op.valor));
  }
  return next;
}

/**
 * Overrides de guía para columnas de tabla. Convención: la fila de
 * `catalogo_overrides` usa `campo_key = "<campoKey>.<columnaKey>"` y solo
 * transporta `guia`. Cualquier otra propiedad de esas filas se ignora.
 */
function aplicarGuiaColumnas(
  campo: CampoDefinicion,
  map: Map<string, CampoOverride>,
): CampoDefinicion {
  if (campo.tipo !== "tabla" || !campo.columnas?.length) return campo;
  let cambio = false;
  const columnas = campo.columnas.map((col) => {
    const o = map.get(`${campo.key}.${col.key}`);
    if (!o?.guia || typeof o.guia !== "object") return col;
    cambio = true;
    return {
      ...col,
      guia: { ...(col.guia ?? { que: "" }), ...o.guia } as GuiaCampo,
    };
  });
  return cambio ? { ...campo, columnas } : campo;
}
