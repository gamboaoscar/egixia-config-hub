import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import {
  campoActivo,
  campoVisible,
  valorLleno,
} from "@/lib/form-engine/validacion";
import type { TipoCorreo } from "@/lib/acta/plantillas-correo";

/**
 * Servidor de transiciones del flujo de revisión por módulo (Sección B).
 *
 * Todas las mutaciones se hacen con `supabaseAdmin` porque:
 *   - Un invitado no puede subir un módulo a `en_revision` por RLS
 *     (la política de UPDATE le exige mantener el estado en el conjunto
 *     editable).
 *   - Solo admin/implementador puede escribir en `observaciones` y
 *     `actas`.
 *   - Un invitado, al reenviar, debe poder marcar sus observaciones
 *     como `resuelta` — algo que su rol tampoco puede hacer por RLS.
 *
 * Cada función autoriza al llamante en código, registra la transición
 * en `auditoria` y encola una notificación a los destinatarios del
 * proyecto (que hoy queda registrada en `auditoria` como
 * `notificacion_pendiente`; cuando se conecte un proveedor de correo
 * este helper enviará el mail real).
 */

// ---------- Autorización y helpers -----------------------------------------

type Rol = "admin" | "implementador" | "cliente";

interface AdminClient {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function cargarModulo(admin: AdminClient, moduloId: string) {
  const { data, error } = await admin
    .from("proyecto_modulos")
    .select("id, proyecto_id, modulo_key, estado, datos, progreso")
    .eq("id", moduloId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el módulo.");
  if (!data) throw new Error("El módulo no existe.");
  return data as {
    id: string;
    proyecto_id: string;
    modulo_key: string;
    estado:
      | "sin_iniciar"
      | "en_diligenciamiento"
      | "en_revision"
      | "con_observaciones"
      | "aprobado";
    datos: Record<string, unknown>;
    progreso: number;
  };
}

async function rolDelUsuario(
  admin: AdminClient,
  userId: string,
): Promise<Rol> {
  const { data, error } = await admin
    .from("profiles")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("No se pudo verificar el rol del usuario.");
  return data.rol as Rol;
}

async function esMiembroDelProyecto(
  admin: AdminClient,
  userId: string,
  proyectoId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("proyecto_miembros")
    .select("profile_id")
    .eq("proyecto_id", proyectoId)
    .eq("profile_id", userId)
    .eq("estado", "activo")
    .maybeSingle();
  return !!data;
}

/** Registra una entrada en auditoria (RPC ya existente). */
async function auditar(
  admin: AdminClient,
  accion: string,
  entidadId: string,
  detalle: Record<string, unknown>,
) {
  await (admin as any).rpc("registrar_auditoria", {
    _accion: accion,
    _entidad: "proyecto_modulo",
    _entidad_id: entidadId,
    _detalle: detalle,
  });
}

/**
 * Notifica a los destinatarios del proyecto usando la plantilla
 * correspondiente y la Edge Function `enviar-correo`. Toda la lógica
 * vive en `acta/notificaciones.server.ts` (server-only).
 */
async function notificar(input: {
  proyectoId: string;
  moduloId: string;
  moduloNombre: string;
  tipo: TipoCorreo;
  proyectoNombre: string;
  empresa: string | null;
  actorNombre: string;
  actaVersion?: number;
  actaUrl?: string;
  observacionesCount?: number;
}) {
  const { notificarProyecto } = await import("@/lib/acta/notificaciones.server");
  const urlAppPath = `/app/modulo/${input.moduloId}`;
  const urlMiProyectoPath = `/mi-proyecto/modulo/${input.moduloId}`;
  const contextoBase =
    input.tipo === "acta_envio"
      ? {
          acta: {
            proyecto: input.proyectoNombre,
            empresa: input.empresa,
            moduloNombre: input.moduloNombre,
            version: input.actaVersion ?? 1,
            autorNombre: input.actorNombre,
            urlActa: input.actaUrl,
          },
        }
      : input.tipo === "acta_devolucion"
        ? {
            observaciones: {
              proyecto: input.proyectoNombre,
              moduloNombre: input.moduloNombre,
              cantidad: input.observacionesCount ?? 0,
            },
          }
        : input.tipo === "acta_aprobacion"
          ? {
              aprobacion: {
                proyecto: input.proyectoNombre,
                moduloNombre: input.moduloNombre,
              },
            }
          : {};
  await notificarProyecto({
    proyectoId: input.proyectoId,
    moduloId: input.moduloId,
    tipo: input.tipo,
    contextoBase,
    urlAppPath,
    urlMiProyectoPath,
  });
}

/**
 * Genera una nueva versión de acta (PDF real) para el módulo:
 * renderiza el PDF con `pdf-lib`, lo sube al bucket privado `actas`
 * y registra la versión en la tabla `actas`.
 */
async function generarActa(
  admin: AdminClient,
  moduloId: string,
  actorId: string,
): Promise<{ version: number; archivoUrl: string; urlFirmada: string | null }> {
  void admin; // parámetro conservado por consistencia; usamos supabaseAdmin.
  const { renderYSubirActa, urlFirmadaActa } = await import(
    "@/lib/acta/acta.server"
  );
  const { version, archivoUrl } = await renderYSubirActa(moduloId, actorId);
  const urlFirmada = await urlFirmadaActa(archivoUrl);
  return { version, archivoUrl, urlFirmada };
}

/** Metadatos del proyecto y del autor usados al enviar/reenviar. */
async function metadatosProyecto(admin: AdminClient, proyectoId: string) {
  const { data } = await admin
    .from("proyectos")
    .select("nombre, empresa")
    .eq("id", proyectoId)
    .maybeSingle();
  return {
    nombre: (data?.nombre as string | undefined) ?? "Proyecto",
    empresa: (data?.empresa as string | null | undefined) ?? null,
  };
}

async function nombreActor(admin: AdminClient, actorId: string) {
  const { data } = await admin
    .from("profiles")
    .select("nombre, apellido, email")
    .eq("id", actorId)
    .maybeSingle();
  const full = [data?.nombre, data?.apellido].filter(Boolean).join(" ");
  return full || (data?.email as string | undefined) || "Usuario";
}

// ---------- Enviar a revisión (invitado) -----------------------------------

const idSchema = z.object({ moduloId: z.string().uuid() });

export const enviarModuloARevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const modulo = await cargarModulo(supabaseAdmin, data.moduloId);

