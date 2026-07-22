import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderCorreo, type TipoCorreo, type ContextoCorreo } from "@/lib/acta/plantillas-correo";

/**
 * Server functions del panel de administrador / implementador.
 *
 * Toda mutación:
 *  - Autoriza al llamante (rol admin o implementador).
 *  - Usa `supabaseAdmin` para eludir RLS puntualmente cuando hace falta
 *    (por ejemplo, editar datos de un módulo en cualquier estado deja
 *    traza en `auditoria`).
 *  - Registra la acción en `auditoria`.
 */

type Rol = "admin" | "implementador" | "cliente";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

async function rolDe(admin: Cliente, userId: string): Promise<Rol> {
  const { data } = await admin
    .from("profiles")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  if (!data) throw new Error("Perfil no encontrado.");
  return data.rol as Rol;
}

async function exigirInterno(admin: Cliente, userId: string) {
  const rol = await rolDe(admin, userId);
  if (rol !== "admin" && rol !== "implementador") {
    throw new Error("Acción reservada al equipo EGIXIA.");
  }
  return rol;
}

async function auditar(
  admin: Cliente,
  actorId: string | null,
  accion: string,
  entidad: string,
  entidadId: string,
  detalle: Record<string, unknown>,
) {
  await admin.rpc("registrar_auditoria", {
    _accion: accion,
    _entidad: entidad,
    _entidad_id: entidadId,
    _detalle: detalle,
    _actor_id: actorId,
  });
}

function tokenRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Crear proyecto -------------------------------------------------

const moduloKeyEnum = z.enum([
  "imagen",
  "sociedades",
  "seguridad",
  "usuarios_internos",
  "matriz_documental",
  "maestros_compras",
  "integracion_erp",
]);
const comportamientoEnum = z.enum([
  "bloquear",
  "editable_avisar",
  "solo_avisar",
  "extension_implementador",
]);

const crearProyectoSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  empresa: z.string().trim().min(2).max(120),
  modulos: z
    .array(
      z.object({
        modulo_key: moduloKeyEnum,
        fecha_limite: z.string().date().nullable().optional(),
        comportamiento_vencimiento: comportamientoEnum.nullable().optional(),
      }),
    )
    .min(1, "Selecciona al menos un módulo."),
});

export const crearProyecto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => crearProyectoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: proy, error } = await supabaseAdmin
      .from("proyectos")
      .insert({
        nombre: data.nombre,
        empresa: data.empresa,
        created_by: userId,
        estado: "nuevo",
      })
      .select("id")
      .single();
    if (error || !proy) throw new Error("No se pudo crear el proyecto.");

    const filas = data.modulos.map((m) => ({
      proyecto_id: proy.id,
      modulo_key: m.modulo_key,
      fecha_limite: m.fecha_limite || null,
      comportamiento_vencimiento: m.comportamiento_vencimiento || null,
    }));
    const { error: mErr } = await supabaseAdmin
      .from("proyecto_modulos")
      .insert(filas);
    if (mErr) {
      await supabaseAdmin.from("proyectos").delete().eq("id", proy.id);
      throw new Error("No se pudieron asignar los módulos.");
    }

    await auditar(supabaseAdmin, userId, "proyecto_creado", "proyecto", proy.id, {
      nombre: data.nombre,
      empresa: data.empresa,
      modulos: data.modulos.map((m) => m.modulo_key),
    });

    return { id: proy.id };
  });

// ---------- Agregar módulo a un proyecto existente -------------------------

const agregarModuloSchema = z.object({
  proyectoId: z.string().uuid(),
  moduloKey: moduloKeyEnum,
  fecha_limite: z.string().date().nullable().optional(),
  comportamiento_vencimiento: comportamientoEnum.nullable().optional(),
});

export const agregarModuloAProyecto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => agregarModuloSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: proy } = await supabaseAdmin
      .from("proyectos")
      .select("id, nombre, empresa")
      .eq("id", data.proyectoId)
      .maybeSingle();
    if (!proy) throw new Error("Proyecto no encontrado.");

    // Unicidad proyecto + módulo: si ya existe, error claro.
    const { data: existente } = await supabaseAdmin
      .from("proyecto_modulos")
      .select("id")
      .eq("proyecto_id", data.proyectoId)
      .eq("modulo_key", data.moduloKey)
      .maybeSingle();
    if (existente) {
      throw new Error("Este módulo ya está asignado al proyecto.");
    }

    const { data: nuevo, error } = await supabaseAdmin
      .from("proyecto_modulos")
      .insert({
        proyecto_id: data.proyectoId,
        modulo_key: data.moduloKey,
        estado: "sin_iniciar",
        datos: {},
        progreso: 0,
        fecha_limite: data.fecha_limite || null,
        comportamiento_vencimiento: data.comportamiento_vencimiento || null,
      })
      .select("id")
      .single();
    if (error || !nuevo) {
      throw new Error("No se pudo agregar el módulo al proyecto.");
    }

    await auditar(
      supabaseAdmin,
      userId,
      "modulo_agregado",
      "proyecto_modulo",
      nuevo.id,
      {
        proyecto_id: data.proyectoId,
        modulo_key: data.moduloKey,
        fecha_limite: data.fecha_limite ?? null,
        comportamiento_vencimiento: data.comportamiento_vencimiento ?? null,
      },
    );

    return { id: nuevo.id };
  });

// ---------- Editar datos de módulo (interno, queda en auditoría) -----------

const editarDatosSchema = z.object({
  moduloId: z.string().uuid(),
  datos: z.record(z.string(), z.unknown()),
  progreso: z.number().int().min(0).max(100).optional(),
});

export const editarDatosModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => editarDatosSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: prev } = await supabaseAdmin
      .from("proyecto_modulos")
      .select("id, proyecto_id, modulo_key, datos, progreso")
      .eq("id", data.moduloId)
      .maybeSingle();
    if (!prev) throw new Error("Módulo no encontrado.");

    const upd: Record<string, unknown> = {
      datos: data.datos as Record<string, unknown>,
      updated_por: userId,
    };
    if (typeof data.progreso === "number") upd.progreso = data.progreso;
    const { error } = await supabaseAdmin
      .from("proyecto_modulos")
      .update(upd as never)
      .eq("id", data.moduloId);
    if (error) throw new Error("No se pudo actualizar el módulo.");

    // Diff simple por claves cambiadas
    const prevDatos = (prev.datos as Record<string, unknown>) ?? {};
    const cambios: string[] = [];
    for (const k of new Set([...Object.keys(prevDatos), ...Object.keys(data.datos)])) {
      if (JSON.stringify(prevDatos[k]) !== JSON.stringify(data.datos[k])) {
        cambios.push(k);
      }
    }

    await auditar(supabaseAdmin, userId, "modulo_editado_admin", "proyecto_modulo", data.moduloId, {
      proyecto_id: prev.proyecto_id,
      modulo_key: prev.modulo_key,
      campos_modificados: cambios,
    });

    return { ok: true, cambios };
  });

