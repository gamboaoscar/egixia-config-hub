import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * URL base canónica del portal EGIXIA para enlaces incluidos en correos.
 *
 * Prioridad:
 *   1. `configuracion_sistema.clave='parametros'` → `valor->>'site_url'`
 *      (cacheado en memoria por 60s para no golpear la BD en cada envío).
 *   2. `process.env.PUBLIC_SITE_URL` / `process.env.SITE_URL`.
 *   3. Fallback `https://configurador.egixia.app`.
 */

const FALLBACK = "https://configurador.egixia.app";
const TTL_MS = 60_000;
let cache: { value: string; at: number } | null = null;

export async function siteUrlCanonico(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  let value = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || FALLBACK;
  try {
    const { data } = await supabaseAdmin
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "parametros")
      .maybeSingle();
    const cfg = (data?.valor ?? null) as { site_url?: unknown } | null;
    const siteUrl = typeof cfg?.site_url === "string" ? cfg.site_url.trim() : "";
    if (siteUrl) value = siteUrl;
  } catch {
    /* si no se puede leer la config, usamos el fallback */
  }
  value = value.replace(/\/$/, "");
  cache = { value, at: now };
  return value;
}

export function invalidarCacheSiteUrl() {
  cache = null;
}