import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

    // 2. Crear el usuario en Auth.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
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
    const userId = created.user.id;

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
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await rollback();
      throw new Error("No se pudo crear el perfil del usuario.");
    }

    // 4. Si la invitación es de proyecto, vincular como miembro.
    if (claimed.proyecto_id) {
      const { error: memberErr } = await supabaseAdmin
        .from("proyecto_miembros")
        .insert({
          proyecto_id: claimed.proyecto_id,
          profile_id: userId,
          rol_en_proyecto: claimed.rol_invitado,
          estado: "activo",
        });
      if (memberErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
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