    // Autorización: miembro del proyecto o admin/implementador.
    const rol = await rolDelUsuario(supabaseAdmin, userId);
    const esInterno = rol === "admin" || rol === "implementador";
    if (!esInterno) {
      const miembro = await esMiembroDelProyecto(
        supabaseAdmin,
        userId,
        modulo.proyecto_id,
      );
      if (!miembro) throw new Error("No tienes acceso a este proyecto.");
    }

    // Estado válido para enviar.
    if (
      modulo.estado !== "sin_iniciar" &&
      modulo.estado !== "en_diligenciamiento" &&
      modulo.estado !== "con_observaciones"
    ) {
      throw new Error(
        "El módulo no está en un estado que permita enviarlo a revisión.",
      );
    }

    // Revalidación server-side: todos los requeridos activos y visibles
    // deben estar llenos.
    const definicion = definicionModulo(modulo.modulo_key);
    const faltantes: string[] = [];
    for (const seccion of definicion.secciones) {
      for (const c of seccion.campos) {
        if (!campoActivo(c)) continue;
        if (c.tipo === "info") continue;
        if (!campoVisible(c, modulo.datos)) continue;
        if (!c.requerido) continue;
        if (!valorLleno(modulo.datos[c.key])) faltantes.push(c.key);
      }
    }
    if (faltantes.length > 0) {
      throw new Error(
        `Faltan ${faltantes.length} campo(s) requerido(s) por completar.`,
      );
    }

    const ahora = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .update({
        estado: "en_revision",
        enviado_at: ahora,
        enviado_por: userId,
      })
      .eq("id", modulo.id);
    if (updErr) throw new Error("No se pudo enviar el módulo a revisión.");

