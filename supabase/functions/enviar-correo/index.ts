// Edge Function `enviar-correo` — envía correos EGIXIA.
//
// La Function acepta un batch de mensajes ya renderizados
// (asunto/HTML/text) y los entrega a través del proveedor configurado
// (Resend por defecto). Las llaves API viven en secretos del proyecto
// y nunca se exponen al frontend (Sección C).
//
// Body:
//   { mensajes: [{ to, subject, html, text }] }
//
// Autenticación: se requiere el header `Authorization: Bearer <SERVICE_ROLE>`
// del propio proyecto. Como esta función se invoca desde el servidor
// de la aplicación, es suficiente. Opcionalmente puedes definir
// `CORREO_WEBHOOK_SECRET` para exigir un segundo secreto.
//
// Si no hay proveedor configurado (`RESEND_API_KEY` vacío) la función
// registra los mensajes en el log de la Function y responde OK con
// `dryRun: true` para que el sistema siga funcionando en desarrollo.

interface Mensaje {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // Autenticación: aceptamos la petición cuando `Authorization: Bearer <token>`
  // coincide con `SUPABASE_SERVICE_ROLE_KEY` (comparación constant-time), que es
  // exactamente lo que envían las server functions del backend EGIXIA.
  // Adicionalmente, si `CORREO_WEBHOOK_SECRET` está definido, aceptamos también
  // llamadas que traigan el header `x-egixia-secret` correcto (defensa extra
  // para invocaciones fuera del backend).
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  let authorized = constantTimeEq(bearer, serviceRole);

  const webhookSecret = Deno.env.get("CORREO_WEBHOOK_SECRET");
  if (!authorized && webhookSecret) {
    const hdr = req.headers.get("x-egixia-secret") ?? "";
    authorized = constantTimeEq(hdr, webhookSecret);
  }
  if (!authorized) return json({ ok: false, error: "unauthorized" }, 401);

  let payload: { mensajes?: Mensaje[] };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  const mensajes = payload.mensajes ?? [];
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return json({ ok: true, results: [] });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  // Fuente única de verdad del remitente: configuracion_sistema.clave='correo'.
  // Se lee una vez por invocación; si falla, usamos CORREO_FROM o el default.
  let from = Deno.env.get("CORREO_FROM") ?? "EGIXIA <no-reply@egixia.com>";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (supabaseUrl && serviceRole) {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/configuracion_sistema?clave=eq.correo&select=valor`,
        {
          headers: {
            apikey: serviceRole,
            authorization: `Bearer ${serviceRole}`,
          },
        },
      );
      if (r.ok) {
        const rows = (await r.json()) as Array<{ valor?: { from_nombre?: string; from_email?: string } }>;
        const v = rows?.[0]?.valor;
        if (v?.from_nombre && v?.from_email) {
          from = `${v.from_nombre} <${v.from_email}>`;
        }
      }
    }
  } catch (err) {
    console.log(`[enviar-correo] no se pudo leer configuracion_sistema: ${(err as Error).message}`);
  }
  const results: Array<{ to: string; status: number | string; dryRun?: boolean }> = [];

  for (const m of mensajes) {
    if (!m?.to || !m?.subject || !m?.html) {
      results.push({ to: String(m?.to ?? ""), status: "invalid_message" });
      continue;
    }
    if (!resendKey) {
      console.log(`[enviar-correo:dry-run] → ${m.to} · ${m.subject}`);
      results.push({ to: m.to, status: "dry_run", dryRun: true });
      continue;
    }
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
        }),
      });
      results.push({ to: m.to, status: r.status });
    } catch (err) {
      results.push({ to: m.to, status: `error:${(err as Error).message}` });
    }
  }

  return json({ ok: true, results });
});