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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // Segundo secreto opcional
  const secret = Deno.env.get("CORREO_WEBHOOK_SECRET");
  if (secret) {
    const hdr = req.headers.get("x-egixia-secret");
    if (hdr !== secret) return json({ ok: false, error: "unauthorized" }, 401);
  }

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
  const from = Deno.env.get("CORREO_FROM") ?? "EGIXIA <no-reply@egixia.com>";
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