import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  });
}

function tokenRandom(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Crear proyecto -------------------------------------------------

const moduloKeyEnum = z.enum(["imagen", "sociedades", "seguridad"]);
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

    await auditar(supabaseAdmin, "proyecto_creado", "proyecto", proy.id, {
      nombre: data.nombre,
      empresa: data.empresa,
      modulos: data.modulos.map((m) => m.modulo_key),
    });

    return { id: proy.id };
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

    const upd: Record<string, unknown> = { datos: data.datos as Record<string, unknown> };
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

    await auditar(supabaseAdmin, "modulo_editado_admin", "proyecto_modulo", data.moduloId, {
      proyecto_id: prev.proyecto_id,
      modulo_key: prev.modulo_key,
      campos_modificados: cambios,
    });

    return { ok: true, cambios };
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

    await enviarInvitacionCorreo(supabaseAdmin, inv.id, {
      email: data.email,
      token,
      expira,
      proyectoId: data.proyecto_id || null,
      rolInvitado: data.rol_invitado,
    });

    await auditar(supabaseAdmin, "invitacion_creada", "invitaciones", inv.id, {
      email: data.email,
      rol_invitado: data.rol_invitado,
      proyecto_id: data.proyecto_id || null,
    });

    return { id: inv.id };
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

    await enviarInvitacionCorreo(supabaseAdmin, inv.id, {
      email: inv.email as string,
      token,
      expira,
      proyectoId: (inv.proyecto_id as string | null) ?? null,
      rolInvitado: inv.rol_invitado as "implementador" | "invitado",
    });

    await auditar(supabaseAdmin, "invitacion_reenviada", "invitaciones", inv.id, {
      email: inv.email,
    });

    return { ok: true };
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

    await auditar(supabaseAdmin, "invitacion_revocada", "invitaciones", data.id, {});
    return { ok: true };
  });

async function enviarInvitacionCorreo(
  admin: Cliente,
  invitacionId: string,
  input: {
    email: string;
    token: string;
    expira: Date;
    proyectoId: string | null;
    rolInvitado: "implementador" | "invitado";
  },
) {
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
  const base = urlBaseDelPortal();
  const urlRegistro = `${base}/invitacion/${input.token}`;

  // Reutilizamos el motor de correo integrado del backend (el mismo que
  // envía los correos de "Olvidé mi contraseña"). Si el usuario aún no
  // existe en Auth lo invitamos; si ya existe, disparamos un enlace de
  // recuperación apuntando a la misma página de aceptación.
  const meta = {
    egixia_token: input.token,
    rol_invitado: input.rolInvitado,
    proyecto_id: input.proyectoId,
    proyecto_nombre: nombreProyecto ?? null,
    empresa,
  };

  const { error: invErr } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    { redirectTo: urlRegistro, data: meta },
  );

  if (invErr) {
    const msg = (invErr.message || "").toLowerCase();
    const yaExiste =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");
    if (yaExiste) {
      // Usuario ya tiene cuenta: mandamos un enlace de recuperación que
      // aterriza igualmente en /invitacion/{token} con sesión activa.
      const { error: resetErr } = await admin.auth.resetPasswordForEmail(
        input.email,
        { redirectTo: urlRegistro },
      );
      if (resetErr) {
        throw new Error(
          `No se pudo enviar el correo de invitación: ${resetErr.message}`,
        );
      }
    } else {
      throw new Error(
        `No se pudo enviar el correo de invitación: ${invErr.message}`,
      );
    }
  }

  await admin.from("auditoria").insert({
    accion: "invitacion_correo_enviado",
    entidad: "invitaciones",
    entidad_id: invitacionId,
    detalle: {
      destinatario: input.email,
      url: urlRegistro,
      expira_at: input.expira.toISOString(),
    },
  });
}

function urlBaseDelPortal(): string {
  // Preferencia: origin del request (funciona en preview y en publicado).
  try {
    const origin =
      getRequestHeader("origin") ||
      (() => {
        const h = getRequestHeader("host");
        const proto = getRequestHeader("x-forwarded-proto") || "https";
        return h ? `${proto}://${h}` : "";
      })();
    if (origin) return origin.replace(/\/$/, "");
  } catch {
    /* fuera de contexto request */
  }
  const fromEnv =
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://egixia-config-hub.lovable.app";
  return fromEnv.replace(/\/$/, "");
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

    await auditar(supabaseAdmin, "miembro_desvinculado", "proyecto_miembro", data.miembroId, {
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
    await auditar(supabaseAdmin, "usuario_rol_cambiado", "profile", data.profileId, {
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

    await auditar(supabaseAdmin, "usuario_eliminado", "profile", data.profileId, {
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

    await auditar(supabaseAdmin, "proyecto_eliminado", "proyecto", data.proyectoId, {
      nombre: p.nombre,
      empresa: p.empresa,
    });
    return { ok: true };
  });

// ---------- Catálogo (overrides por proyecto) ----------------------------

const overrideSchema = z.object({
  proyectoId: z.string().uuid(),
  moduloKey: z.string().min(1),
  campoKey: z.string().min(1),
  activo: z.boolean().optional(),
  label: z.string().max(200).nullable().optional(),
  requerido: z.boolean().nullable().optional(),
  guia: z
    .object({
      que: z.string().max(500).optional(),
      formato: z.string().max(200).optional(),
      tamano: z.string().max(200).optional(),
    })
    .nullable()
    .optional(),
});

export const guardarOverrideCampo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => overrideSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await exigirInterno(supabaseAdmin, userId);

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

    const { error } = await supabaseAdmin
      .from("catalogo_overrides")
      .upsert(row as never, { onConflict: "proyecto_id,modulo_key,campo_key" });
    if (error) throw new Error("No se pudo guardar el override.");

    await auditar(
      supabaseAdmin,
      "catalogo_override_guardado",
      "catalogo_override",
      `${data.proyectoId}:${data.moduloKey}:${data.campoKey}`,
      { proyecto_id: data.proyectoId, campos: Object.keys(row) },
    );
    return { ok: true };
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
      "configuracion_actualizada",
      "configuracion_sistema",
      data.clave,
      { claves: Object.keys(data.valor) },
    );
    return { ok: true };
  });