// ---------- Configuración del módulo (fecha límite, comportamiento, estado)

const estadoModuloEnum = z.enum([
  "sin_iniciar",
  "en_diligenciamiento",
  "en_revision",
  "con_observaciones",
  "aprobado",
]);

const configModuloSchema = z
  .object({
    moduloId: z.string().uuid(),
    fecha_limite: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .nullable()
      .optional(),
    comportamiento_vencimiento: comportamientoEnum.nullable().optional(),
    estado: estadoModuloEnum.optional(),
  })
  .refine(
    (v) =>
      v.fecha_limite !== undefined ||
      v.comportamiento_vencimiento !== undefined ||
      v.estado !== undefined,
    { message: "Nada que actualizar." },
  );

function hoyIsoLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const actualizarConfigModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => configModuloSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: prev } = await supabaseAdmin
      .from("proyecto_modulos")
      .select(
        "id, proyecto_id, modulo_key, estado, fecha_limite, comportamiento_vencimiento, extension_solicitada_at, extension_solicitada_por",
      )
      .eq("id", data.moduloId)
      .maybeSingle();
    if (!prev) throw new Error("Módulo no encontrado.");

    const upd: Record<string, unknown> = {};
    if (data.fecha_limite !== undefined) {
      if (data.fecha_limite && data.fecha_limite < hoyIsoLocal()) {
        throw new Error(
          "La fecha límite no puede ser anterior a la fecha actual.",
        );
      }
      upd.fecha_limite = data.fecha_limite;
    }
    if (data.comportamiento_vencimiento !== undefined) {
      upd.comportamiento_vencimiento = data.comportamiento_vencimiento;
    }
    if (data.estado !== undefined) {
      upd.estado = data.estado;
    }

    // Concesión de extensión: si había una solicitud pendiente y la nueva
    // fecha límite es posterior a la anterior, se limpia la solicitud y
    // queda auditada como `extension_concedida`.
    const extensionConcedida =
      !!prev.extension_solicitada_at &&
      data.fecha_limite !== undefined &&
      !!data.fecha_limite &&
      (!prev.fecha_limite || data.fecha_limite > prev.fecha_limite);
    if (extensionConcedida) {
      upd.extension_solicitada_at = null;
      upd.extension_solicitada_por = null;
    }

    const { error } = await supabaseAdmin
      .from("proyecto_modulos")
      .update(upd as never)
      .eq("id", data.moduloId);
    if (error) throw new Error("No se pudo actualizar el módulo.");

    await auditar(
      supabaseAdmin,
      userId,
      "modulo_config_actualizada",
      "proyecto_modulo",
      data.moduloId,
      {
        proyecto_id: prev.proyecto_id,
        modulo_key: prev.modulo_key,
        cambios: upd,
        anterior: {
          estado: prev.estado,
          fecha_limite: prev.fecha_limite,
          comportamiento_vencimiento: prev.comportamiento_vencimiento,
        },
      },
    );

    if (extensionConcedida) {
      await auditar(
        supabaseAdmin,
        userId,
        "extension_concedida",
        "proyecto_modulo",
        data.moduloId,
        {
          proyecto_id: prev.proyecto_id,
          modulo_key: prev.modulo_key,
          fecha_limite_anterior: prev.fecha_limite,
          fecha_limite_nueva: data.fecha_limite,
          solicitada_at: prev.extension_solicitada_at,
          solicitada_por: prev.extension_solicitada_por,
        },
      );
    }

    return { ok: true, extensionConcedida };
  });

// ---------- Prueba de correos (envía las 4 plantillas al admin) -----------

async function enviarConResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY no está configurado.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export const enviarCorreosPrueba = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("email, nombre")
      .eq("id", userId)
      .maybeSingle();
    const destino = perfil?.email as string | undefined;
    if (!destino) throw new Error("No se pudo obtener el correo del administrador.");

    const base = await urlBaseDelPortal();
    const { data: cfgCorreo } = await supabaseAdmin
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "correo")
      .maybeSingle();
    const cfg = (cfgCorreo?.valor ?? {}) as { from_nombre?: unknown; from_email?: unknown };
    const fromNombre =
      typeof cfg.from_nombre === "string" && cfg.from_nombre.trim()
        ? cfg.from_nombre.trim()
        : "EGIXIA";
    const fromEmail =
      typeof cfg.from_email === "string" && cfg.from_email.trim()
        ? cfg.from_email.trim()
        : "onboarding@resend.dev";
    const from = `${fromNombre} <${fromEmail}>`;

    const escenarios: Array<{ tipo: TipoCorreo; ctx: ContextoCorreo; etiqueta: string }> = [
      {
        tipo: "invitacion",
        etiqueta: "invitacion",
        ctx: {
          invitacion: {
            empresa: "ACME S.A.S. (prueba)",
            nombreProyecto: "Implementación demo",
            urlRegistro: `${base}/invitacion/token-de-prueba`,
            expiraTexto: "14 días",
          },
        },
      },
      {
        tipo: "acta_envio",
        etiqueta: "acta_envio",
        ctx: {
          acta: {
            proyecto: "Proyecto de prueba",
            empresa: "ACME S.A.S.",
            moduloNombre: "Datos de la sociedad",
            version: 1,
            autorNombre: perfil?.nombre || "Administrador",
            urlActa: `${base}/`,
            urlModulo: `${base}/app/modulo/prueba`,
          },
        },
      },
      {
        tipo: "acta_devolucion",
        etiqueta: "acta_devolucion",
        ctx: {
          observaciones: {
            proyecto: "Proyecto de prueba",
            moduloNombre: "Datos de la sociedad",
            cantidad: 3,
            urlModulo: `${base}/mi-proyecto/modulo/prueba`,
          },
        },
      },
      {
        tipo: "acta_aprobacion",
        etiqueta: "acta_aprobacion",
        ctx: {
          aprobacion: {
            proyecto: "Proyecto de prueba",
            moduloNombre: "Datos de la sociedad",
            urlModulo: `${base}/mi-proyecto/modulo/prueba`,
          },
        },
      },
    ];

    const resultados: Array<{ tipo: string; ok: boolean; status: number; error?: string }> = [];
    for (const e of escenarios) {
      try {
        const r = renderCorreo(e.tipo, e.ctx);
        const asunto = `[PRUEBA] ${r.asunto}`;
        const resp = await enviarConResend({
          to: destino,
          from,
          subject: asunto,
          html: r.html,
          text: r.texto,
        });
        const errMsg = !resp.ok
          ? (resp.body as { message?: string; error?: string })?.message ||
            (resp.body as { error?: string })?.error ||
            `HTTP ${resp.status}`
          : undefined;
        resultados.push({ tipo: e.etiqueta, ok: resp.ok, status: resp.status, error: errMsg });
      } catch (err) {
        resultados.push({
          tipo: e.etiqueta,
          ok: false,
          status: 0,
          error: err instanceof Error ? err.message : "error desconocido",
        });
      }
    }

    await auditar(
      supabaseAdmin,
      userId,
      "correos_prueba_enviados",
      "notificacion_correo",
      userId,
      { destinatario: destino, resultados },
    );

    return { destinatario: destino, resultados };
  });

