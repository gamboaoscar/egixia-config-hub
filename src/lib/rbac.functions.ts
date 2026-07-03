import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verifica en el servidor que el usuario autenticado es parte del equipo
 * interno de EGIXIA (admin o implementador). Devuelve el rol para que la
 * capa de UI pueda ajustar su render, pero el bloqueo real ocurre aquí:
 * si un cliente intenta cargar `/app/*` recibe un error y el `beforeLoad`
 * lo redirige a su propio espacio.
 */
export const exigirEquipoInterno = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("rol, estado")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("No se pudo verificar el perfil.");
    if (!data) throw new Error("Perfil no encontrado.");
    if (data.estado === "inhabilitado") throw new Error("Cuenta inhabilitada.");
    if (data.rol !== "admin" && data.rol !== "implementador") {
      throw new Error("forbidden");
    }
    return { rol: data.rol as "admin" | "implementador" };
  });