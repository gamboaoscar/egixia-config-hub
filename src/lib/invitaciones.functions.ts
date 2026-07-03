import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const validarSchema = z.object({ token: z.string().min(10).max(200) });

export const validarInvitacion = createServerFn({ method: "POST" })
  .validator((input: unknown) => validarSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("validar_invitacion", {
      _token: data.token,
    });
    if (error) throw new Error("No pudimos validar tu invitación. Inténtalo más tarde.");
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return row as {
      email: string;
      rol_invitado: "implementador" | "invitado";
      proyecto_id: string | null;
      proyecto_nombre: string | null;
      expira_at: string;
    };
  });

const aceptarSchema = z.object({
  token: z.string().min(10),
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  apellido: z.string().trim().min(1, "El apellido es obligatorio").max(80),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export const aceptarInvitacion = createServerFn({ method: "POST" })
  .validator((input: unknown) => aceptarSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Reclamar el token de forma atómica (un solo uso, no vencido).
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("invitaciones")
      .update({ estado: "aceptada", accepted_at: new Date().toISOString() })
      .eq("token", data.token)
      .eq("estado", "pendiente")
      .gt("expira_at", new Date().toISOString())
      .select("id, email, rol_invitado, proyecto_id")
      .maybeSingle();

    if (claimErr) throw new Error("No se pudo validar la invitación.");
    if (!claimed) throw new Error("La invitación no es válida, ya fue utilizada o expiró.");

    const rollback = async () => {
      await supabaseAdmin
        .from("invitaciones")
        .update({ estado: "pendiente", accepted_at: null })
        .eq("id", claimed.id);
    };

    // 2. Asegurar la cuenta en Auth. El usuario puede ya existir porque
    // la invitación se envió con `inviteUserByEmail` (que crea el usuario)
    // o con `resetPasswordForEmail` (usuarios que ya existían). En ambos
    // casos aquí solo tenemos que fijar la contraseña y confirmar el email.
    let userId: string | null = null;
    const { data: lookup } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", claimed.email)
      .maybeSingle();
    if (lookup?.id) userId = lookup.id as string;

    if (!userId) {
      // Buscar en Auth por email (paginado; primer intento).
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const match = list?.users.find(
        (u) => (u.email || "").toLowerCase() === claimed.email.toLowerCase(),
      );
      if (match) userId = match.id;
    }

    if (userId) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          password: data.password,
          email_confirm: true,
          user_metadata: { nombre: data.nombre, apellido: data.apellido },
        },
      );
      if (updErr) {
        await rollback();
        throw new Error("No se pudo establecer la contraseña.");
      }
    } else {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: claimed.email,
          password: data.password,
          email_confirm: true,
          user_metadata: { nombre: data.nombre, apellido: data.apellido },
        });
      if (createErr || !created?.user) {
        await rollback();
        throw new Error(
          createErr?.message?.toLowerCase().includes("already")
            ? "Ya existe una cuenta con este correo. Inicia sesión."
            : "No se pudo crear la cuenta. Inténtalo de nuevo.",
        );
      }
      userId = created.user.id;
    }

    // 3. Actualizar/crear el perfil con el rol correcto de la invitación.
    const rolPerfil = claimed.rol_invitado === "implementador" ? "implementador" : "cliente";
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: claimed.email,
        nombre: data.nombre,
        apellido: data.apellido,
        rol: rolPerfil,
        estado: "activo",
      });
    if (profileErr) {
      await rollback();
      throw new Error("No se pudo crear el perfil del usuario.");
    }

    // 4. Si la invitación es de proyecto, vincular como miembro.
    if (claimed.proyecto_id) {
      // upsert por (proyecto_id, profile_id) por si ya existía la fila.
      const { error: memberErr } = await supabaseAdmin
        .from("proyecto_miembros")
        .upsert(
          {
            proyecto_id: claimed.proyecto_id,
            profile_id: userId,
            rol_en_proyecto: claimed.rol_invitado,
            estado: "activo",
          },
          { onConflict: "proyecto_id,profile_id,rol_en_proyecto" },
        );
      if (memberErr) {
        await rollback();
        throw new Error("No se pudo vincular al usuario con el proyecto.");
      }
    }

    // 5. Auditoría.
    await supabaseAdmin.from("auditoria").insert({
      actor_id: userId,
      accion: "invitacion.aceptada",
      entidad: "invitaciones",
      entidad_id: claimed.id,
      detalle: {
        proyecto_id: claimed.proyecto_id,
        rol_invitado: claimed.rol_invitado,
      },
    });

    return {
      email: claimed.email,
      rol: rolPerfil,
      proyecto_id: claimed.proyecto_id,
    };
  });