// ---------- Invitaciones ---------------------------------------------------

const crearInvSchema = z.object({
  email: z.string().email().max(160),
  rol_invitado: z.enum(["implementador", "invitado"]),
  proyecto_id: z.string().uuid().nullable().optional(),
  dias_validez: z.number().int().min(1).max(60).default(14),
});

export const crearInvitacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => crearInvSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    if (data.rol_invitado === "invitado" && !data.proyecto_id) {
      throw new Error("Una invitación de invitado requiere un proyecto.");
    }

    // Sólo un admin puede invitar a alguien como implementador.
    // Un implementador sólo puede invitar clientes/invitados a proyectos.
    if (data.rol_invitado === "implementador") {
      const rolActor = await rolDe(supabaseAdmin, userId);
      if (rolActor !== "admin") {
        throw new Error(
          "Sólo un administrador puede invitar a otros implementadores.",
        );
      }
    }

    const token = tokenRandom();
    const expira = new Date(Date.now() + data.dias_validez * 24 * 3600 * 1000);

    const { data: inv, error } = await supabaseAdmin
      .from("invitaciones")
      .insert({
        email: data.email.toLowerCase(),
        rol_invitado: data.rol_invitado,
        proyecto_id: data.proyecto_id || null,
        token,
        expira_at: expira.toISOString(),
        estado: "pendiente",
        invited_by: userId,
      })
      .select("id")
      .single();
    if (error || !inv) throw new Error("No se pudo crear la invitación.");

    const envio = await enviarInvitacionCorreo(supabaseAdmin, userId, inv.id, {
      email: data.email,
      token,
      expira,
      proyectoId: data.proyecto_id || null,
      rolInvitado: data.rol_invitado,
    });

    await auditar(supabaseAdmin, userId, "invitacion_creada", "invitaciones", inv.id, {
      email: data.email,
      rol_invitado: data.rol_invitado,
      proyecto_id: data.proyecto_id || null,
    });

    return {
      id: inv.id,
      correoEnviado: envio.ok,
      correoError: envio.ok ? undefined : envio.error ?? "envío fallido",
    };
  });

/**
 * Listado de invitaciones para el panel interno. Se consulta con
 * `supabaseAdmin` porque la RLS de `invitaciones` (`inv_select_admin`)
 * es solo-admin y el implementador también necesita hacer seguimiento.
 * NUNCA se devuelve el token.
 */
export const listarInvitaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({ proyectoId: z.string().uuid().optional() })
      .optional()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    let q = supabaseAdmin
      .from("invitaciones")
      .select(
        "id, email, rol_invitado, proyecto_id, estado, expira_at, created_at, proyectos(nombre)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data?.proyectoId) q = q.eq("proyecto_id", data.proyectoId);
    const { data: rows, error } = await q;
    if (error) throw new Error("No se pudieron cargar las invitaciones.");

    return (rows ?? []) as unknown as Array<{
      id: string;
      email: string;
      rol_invitado: "implementador" | "invitado";
      proyecto_id: string | null;
      estado: "pendiente" | "aceptada" | "revocada" | "expirada";
      expira_at: string;
      created_at: string;
      proyectos: { nombre: string } | null;
    }>;
  });

export const reenviarInvitacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: inv } = await supabaseAdmin
      .from("invitaciones")
      .select("id, email, estado, proyecto_id, rol_invitado")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invitación no encontrada.");
    if (inv.estado === "aceptada") throw new Error("La invitación ya fue aceptada.");

    const token = tokenRandom();
    const expira = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const { error } = await supabaseAdmin
      .from("invitaciones")
      .update({ token, expira_at: expira.toISOString(), estado: "pendiente" })
      .eq("id", inv.id);
    if (error) throw new Error("No se pudo reenviar.");

    const envio = await enviarInvitacionCorreo(supabaseAdmin, userId, inv.id, {
      email: inv.email as string,
      token,
      expira,
      proyectoId: (inv.proyecto_id as string | null) ?? null,
      rolInvitado: inv.rol_invitado as "implementador" | "invitado",
    });

    await auditar(supabaseAdmin, userId, "invitacion_reenviada", "invitaciones", inv.id, {
      email: inv.email,
    });

    return {
      ok: true,
      correoEnviado: envio.ok,
      correoError: envio.ok ? undefined : envio.error ?? "envío fallido",
    };
  });

export const revocarInvitacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { error } = await supabaseAdmin
      .from("invitaciones")
      .update({ estado: "revocada" })
      .eq("id", data.id)
      .eq("estado", "pendiente");
    if (error) throw new Error("No se pudo revocar.");

    await auditar(supabaseAdmin, userId, "invitacion_revocada", "invitaciones", data.id, {});
    return { ok: true };
  });