    const version = await generarActa(supabaseAdmin, modulo.id, userId);
    await auditar(supabaseAdmin, "modulo_enviado_revision", modulo.id, {
      proyecto_id: modulo.proyecto_id,
      modulo_key: modulo.modulo_key,
      acta_version: version,
    });
    await notificar(
      supabaseAdmin,
      modulo.proyecto_id,
      modulo.id,
      `Módulo enviado a revisión: ${modulo.modulo_key}`,
      `El módulo "${modulo.modulo_key}" fue enviado a revisión. Se generó el acta v${version}.`,
    );

    return { ok: true, acta_version: version };
  });

// ---------- Aprobar (interno) ---------------------------------------------

export const aprobarModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const rol = await rolDelUsuario(supabaseAdmin, userId);
    if (rol !== "admin" && rol !== "implementador") {
      throw new Error("Solo el equipo de EGIXIA puede aprobar módulos.");
    }

    const modulo = await cargarModulo(supabaseAdmin, data.moduloId);
    if (modulo.estado !== "en_revision") {
      throw new Error("Solo se aprueban módulos que están en revisión.");
    }

    const { error: updErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .update({
        estado: "aprobado",
        revisado_at: new Date().toISOString(),
        revisado_por: userId,
      })
      .eq("id", modulo.id);
    if (updErr) throw new Error("No se pudo aprobar el módulo.");

    await auditar(supabaseAdmin, "modulo_aprobado", modulo.id, {
      proyecto_id: modulo.proyecto_id,
      modulo_key: modulo.modulo_key,
    });
    await notificar(
      supabaseAdmin,
      modulo.proyecto_id,
      modulo.id,
      `Módulo aprobado: ${modulo.modulo_key}`,
      `El módulo "${modulo.modulo_key}" fue aprobado por el equipo de EGIXIA.`,
    );

    return { ok: true };
  });

// ---------- Devolver con observaciones (interno) ---------------------------

const devolverSchema = z.object({
  moduloId: z.string().uuid(),
  observaciones: z
    .array(
      z.object({
        campo_key: z.string().trim().min(1, "Indica el campo observado."),
        comentario: z
          .string()
          .trim()
          .min(3, "El comentario es demasiado corto.")
          .max(1000),
      }),
    )
    .min(1, "Añade al menos una observación."),
});

export const devolverModuloConObservaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => devolverSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const rol = await rolDelUsuario(supabaseAdmin, userId);
    if (rol !== "admin" && rol !== "implementador") {
      throw new Error("Solo el equipo de EGIXIA puede devolver módulos.");
    }

    const modulo = await cargarModulo(supabaseAdmin, data.moduloId);
    if (modulo.estado !== "en_revision") {
      throw new Error(
        "Solo se devuelven con observaciones módulos que están en revisión.",
      );
    }

    const filas = data.observaciones.map((o) => ({
      proyecto_modulo_id: modulo.id,
      campo_key: o.campo_key,
      comentario: o.comentario,
      estado: "abierta" as const,
      created_by: userId,
    }));
    const { error: obsErr } = await supabaseAdmin
      .from("observaciones")
      .insert(filas);
    if (obsErr) throw new Error("No se pudieron registrar las observaciones.");

    const { error: updErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .update({
        estado: "con_observaciones",
        revisado_at: new Date().toISOString(),
        revisado_por: userId,
      })
      .eq("id", modulo.id);
    if (updErr) throw new Error("No se pudo actualizar el módulo.");

    await auditar(
      supabaseAdmin,
      "modulo_devuelto_con_observaciones",
      modulo.id,
      {
        proyecto_id: modulo.proyecto_id,
        modulo_key: modulo.modulo_key,
        cantidad_observaciones: filas.length,
      },
    );
    await notificar(
      supabaseAdmin,
      modulo.proyecto_id,
      modulo.id,
      `Módulo devuelto con observaciones: ${modulo.modulo_key}`,
      `El módulo "${modulo.modulo_key}" fue devuelto con ${filas.length} observación(es) para corrección.`,
    );

    return { ok: true, observaciones: filas.length };
  });

