// Edge function de un solo uso: crea la cuenta de administrador inicial
// (rol 'admin') si aún no existe, con una contraseña aleatoria fuerte.
// El admin debe usar "¿Olvidaste tu contraseña?" para establecer la suya.
// La contraseña nunca se persiste ni se devuelve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ADMIN_EMAIL = "hilberth.lopezv@egixia.com";

function strongPassword(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)) + "!Aa9";
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ¿Ya existe el usuario?
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, rol")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();

    if (existingProfile) {
      // Asegura que su rol sea admin
      if (existingProfile.rol !== "admin") {
        await supabase
          .from("profiles")
          .update({ rol: "admin", estado: "activo" })
          .eq("id", existingProfile.id);
      }
      return new Response(
        JSON.stringify({ ok: true, created: false, message: "Admin ya existe" }),
        { headers: { "content-type": "application/json" } },
      );
    }

    // Crear usuario en auth
    const password = strongPassword();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ ok: false, error: createErr?.message ?? "No se pudo crear el usuario" }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    // Crear su fila en profiles con rol admin
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: created.user.id,
      email: ADMIN_EMAIL,
      nombre: "Hilberth",
      apellido: "López",
      rol: "admin",
      estado: "activo",
    });
    if (profileErr) {
      return new Response(
        JSON.stringify({ ok: false, error: profileErr.message }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        created: true,
        message:
          "Admin creado. Usa '¿Olvidaste tu contraseña?' desde /login para establecer la contraseña.",
      }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});