async function enviarInvitacionCorreo(
  admin: Cliente,
  actorId: string | null,
  invitacionId: string,
  input: {
    email: string;
    token: string;
    expira: Date;
    proyectoId: string | null;
    rolInvitado: "implementador" | "invitado";
  },
): Promise<{ ok: boolean; error?: string }> {
  let empresa = "tu empresa";
  let nombreProyecto: string | undefined;
  if (input.proyectoId) {
    const { data } = await admin
      .from("proyectos")
      .select("nombre, empresa")
      .eq("id", input.proyectoId)
      .maybeSingle();
    if (data) {
      empresa = (data.empresa as string) || empresa;
      nombreProyecto = data.nombre as string;
    }
  }
  const base = await urlBaseDelPortal();
  const urlRegistro = `${base}/invitacion/${input.token}`;

  // Enviamos el correo con la plantilla propia EGIXIA a través de la
  // Edge Function `enviar-correo`. `aceptarInvitacion` ya se encarga de
  // crear la cuenta en Auth si el usuario no existe cuando abra el enlace,
  // por lo que no dependemos de `inviteUserByEmail` / `resetPasswordForEmail`
  // (que envían correos genéricos de Supabase Auth en inglés).
  const diasValidez = Math.max(
    1,
    Math.round((input.expira.getTime() - Date.now()) / (24 * 3600 * 1000)),
  );
  const { notificarInvitacion } = await import("@/lib/acta/notificaciones.server");
  const envio = await notificarInvitacion({
    invitacionId,
    destinatario: input.email,
    empresa,
    nombreProyecto,
    urlRegistro,
    expiraTexto: `${diasValidez} días`,
    actorId,
  });

  await admin.from("auditoria").insert({
    actor_id: actorId,
    accion: "invitacion_correo_enviado",
    entidad: "invitaciones",
    entidad_id: invitacionId,
    detalle: {
      destinatario: input.email,
      url: urlRegistro,
      expira_at: input.expira.toISOString(),
      ok: envio.ok,
      error: envio.error ?? null,
    },
  });

  return { ok: envio.ok, error: envio.error };
}

async function urlBaseDelPortal(): Promise<string> {
  const { siteUrlCanonico } = await import("@/lib/site-url.server");
  return siteUrlCanonico();
}

// ---------- Miembros de proyecto ------------------------------------------

const miembroEstadoSchema = z.object({
  miembroId: z.string().uuid(),
  estado: z.enum(["activo", "inhabilitado"]),
});

export const actualizarMiembroEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => miembroEstadoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: prev } = await supabaseAdmin
      .from("proyecto_miembros")
      .select("id, proyecto_id, profile_id, rol_en_proyecto")
      .eq("id", data.miembroId)
      .maybeSingle();
    if (!prev) throw new Error("Miembro no encontrado.");

    const { error } = await supabaseAdmin
      .from("proyecto_miembros")
      .update({ estado: data.estado })
      .eq("id", data.miembroId);
    if (error) throw new Error("No se pudo actualizar el miembro.");

    await auditar(
      supabaseAdmin,
      userId,
      data.estado === "inhabilitado"
        ? "miembro_inhabilitado"
        : "miembro_activado",
      "proyecto_miembro",
      data.miembroId,
      {
        proyecto_id: prev.proyecto_id,
        profile_id: prev.profile_id,
        rol_en_proyecto: prev.rol_en_proyecto,
      },
    );
    return { ok: true };
  });

export const desvincularMiembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ miembroId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

    const { data: prev } = await supabaseAdmin
      .from("proyecto_miembros")
      .select("id, proyecto_id, profile_id, rol_en_proyecto")
      .eq("id", data.miembroId)
      .maybeSingle();
    if (!prev) throw new Error("Miembro no encontrado.");

    const { error } = await supabaseAdmin
      .from("proyecto_miembros")
      .delete()
      .eq("id", data.miembroId);
    if (error) throw new Error("No se pudo desvincular.");

    await auditar(supabaseAdmin, userId, "miembro_desvinculado", "proyecto_miembro", data.miembroId, {
      proyecto_id: prev.proyecto_id,
      profile_id: prev.profile_id,
      rol_en_proyecto: prev.rol_en_proyecto,
    });
    return { ok: true };
  });

async function exigirAdmin(admin: Cliente, userId: string) {
  const rol = await rolDe(admin, userId);
  if (rol !== "admin") throw new Error("Acción reservada al administrador.");
}

// ---------- Usuarios (admin) ---------------------------------------------

const cambiarEstadoUsuarioSchema = z.object({
  profileId: z.string().uuid(),
  estado: z.enum(["activo", "inhabilitado"]),
});

export const cambiarEstadoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => cambiarEstadoUsuarioSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);
    if (data.profileId === userId)
      throw new Error("No puedes inhabilitar tu propia cuenta.");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ estado: data.estado })
      .eq("id", data.profileId);
    if (error) throw new Error("No se pudo actualizar el usuario.");
    await auditar(
      supabaseAdmin,
      userId,
      data.estado === "inhabilitado" ? "usuario_inhabilitado" : "usuario_activado",
      "profile",
      data.profileId,
      {},
    );
    return { ok: true };
  });

const cambiarRolSchema = z.object({
  profileId: z.string().uuid(),
  rol: z.enum(["admin", "implementador", "cliente"]),
});

export const cambiarRolUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => cambiarRolSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);
    if (data.profileId === userId)
      throw new Error("No puedes cambiar tu propio rol.");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ rol: data.rol })
      .eq("id", data.profileId);
    if (error) throw new Error("No se pudo cambiar el rol.");
    await auditar(supabaseAdmin, userId, "usuario_rol_cambiado", "profile", data.profileId, {
      rol: data.rol,
    });
    return { ok: true };
  });

export const eliminarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ profileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);
    if (data.profileId === userId)
      throw new Error("No puedes eliminar tu propia cuenta.");

    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("email, rol")
      .eq("id", data.profileId)
      .maybeSingle();

    // Auth admin borra usuario -> cascada a profiles y miembros por FK.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.profileId);
    if (error) throw new Error("No se pudo eliminar la cuenta.");

    await auditar(supabaseAdmin, userId, "usuario_eliminado", "profile", data.profileId, {
      email: p?.email ?? null,
      rol: p?.rol ?? null,
    });
    return { ok: true };
  });

// ---------- Proyecto (eliminar) ------------------------------------------

export const eliminarProyecto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ proyectoId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);

    const { data: p } = await supabaseAdmin
      .from("proyectos")
      .select("nombre, empresa")
      .eq("id", data.proyectoId)
      .maybeSingle();
    if (!p) throw new Error("Proyecto no encontrado.");

    const { error } = await supabaseAdmin
      .from("proyectos")
      .delete()
      .eq("id", data.proyectoId);
    if (error) throw new Error("No se pudo eliminar el proyecto.");

    await auditar(supabaseAdmin, userId, "proyecto_eliminado", "proyecto", data.proyectoId, {
      nombre: p.nombre,
      empresa: p.empresa,
    });
    return { ok: true };
  });

