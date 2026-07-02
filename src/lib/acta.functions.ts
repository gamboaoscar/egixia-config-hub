import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server functions cliente-callables para el acta (Parte 13):
 *
 * - `previsualizarActa`: renderiza en memoria el PDF actual (sin
 *   persistir versión) y lo devuelve en base64 para descargar o abrir
 *   en el navegador. Se usa desde el portal del invitado antes de
 *   enviar el módulo a revisión.
 * - `descargarActaFirmada`: devuelve la URL firmada (7 días) del acta
 *   última persistida en Storage. Sirve para revisores internos y para
 *   el invitado tras enviar el módulo.
 */

const idSchema = z.object({ moduloId: z.string().uuid() });

export const previsualizarActa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Autorización: miembro del proyecto o rol interno.
    const { data: modulo } = await supabaseAdmin
      .from("proyecto_modulos")
      .select("id, proyecto_id")
      .eq("id", data.moduloId)
      .maybeSingle();
    if (!modulo) throw new Error("El módulo no existe.");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("rol")
      .eq("id", userId)
      .maybeSingle();
    const rol = perfil?.rol as "admin" | "implementador" | "cliente" | undefined;
    if (rol !== "admin" && rol !== "implementador") {
      const { data: mem } = await supabaseAdmin
        .from("proyecto_miembros")
        .select("profile_id")
        .eq("proyecto_id", modulo.proyecto_id)
        .eq("profile_id", userId)
        .eq("estado", "activo")
        .maybeSingle();
      if (!mem) throw new Error("No tienes acceso a este proyecto.");
    }

    // Versión propuesta = siguiente al histórico (para vista previa).
    const { data: previa } = await supabaseAdmin
      .from("actas")
      .select("version")
      .eq("proyecto_modulo_id", data.moduloId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = ((previa?.version as number | undefined) ?? 0) + 1;

    const { construirDatosActa } = await import("@/lib/acta/acta.server");
    const { generarActaPDF, bytesABase64 } = await import(
      "@/lib/acta/acta-pdf"
    );
    const datos = await construirDatosActa(data.moduloId, userId, version);
    const bytes = await generarActaPDF(datos);
    return {
      base64: bytesABase64(bytes),
      version,
      filename: `acta-${data.moduloId}-v${version}.pdf`,
    };
  });

export const descargarActaFirmada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: modulo } = await supabaseAdmin
      .from("proyecto_modulos")
      .select("id, proyecto_id")
      .eq("id", data.moduloId)
      .maybeSingle();
    if (!modulo) throw new Error("El módulo no existe.");

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("rol")
      .eq("id", userId)
      .maybeSingle();
    const rol = perfil?.rol as "admin" | "implementador" | "cliente" | undefined;
    if (rol !== "admin" && rol !== "implementador") {
      const { data: mem } = await supabaseAdmin
        .from("proyecto_miembros")
        .select("profile_id")
        .eq("proyecto_id", modulo.proyecto_id)
        .eq("profile_id", userId)
        .eq("estado", "activo")
        .maybeSingle();
      if (!mem) throw new Error("No tienes acceso a este proyecto.");
    }

    const { ultimaActa, urlFirmadaActa } = await import(
      "@/lib/acta/acta.server"
    );
    const acta = await ultimaActa(data.moduloId);
    if (!acta) return { url: null, version: null };
    const url = await urlFirmadaActa(acta.archivoUrl);
    return { url, version: acta.version };
  });