// ---------- Reabrir un módulo aprobado (interno) ---------------------------

export const reabrirModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const rol = await rolDelUsuario(supabaseAdmin, userId);
    if (rol !== "admin" && rol !== "implementador") {
      throw new Error("Solo el equipo de EGIXIA puede reabrir módulos.");
    }

    const modulo = await cargarModulo(supabaseAdmin, data.moduloId);
    if (modulo.estado !== "aprobado") {
      throw new Error("Solo se reabren módulos aprobados.");
    }

    const { error: updErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .update({
        estado: "con_observaciones",
        revisado_at: new Date().toISOString(),
        revisado_por: userId,
      })
      .eq("id", modulo.id);
    if (updErr) throw new Error("No se pudo reabrir el módulo.");

    await auditar(supabaseAdmin, "modulo_reabierto", modulo.id, {
      proyecto_id: modulo.proyecto_id,
      modulo_key: modulo.modulo_key,
    });
    await notificar(
      supabaseAdmin,
      modulo.proyecto_id,
      modulo.id,
      `Módulo reabierto: ${modulo.modulo_key}`,
      `El módulo "${modulo.modulo_key}" fue reabierto por el equipo de EGIXIA para nuevas correcciones.`,
    );

    return { ok: true };
  });

// ---------- Reenviar tras corregir (invitado) ------------------------------

export const reenviarModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const modulo = await cargarModulo(supabaseAdmin, data.moduloId);

    const rol = await rolDelUsuario(supabaseAdmin, userId);
    const esInterno = rol === "admin" || rol === "implementador";
    if (!esInterno) {
      const miembro = await esMiembroDelProyecto(
        supabaseAdmin,
        userId,
        modulo.proyecto_id,
      );
      if (!miembro) throw new Error("No tienes acceso a este proyecto.");
    }

    if (modulo.estado !== "con_observaciones") {
      throw new Error("Solo se reenvían módulos con observaciones pendientes.");
    }

    // Requeridos completos.
    const definicion = definicionModulo(modulo.modulo_key);
    const faltantes: string[] = [];
    for (const seccion of definicion.secciones) {
      for (const c of seccion.campos) {
        if (!campoActivo(c)) continue;
        if (c.tipo === "info") continue;
        if (!campoVisible(c, modulo.datos)) continue;
        if (!c.requerido) continue;
        if (!valorLleno(modulo.datos[c.key])) faltantes.push(c.key);
      }
    }
    if (faltantes.length > 0) {
      throw new Error(
        `Faltan ${faltantes.length} campo(s) requerido(s) por completar.`,
      );
    }

    const ahora = new Date().toISOString();
    // Marca todas las observaciones abiertas como resueltas.
    const { error: obsErr } = await supabaseAdmin
      .from("observaciones")
      .update({ estado: "resuelta", resuelta_at: ahora })
      .eq("proyecto_modulo_id", modulo.id)
      .eq("estado", "abierta");
    if (obsErr) throw new Error("No se pudieron marcar las observaciones como resueltas.");

    const { error: updErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .update({
        estado: "en_revision",
        enviado_at: ahora,
        enviado_por: userId,
      })
      .eq("id", modulo.id);
    if (updErr) throw new Error("No se pudo reenviar el módulo a revisión.");

    const version = await generarActa(supabaseAdmin, modulo.id, userId);
    await auditar(supabaseAdmin, "modulo_reenviado", modulo.id, {
      proyecto_id: modulo.proyecto_id,
      modulo_key: modulo.modulo_key,
      acta_version: version,
    });
    await notificar(
      supabaseAdmin,
      modulo.proyecto_id,
      modulo.id,
      `Módulo reenviado a revisión: ${modulo.modulo_key}`,
      `El proveedor corrigió las observaciones del módulo "${modulo.modulo_key}" y lo reenvió a revisión. Se generó el acta v${version}.`,
    );

    return { ok: true, acta_version: version };
  });