// ---------- Catálogo (overrides por proyecto) ----------------------------

// Helper interno — devuelve el set de campo_keys con valor no vacío en el módulo.
async function camposConDatos(
  admin: Cliente,
  proyectoId: string,
  moduloKey: string,
): Promise<{ set: Set<string>; datos: Record<string, unknown> }> {
  const { data } = await admin
    .from("proyecto_modulos")
    .select("datos")
    .eq("proyecto_id", proyectoId)
    .eq("modulo_key", moduloKey)
    .maybeSingle();
  const datos = ((data?.datos as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const set = new Set<string>();
  const lleno = (v: unknown): boolean => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return !Number.isNaN(v);
    if (Array.isArray(v)) {
      // Valor de tabla: solo cuenta como diligenciado si alguna fila
      // tiene al menos una celda con valor no vacío ([{}] o [""] no
      // cuentan).
      return v.some((fila) => {
        if (fila && typeof fila === "object" && !Array.isArray(fila)) {
          return Object.values(fila as Record<string, unknown>).some((c) =>
            lleno(c),
          );
        }
        return lleno(fila);
      });
    }
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  };
  for (const [k, v] of Object.entries(datos)) {
    if (lleno(v)) set.add(k);
  }
  return { set, datos };
}

// Helper interno — recalcula progreso del módulo aplicando todos los overrides.
async function recalcularProgresoModulo(
  admin: Cliente,
  proyectoId: string,
  moduloKey: string,
) {
  const { data: mod } = await admin
    .from("proyecto_modulos")
    .select("id, datos")
    .eq("proyecto_id", proyectoId)
    .eq("modulo_key", moduloKey)
    .maybeSingle();
  if (!mod) return;
  const [{ data: ovCampos }, { data: ovSecciones }] = await Promise.all([
    admin
      .from("catalogo_overrides")
      .select("modulo_key, campo_key, activo, label, requerido, guia, opciones_permitidas")
      .eq("proyecto_id", proyectoId)
      .eq("modulo_key", moduloKey),
    admin
      .from("catalogo_overrides_seccion")
      .select("modulo_key, seccion_key, habilitada, obligatoria")
      .eq("proyecto_id", proyectoId)
      .eq("modulo_key", moduloKey),
  ]);
  const { definicionModulo } = await import("@/lib/form-engine/modulo-ejemplo");
  const { aplicarOverrides } = await import("@/lib/form-engine/overrides");
  const { calcularProgreso } = await import("@/lib/form-engine/validacion");
  const def = aplicarOverrides(
    definicionModulo(moduloKey),
    (ovCampos ?? []) as never,
    (ovSecciones ?? []) as never,
  );
  const datos = (mod.datos as Record<string, unknown>) ?? {};
  const progreso = calcularProgreso(def, datos);
  await admin
    .from("proyecto_modulos")
    .update({ progreso } as never)
    .eq("id", mod.id);
}

const overrideSchema = z.object({
  proyectoId: z.string().uuid(),
  moduloKey: z.string().min(1),
  campoKey: z.string().min(1),
  activo: z.boolean().optional(),
  label: z.string().max(200).nullable().optional(),
  requerido: z.boolean().nullable().optional(),
  // Guía enriquecida (jsonb): textos + título del popup + imágenes de
  // referencia en el bucket privado `ayudas`. La regla de protección de
  // camposConDatos NO aplica a la guía (editarla nunca toca datos).
  guia: z
    .object({
      que: z.string().max(500).optional(),
      formato: z.string().max(200).optional(),
      tamano: z.string().max(200).optional(),
      titulo: z.string().max(200).optional(),
      imagenes: z
        .array(
          z.object({
            bucket: z.string().min(1).max(100),
            storagePath: z.string().min(1).max(600),
            nombre: z.string().max(255).optional(),
            caption: z.string().max(300).optional(),
          }),
        )
        .max(3)
        .optional(),
    })
    .nullable()
    .optional(),
  opciones_permitidas: z.array(z.string()).nullable().optional(),
});

export const guardarOverrideCampo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => overrideSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const rolActor = await rolDe(supabaseAdmin, userId);
    if (rolActor !== "admin" && rolActor !== "implementador") {
      throw new Error("Acción reservada al equipo EGIXIA.");
    }

    // Regla de protección para no-admin.
    if (rolActor !== "admin") {
      const { set: llenos, datos } = await camposConDatos(
        supabaseAdmin,
        data.proyectoId,
        data.moduloKey,
      );
      if (data.activo === false && llenos.has(data.campoKey)) {
        throw new Error(
          "Este campo ya tiene información diligenciada. Solo un administrador puede desactivarlo.",
        );
      }
      if (Array.isArray(data.opciones_permitidas) && llenos.has(data.campoKey)) {
        const permitidas = new Set(data.opciones_permitidas);
        const val = datos[data.campoKey];
        const seleccionadas: string[] = Array.isArray(val)
          ? (val as unknown[]).filter((x) => typeof x === "string") as string[]
          : typeof val === "string" && val.length > 0
            ? [val]
            : [];
        const excluidas = seleccionadas.filter((s) => !permitidas.has(s));
        if (excluidas.length > 0) {
          throw new Error(
            "No puedes quitar opciones que el cliente ya seleccionó. Solo un administrador puede hacerlo.",
          );
        }
      }
    }

    const row: Record<string, unknown> = {
      proyecto_id: data.proyectoId,
      modulo_key: data.moduloKey,
      campo_key: data.campoKey,
      updated_by: userId,
    };
    if (typeof data.activo === "boolean") row.activo = data.activo;
    if (data.label !== undefined) row.label = data.label;
    if (data.requerido !== undefined) row.requerido = data.requerido;
    if (data.guia !== undefined) row.guia = data.guia;
    if (data.opciones_permitidas !== undefined) row.opciones_permitidas = data.opciones_permitidas;

    const { error } = await supabaseAdmin
      .from("catalogo_overrides")
      .upsert(row as never, { onConflict: "proyecto_id,modulo_key,campo_key" });
    if (error) throw new Error("No se pudo guardar el override.");

    await auditar(
      supabaseAdmin,
      userId,
      "catalogo_override_guardado",
      "catalogo_override",
      `${data.proyectoId}:${data.moduloKey}:${data.campoKey}`,
      { proyecto_id: data.proyectoId, campos: Object.keys(row) },
    );

    await recalcularProgresoModulo(supabaseAdmin, data.proyectoId, data.moduloKey);
    return { ok: true };
  });

