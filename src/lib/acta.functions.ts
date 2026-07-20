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
const descargaSchema = z.object({
  moduloId: z.string().uuid(),
  version: z.number().int().positive().optional(),
});

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
  .validator((input: unknown) => descargaSchema.parse(input))
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

    const { ultimaActa, descargarBytesActa } = await import(
      "@/lib/acta/acta.server"
    );
    let acta: { version: number; archivoUrl: string } | null;
    if (data.version) {
      const { data: row } = await supabaseAdmin
        .from("actas")
        .select("version, archivo_url")
        .eq("proyecto_modulo_id", data.moduloId)
        .eq("version", data.version)
        .maybeSingle();
      acta = row
        ? { version: row.version as number, archivoUrl: row.archivo_url as string }
        : null;
      if (!acta) return { base64: null, version: null, filename: null };
    } else {
      acta = await ultimaActa(data.moduloId);
    }
    if (!acta) {
      // Autoreparación: si el módulo ya fue enviado/aprobado pero por
      // alguna razón no quedó persistida el acta, la generamos ahora.
      const { data: mod } = await supabaseAdmin
        .from("proyecto_modulos")
        .select("estado, enviado_por")
        .eq("id", data.moduloId)
        .maybeSingle();
      const estadosConActa = ["en_revision", "aprobado", "con_observaciones"];
      if (mod && estadosConActa.includes(mod.estado as string)) {
        const { renderYSubirActa } = await import("@/lib/acta/acta.server");
        const autor = (mod.enviado_por as string | null) ?? userId;
        try {
          const { version, archivoUrl } = await renderYSubirActa(
            data.moduloId,
            autor,
          );
          acta = { version, archivoUrl };
        } catch (err) {
          console.error("[descargarActaFirmada] auto-regen falló", err);
          return { base64: null, version: null, filename: null };
        }
      } else {
        return { base64: null, version: null, filename: null };
      }
    }
    const bytes = await descargarBytesActa(acta.archivoUrl);
    if (!bytes) return { base64: null, version: null, filename: null };
    const { bytesABase64 } = await import("@/lib/acta/acta-pdf");
    return {
      base64: bytesABase64(bytes),
      version: acta.version,
      filename: `acta-${data.moduloId}-v${acta.version}.pdf`,
    };
  });

/**
 * Lista todas las versiones del acta de un módulo, resolviendo el nombre
 * del generador. Misma autorización que `descargarActaFirmada`: rol
 * interno o miembro activo del proyecto.
 */
export const listarActas = createServerFn({ method: "POST" })
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

    const { data: rows } = await supabaseAdmin
      .from("actas")
      .select("version, generada_at, generada_por")
      .eq("proyecto_modulo_id", data.moduloId)
      .order("version", { ascending: false });
    const filas = (rows ?? []) as Array<{
      version: number;
      generada_at: string;
      generada_por: string | null;
    }>;
    const ids = Array.from(
      new Set(filas.map((r) => r.generada_por).filter((v): v is string => !!v)),
    );
    const autores: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nombre, apellido, email")
        .in("id", ids);
      for (const p of profs ?? []) {
        const n = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
        autores[p.id as string] = n || (p.email as string) || "Usuario";
      }
    }
    return filas.map((r) => ({
      version: r.version,
      generada_at: r.generada_at,
      autor: r.generada_por ? autores[r.generada_por] ?? "Usuario" : "Sistema",
    }));
  });