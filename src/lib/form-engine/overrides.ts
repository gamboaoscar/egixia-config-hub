import type { CampoDefinicion, ModuloDefinicion, GuiaCampo } from "./tipos";

export interface CampoOverride {
  modulo_key: string;
  campo_key: string;
  activo?: boolean | null;
  label?: string | null;
  guia?: Partial<GuiaCampo> | null;
  requerido?: boolean | null;
}

/**
 * Aplica los overrides administrativos a la definición estática de un
 * módulo. Los campos con `activo === false` se marcan como inactivos,
 * de modo que el motor de formularios los ignora tanto para renderizado
 * como para cálculo de progreso y validación.
 */
export function aplicarOverrides(
  def: ModuloDefinicion,
  overrides: CampoOverride[],
): ModuloDefinicion {
  if (!overrides || overrides.length === 0) return def;
  const map = new Map<string, CampoOverride>();
  for (const o of overrides) {
    if (o.modulo_key !== def.key) continue;
    map.set(o.campo_key, o);
  }
  if (map.size === 0) return def;
  const secciones = def.secciones.map((s) => ({
    ...s,
    campos: s.campos.map((c) => aplicarACampo(c, map.get(c.key))),
  }));
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
    next.guia = { ...(campo.guia ?? { que: "" }), ...o.guia } as GuiaCampo;
  }
  return next;
}