const overrideSeccionSchema = z.object({
  proyectoId: z.string().uuid(),
  moduloKey: z.string().min(1),
  seccionKey: z.string().min(1),
  habilitada: z.boolean().optional(),
  obligatoria: z.boolean().nullable().optional(),
});

export const guardarOverrideSeccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => overrideSeccionSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const rolActor = await rolDe(supabaseAdmin, userId);
    if (rolActor !== "admin" && rolActor !== "implementador") {
      throw new Error("Acción reservada al equipo EGIXIA.");
    }

    let protegida = false;
    if (data.habilitada === false) {
      const { definicionModulo } = await import("@/lib/form-engine/modulo-ejemplo");
      const def = definicionModulo(data.moduloKey);
      const seccion = def.secciones.find((s) => s.key === data.seccionKey);
      if (seccion) {
        const { set: llenos } = await camposConDatos(
          supabaseAdmin,
          data.proyectoId,
          data.moduloKey,
        );
        const conDatos = seccion.campos.some(
          (c) => c.tipo !== "info" && llenos.has(c.key),
        );
        if (conDatos) {
          if (rolActor !== "admin") {
            throw new Error(
              "Esta sección ya tiene información diligenciada por el cliente. Solo un administrador puede ocultarla.",
            );
          }
          protegida = true;
        }
      }
    }

    const row: Record<string, unknown> = {
      proyecto_id: data.proyectoId,
      modulo_key: data.moduloKey,
      seccion_key: data.seccionKey,
      updated_by: userId,
    };
    if (typeof data.habilitada === "boolean") row.habilitada = data.habilitada;
    if (data.obligatoria !== undefined) row.obligatoria = data.obligatoria;

    const { error } = await supabaseAdmin
      .from("catalogo_overrides_seccion")
      .upsert(row as never, {
        onConflict: "proyecto_id,modulo_key,seccion_key",
      });
    if (error) throw new Error("No se pudo guardar el override de sección.");

    await auditar(
      supabaseAdmin,
      userId,
      "catalogo_override_seccion_guardado",
      "catalogo_override_seccion",
      `${data.proyectoId}:${data.moduloKey}:${data.seccionKey}`,
      { cambios: Object.keys(row), protegida },
    );

    await recalcularProgresoModulo(supabaseAdmin, data.proyectoId, data.moduloKey);
    return { ok: true };
  });

// ---------- Plantillas de parametrización del catálogo --------------------

interface PlantillaOverrideCampo {
  modulo_key: string;
  campo_key: string;
  activo?: boolean;
  label?: string | null;
  requerido?: boolean | null;
  guia?: Record<string, unknown> | null;
  opciones_permitidas?: string[] | null;
}

interface PlantillaOverrideSeccion {
  modulo_key: string;
  seccion_key: string;
  habilitada?: boolean;
  obligatoria?: boolean | null;
}

interface PlantillaContenido {
  overrides: PlantillaOverrideCampo[];
  secciones: PlantillaOverrideSeccion[];
}

const guardarPlantillaSchema = z.object({
  proyectoId: z.string().uuid(),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).optional(),
});

export const guardarPlantillaCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => guardarPlantillaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);
    const admin = supabaseAdmin as Cliente;

    const { data: proy } = await admin
      .from("proyectos")
      .select("id, nombre")
      .eq("id", data.proyectoId)
      .maybeSingle();
    if (!proy) throw new Error("Proyecto no encontrado.");

    // Snapshot de la parametrización sin ids ni proyecto_id. Las guías
    // (incluidas las referencias a imágenes en Storage) se conservan tal
    // cual; al aplicar la plantilla se copian los binarios al proyecto
    // destino.
    const [{ data: ov }, { data: os }] = await Promise.all([
      admin
        .from("catalogo_overrides")
        .select("modulo_key, campo_key, activo, label, requerido, guia, opciones_permitidas")
        .eq("proyecto_id", data.proyectoId),
      admin
        .from("catalogo_overrides_seccion")
        .select("modulo_key, seccion_key, habilitada, obligatoria")
        .eq("proyecto_id", data.proyectoId),
    ]);

    const contenido: PlantillaContenido = {
      overrides: (ov ?? []) as PlantillaOverrideCampo[],
      secciones: (os ?? []) as PlantillaOverrideSeccion[],
    };

    const { data: creada, error } = await admin
      .from("plantillas_catalogo")
      .insert({
        nombre: data.nombre,
        descripcion: data.descripcion?.trim() || null,
        contenido,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (error || !creada) throw new Error("No se pudo guardar la plantilla.");

    await auditar(supabaseAdmin, userId, "plantilla_guardada", "plantilla_catalogo", creada.id as string, {
      proyecto_id: data.proyectoId,
      nombre: data.nombre,
      overrides: contenido.overrides.length,
      secciones: contenido.secciones.length,
    });

    return { id: creada.id as string };
  });

export const listarPlantillasCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);
    const admin = supabaseAdmin as Cliente;

    const { data: rows, error } = await admin
      .from("plantillas_catalogo")
      .select("id, nombre, descripcion, created_at, creado_por")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("No se pudieron cargar las plantillas.");

    const autorIds = Array.from(
      new Set(
        (rows ?? [])
          .map((r: { creado_por: string | null }) => r.creado_por)
          .filter((x: string | null): x is string => !!x),
      ),
    );
    const nombres = new Map<string, string>();
    if (autorIds.length > 0) {
      const { data: perfiles } = await admin
        .from("profiles")
        .select("id, nombre, email")
        .in("id", autorIds);
      for (const p of perfiles ?? []) {
        nombres.set(p.id as string, (p.nombre as string) || (p.email as string) || "");
      }
    }

    return ((rows ?? []) as Array<{
      id: string;
      nombre: string;
      descripcion: string | null;
      created_at: string;
      creado_por: string | null;
    }>).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      created_at: r.created_at,
      creado_por_nombre: (r.creado_por && nombres.get(r.creado_por)) || null,
    }));
  });

const aplicarPlantillaSchema = z.object({
  plantillaId: z.string().uuid(),
  proyectoId: z.string().uuid(),
});

