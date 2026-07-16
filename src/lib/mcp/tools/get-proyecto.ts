import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_proyecto",
  title: "Detalle de un proyecto",
  description:
    "Devuelve los datos generales de un proyecto EGIXIA y el listado de sus módulos con estado, progreso y fecha límite. Requiere pertenecer al proyecto o ser parte del equipo interno.",
  inputSchema: {
    proyecto_id: z.string().uuid().describe("UUID del proyecto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ proyecto_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const [{ data: proyecto, error: e1 }, { data: modulos, error: e2 }] = await Promise.all([
      sb.from("proyectos").select("id, nombre, empresa, estado, created_at, updated_at").eq("id", proyecto_id).maybeSingle(),
      sb.from("proyecto_modulos").select("id, modulo_key, estado, progreso, fecha_limite, enviado_at, revisado_at").eq("proyecto_id", proyecto_id).order("modulo_key"),
    ]);
    if (e1 || e2) {
      return { content: [{ type: "text", text: (e1 ?? e2)!.message }], isError: true };
    }
    if (!proyecto) {
      return { content: [{ type: "text", text: "Proyecto no encontrado o sin acceso." }], isError: true };
    }
    const payload = { proyecto, modulos: modulos ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});