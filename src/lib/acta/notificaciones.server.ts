import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { siteUrlCanonico } from "@/lib/site-url.server";

import {
  renderCorreo,
  type ContextoCorreo,
  type TipoCorreo,
} from "./plantillas-correo";

/**
 * Notificaciones por correo (Parte 13).
 *
 * - Divide los destinatarios en **internos** (admin + implementador) y
 *   **invitados** (miembros del proyecto con rol `cliente`).
 *   Cada grupo recibe un correo con el CTA apuntando a la ruta de
 *   *su* portal (`/app/...` vs `/mi-proyecto/...`).
 * - Llama a la Edge Function `enviar-correo` en un batch. La función
 *   se encarga del proveedor real (Resend / SMTP). Las llaves del
 *   proveedor viven **solo** en secretos del servidor (Sección C).
 * - Registra cada intento en `auditoria` para trazabilidad, aunque el
 *   proveedor de correo no esté configurado todavía.
 */

interface DestinatariosProyecto {
  internos: string[];
  invitados: string[];
}

async function destinatariosProyecto(
  proyectoId: string,
): Promise<DestinatariosProyecto> {
  const { data: internos } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .in("rol", ["admin", "implementador"])
    .eq("estado", "activo");

  const { data: miembros } = await supabaseAdmin
    .from("proyecto_miembros")
    .select("profile_id, profiles!inner(email, rol, estado)")
    .eq("proyecto_id", proyectoId)
    .eq("estado", "activo");

  const invitados = (miembros ?? [])
    .map((m: any) => m.profiles) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter((p: any) => p?.rol === "cliente" && p?.estado === "activo")
    .map((p: any) => p.email as string);

  const unique = (xs: (string | null | undefined)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x)));

  return {
    internos: unique((internos ?? []).map((p: any) => p.email)),
    invitados: unique(invitados),
  };
}

/** URL base del portal. Ver `siteUrlCanonico` para la prioridad. */
async function baseUrl(): Promise<string> {
  return siteUrlCanonico();
}

interface Mensaje {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function enviarBatch(
  mensajes: Mensaje[],
  accion: string,
  entidadId: string,
  actorId: string | null = null,
) {
  if (mensajes.length === 0) return;
  const url = `${process.env.SUPABASE_URL}/functions/v1/enviar-correo`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        "content-type": "application/json",
      },
      body: JSON.stringify({ mensajes }),
    });
    const body = await r.json().catch(() => ({}));
    await supabaseAdmin.rpc("registrar_auditoria", {
      _accion: accion,
      _entidad: "notificacion_correo",
      _entidad_id: entidadId,
      _detalle: {
        destinatarios: mensajes.map((m) => m.to),
        asuntos: mensajes.map((m) => m.subject),
        edge_status: r.status,
        edge_body: body,
      },
      _actor_id: actorId,
    });
  } catch (err) {
    await supabaseAdmin.rpc("registrar_auditoria", {
      _accion: accion,
      _entidad: "notificacion_correo_error",
      _entidad_id: entidadId,
      _detalle: {
        destinatarios: mensajes.map((m) => m.to),
        error: (err as Error).message,
      },
      _actor_id: actorId,
    });
  }
}

/**
 * Notifica a los destinatarios del proyecto (internos + invitados) para
 * los eventos del flujo de revisión.
 *
 * `urlAppPath` y `urlMiProyectoPath` son las rutas relativas al portal
 * (ej.: `/app/modulo/{id}`, `/mi-proyecto/modulo/{id}`).
 */
export async function notificarProyecto(input: {
  proyectoId: string;
  moduloId: string;
  tipo: TipoCorreo;
  contextoBase: ContextoCorreo;
  urlAppPath?: string;
  urlMiProyectoPath?: string;
  actorId?: string | null;
}) {
  const dest = await destinatariosProyecto(input.proyectoId);
  const b = await baseUrl();
  const mensajes: Mensaje[] = [];

  const construir = (emails: string[], ctx: ContextoCorreo) => {
    if (emails.length === 0) return;
    const rendered = renderCorreo(input.tipo, ctx);
    for (const to of emails) {
      mensajes.push({
        to,
        subject: rendered.asunto,
        html: rendered.html,
        text: rendered.texto,
      });
    }
  };

  // Internos
  {
    const ctx = structuredClone(input.contextoBase);
    const url = input.urlAppPath ? `${b}${input.urlAppPath}` : undefined;
    if (ctx.acta && url) ctx.acta.urlModulo = url;
    if (ctx.observaciones && url) ctx.observaciones.urlModulo = url;
    if (ctx.aprobacion && url) ctx.aprobacion.urlModulo = url;
    construir(dest.internos, ctx);
  }
  // Invitados
  {
    const ctx = structuredClone(input.contextoBase);
    const url = input.urlMiProyectoPath ? `${b}${input.urlMiProyectoPath}` : undefined;
    if (ctx.acta && url) ctx.acta.urlModulo = url;
    if (ctx.observaciones && url) ctx.observaciones.urlModulo = url;
    if (ctx.aprobacion && url) ctx.aprobacion.urlModulo = url;
    construir(dest.invitados, ctx);
  }

  await enviarBatch(
    mensajes,
    "notificacion_correo_enviada",
    input.moduloId,
    input.actorId ?? null,
  );
}

/**
 * Envío puntual para invitaciones (Parte 4). Se llama al crear una
 * invitación por token.
 */
export async function notificarInvitacion(input: {
  invitacionId: string;
  destinatario: string;
  empresa: string;
  nombreProyecto?: string;
  urlRegistro: string;
  expiraTexto?: string;
  actorId?: string | null;
}) {
  const rendered = renderCorreo("invitacion", {
    invitacion: {
      empresa: input.empresa,
      nombreProyecto: input.nombreProyecto,
      urlRegistro: input.urlRegistro,
      expiraTexto: input.expiraTexto,
    },
  });
  await enviarBatch(
    [{
      to: input.destinatario,
      subject: rendered.asunto,
      html: rendered.html,
      text: rendered.texto,
    }],
    "notificacion_invitacion_enviada",
    input.invitacionId,
    input.actorId ?? null,
  );
}