export const aplicarPlantillaCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => aplicarPlantillaSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);
    const admin = supabaseAdmin as Cliente;

    const { data: plantilla } = await admin
      .from("plantillas_catalogo")
      .select("id, nombre, contenido")
      .eq("id", data.plantillaId)
      .maybeSingle();
    if (!plantilla) throw new Error("Plantilla no encontrada.");

    const { data: proy } = await admin
      .from("proyectos")
      .select("id")
      .eq("id", data.proyectoId)
      .maybeSingle();
    if (!proy) throw new Error("Proyecto no encontrado.");

    const contenido = (plantilla.contenido ?? {}) as Partial<PlantillaContenido>;
    const overrides = Array.isArray(contenido.overrides) ? contenido.overrides : [];
    const secciones = Array.isArray(contenido.secciones) ? contenido.secciones : [];

    // Cache de camposConDatos por módulo (regla de protección existente).
    const cacheDatos = new Map<
      string,
      { set: Set<string>; datos: Record<string, unknown> }
    >();
    const datosDe = async (moduloKey: string) => {
      let v = cacheDatos.get(moduloKey);
      if (!v) {
        v = await camposConDatos(admin, data.proyectoId, moduloKey);
        cacheDatos.set(moduloKey, v);
      }
      return v;
    };

    // Copia las imágenes de una guía al Storage del proyecto destino
    // cuando el storagePath pertenece a otro proyecto. Si la copia
    // falla, la guía se conserva sin esa imagen.
    const migrarGuia = async (
      guia: Record<string, unknown> | null | undefined,
    ): Promise<Record<string, unknown> | null | undefined> => {
      if (!guia || typeof guia !== "object") return guia ?? null;
      const imagenes = (guia as { imagenes?: unknown }).imagenes;
      if (!Array.isArray(imagenes) || imagenes.length === 0) return guia;
      const nuevas: unknown[] = [];
      for (const img of imagenes) {
        const i = img as { bucket?: string; storagePath?: string };
        if (!i?.bucket || !i?.storagePath) continue;
        const segmentos = i.storagePath.split("/");
        if (segmentos[0] === data.proyectoId) {
          nuevas.push(img);
          continue;
        }
        const destino = [data.proyectoId, ...segmentos.slice(1)].join("/");
        const { error: copyErr } = await admin.storage
          .from(i.bucket)
          .copy(i.storagePath, destino);
        // Si el objeto ya existe en el destino (plantilla aplicada dos
        // veces), lo tratamos como copia exitosa.
        if (copyErr && !/exist|duplicate/i.test(copyErr.message ?? "")) {
          continue; // se conserva la guía sin esta imagen
        }
        nuevas.push({ ...(img as Record<string, unknown>), storagePath: destino });
      }
      return { ...guia, imagenes: nuevas };
    };

    let aplicados = 0;
    let omitidos = 0;
    const modulosAfectados = new Set<string>();
    const { definicionModulo } = await import("@/lib/form-engine/modulo-ejemplo");

    // ----- Overrides de campo -----
    for (const ov of overrides) {
      if (!ov?.modulo_key || !ov?.campo_key) continue;
      const { set: llenos, datos } = await datosDe(ov.modulo_key);
      const row: Record<string, unknown> = {
        proyecto_id: data.proyectoId,
        modulo_key: ov.modulo_key,
        campo_key: ov.campo_key,
        updated_by: userId,
      };
      let cambios = 0;

      if (typeof ov.activo === "boolean") {
        if (ov.activo === false && llenos.has(ov.campo_key)) {
          omitidos += 1; // desactivar un campo con datos: protegido
        } else {
          row.activo = ov.activo;
          cambios += 1;
        }
      }
      if (ov.label !== undefined) {
        row.label = ov.label;
        cambios += 1;
      }
      if (ov.requerido !== undefined) {
        row.requerido = ov.requerido;
        cambios += 1;
      }
      if (ov.opciones_permitidas !== undefined) {
        if (Array.isArray(ov.opciones_permitidas) && llenos.has(ov.campo_key)) {
          const permitidas = new Set(ov.opciones_permitidas);
          const val = datos[ov.campo_key];
          const seleccionadas: string[] = Array.isArray(val)
            ? ((val as unknown[]).filter((x) => typeof x === "string") as string[])
            : typeof val === "string" && val.length > 0
              ? [val]
              : [];
          const excluidas = seleccionadas.filter((s) => !permitidas.has(s));
          if (excluidas.length > 0) {
            omitidos += 1; // quitar opciones ya seleccionadas: protegido
          } else {
            row.opciones_permitidas = ov.opciones_permitidas;
            cambios += 1;
          }
        } else {
          row.opciones_permitidas = ov.opciones_permitidas;
          cambios += 1;
        }
      }
      if (ov.guia !== undefined) {
        row.guia = await migrarGuia(ov.guia);
        cambios += 1;
      }

      if (cambios === 0) continue;
      const { error } = await admin
        .from("catalogo_overrides")
        .upsert(row, { onConflict: "proyecto_id,modulo_key,campo_key" });
      if (error) throw new Error("No se pudo aplicar la plantilla (campos).");
      aplicados += 1;
      modulosAfectados.add(ov.modulo_key);
    }

    // ----- Overrides de sección -----
    for (const os of secciones) {
      if (!os?.modulo_key || !os?.seccion_key) continue;
      const row: Record<string, unknown> = {
        proyecto_id: data.proyectoId,
        modulo_key: os.modulo_key,
        seccion_key: os.seccion_key,
        updated_by: userId,
      };
      let cambios = 0;

      if (typeof os.habilitada === "boolean") {
        let protegida = false;
        if (os.habilitada === false) {
          const def = definicionModulo(os.modulo_key);
          const seccion = def.secciones.find((s) => s.key === os.seccion_key);
          if (seccion) {
            const { set: llenos } = await datosDe(os.modulo_key);
            protegida = seccion.campos.some(
              (c) => c.tipo !== "info" && llenos.has(c.key),
            );
          }
        }
        if (protegida) {
          omitidos += 1; // ocultar una sección con datos: protegido
        } else {
          row.habilitada = os.habilitada;
          cambios += 1;
        }
      }
      if (os.obligatoria !== undefined) {
        row.obligatoria = os.obligatoria;
        cambios += 1;
      }

      if (cambios === 0) continue;
      const { error } = await admin
        .from("catalogo_overrides_seccion")
        .upsert(row, { onConflict: "proyecto_id,modulo_key,seccion_key" });
      if (error) throw new Error("No se pudo aplicar la plantilla (secciones).");
      aplicados += 1;
      modulosAfectados.add(os.modulo_key);
    }

    for (const moduloKey of modulosAfectados) {
      await recalcularProgresoModulo(supabaseAdmin, data.proyectoId, moduloKey);
    }

    await auditar(
      supabaseAdmin,
      userId,
      "plantilla_aplicada",
      "plantilla_catalogo",
      data.plantillaId,
      { plantillaId: data.plantillaId, proyecto_id: data.proyectoId, aplicados, omitidos },
    );

    return { aplicados, omitidos };
  });

export const eliminarPlantillaCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ plantillaId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);
    const admin = supabaseAdmin as Cliente;

    const { data: p } = await admin
      .from("plantillas_catalogo")
      .select("nombre")
      .eq("id", data.plantillaId)
      .maybeSingle();
    if (!p) throw new Error("Plantilla no encontrada.");

    const { error } = await admin
      .from("plantillas_catalogo")
      .delete()
      .eq("id", data.plantillaId);
    if (error) throw new Error("No se pudo eliminar la plantilla.");

    await auditar(supabaseAdmin, userId, "plantilla_eliminada", "plantilla_catalogo", data.plantillaId, {
      nombre: p.nombre,
    });
    return { ok: true };
  });

// ---------- Recordatorios de inactividad ----------------------------------

const ESTADOS_PROYECTO_ACTIVO = ["nuevo", "en_proceso", "en_revision"];
const ESTADOS_MODULO_REZAGADO = [
  "sin_iniciar",
  "en_diligenciamiento",
  "con_observaciones",
];

export const enviarRecordatorios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({ proyectoId: z.string().uuid().optional() })
      .optional()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);
    const admin = supabaseAdmin as Cliente;

    // Días de inactividad configurables (default 5).
    const { data: cfg } = await admin
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "parametros")
      .maybeSingle();
    const crudo = (cfg?.valor as { dias_recordatorio_inactividad?: unknown } | null)
      ?.dias_recordatorio_inactividad;
    const dias =
      typeof crudo === "number" && Number.isFinite(crudo) && crudo >= 1
        ? Math.round(crudo)
        : 5;
    const cutoff = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();

    // Módulos rezagados de proyectos activos.
    let q = admin
      .from("proyecto_modulos")
      .select(
        "id, proyecto_id, modulo_key, estado, fecha_limite, updated_at, proyectos!inner(id, nombre, empresa, estado)",
      )
      .in("estado", ESTADOS_MODULO_REZAGADO)
      .lt("updated_at", cutoff);
    if (data?.proyectoId) q = q.eq("proyecto_id", data.proyectoId);
    const { data: mods, error } = await q;
    if (error) throw new Error("No se pudieron consultar los módulos rezagados.");

    interface FilaRezagada {
      proyecto_id: string;
      modulo_key: string;
      estado: string;
      fecha_limite: string | null;
      proyectos: { nombre: string; estado: string } | null;
    }
    const rezagados = ((mods ?? []) as unknown as FilaRezagada[]).filter(
      (m) => m.proyectos && ESTADOS_PROYECTO_ACTIVO.includes(m.proyectos.estado),
    );

    // Anti-spam: proyectos ya recordados en las últimas 24 h (auditoría).
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: previos } = await admin
      .from("auditoria")
      .select("detalle")
      .eq("accion", "recordatorios_enviados")
      .gte("created_at", desde);
    const yaRecordados = new Set<string>();
    for (const r of previos ?? []) {
      const ids = (r.detalle as { proyectos_ids?: unknown } | null)?.proyectos_ids;
      if (Array.isArray(ids)) {
        for (const id of ids) if (typeof id === "string") yaRecordados.add(id);
      }
    }

    // Agrupar por proyecto.
    const porProyecto = new Map<string, { nombre: string; modulos: FilaRezagada[] }>();
    for (const m of rezagados) {
      if (yaRecordados.has(m.proyecto_id)) continue;
      const g = porProyecto.get(m.proyecto_id) ?? {
        nombre: m.proyectos?.nombre ?? "",
        modulos: [],
      };
      g.modulos.push(m);
      porProyecto.set(m.proyecto_id, g);
    }

    const { moduloCatalogo } = await import("@/lib/modulos-catalogo");
    const { ESTADO_LABEL } = await import("@/lib/modulo-estado");
    const { formatoFechaCO } = await import("@/lib/fechas");
    const { notificarRecordatorioProyecto } = await import(
      "@/lib/acta/notificaciones.server"
    );
    const base = await urlBaseDelPortal();

    let correos = 0;
    let fallidos = 0;
    const proyectosIds: string[] = [];

    for (const [proyectoId, g] of porProyecto) {
      const contexto = {
        proyecto: g.nombre,
        modulos: g.modulos.map((m) => ({
          nombre: moduloCatalogo(m.modulo_key).nombre,
          estado: ESTADO_LABEL[m.estado as keyof typeof ESTADO_LABEL] ?? m.estado,
          fechaLimiteTexto: m.fecha_limite
            ? formatoFechaCO(`${m.fecha_limite}T00:00:00`)
            : undefined,
        })),
        urlPortal: `${base}/mi-proyecto`,
      };
      const envio = await notificarRecordatorioProyecto({
        proyectoId,
        contexto,
        actorId: userId,
      });
      if (envio.totalMensajes > 0) {
        proyectosIds.push(proyectoId);
        correos += envio.exitosos;
        fallidos += envio.fallidos;
      }
    }

    const resumen = { proyectos: proyectosIds.length, correos, fallidos };

    if (proyectosIds.length > 0) {
      await auditar(
        supabaseAdmin,
        userId,
        "recordatorios_enviados",
        "notificacion_correo",
        userId,
        { ...resumen, proyectos_ids: proyectosIds },
      );
    }

    return resumen;
  });

// ---------- Configuración del sistema ------------------------------------

const configSchema = z.object({
  clave: z.enum(["branding", "correo", "parametros"]),
  valor: z.record(z.string(), z.unknown()),
});

export const guardarConfiguracion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => configSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirAdmin(supabaseAdmin, userId);
    const { error } = await supabaseAdmin
      .from("configuracion_sistema")
      .upsert({
        clave: data.clave,
        valor: data.valor as never,
        updated_by: userId,
      } as never);
    if (error) throw new Error("No se pudo guardar la configuración.");
    await auditar(
      supabaseAdmin,
      userId,
      "configuracion_actualizada",
      "configuracion_sistema",
      data.clave,
      { claves: Object.keys(data.valor) },
    );
    return { ok: true };
  });