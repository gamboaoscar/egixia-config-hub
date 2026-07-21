/**
 * Plantillas de correo con identidad EGIXIA (Parte 13).
 *
 * Todas las plantillas comparten un layout limpio, calmado y sobrio:
 *   - banda azul primario (#0F2B8E) con "EGIXIA" en blanco,
 *   - cuerpo con tipografía sans-serif del sistema, texto oscuro
 *     (#1F2937) sobre fondo suave (#F0F4F8),
 *   - botón de acción en primario y una zona de pie con enlace de
 *     ayuda y aviso legal breve.
 *
 * El módulo es puro (solo devuelve HTML/asunto), así que se puede usar
 * tanto en la Edge Function `enviar-correo` (Deno) como en cualquier
 * server function que quiera previsualizar o cachear el contenido.
 */

export type TipoCorreo =
  | "invitacion"
  | "acta_envio"
  | "acta_devolucion"
  | "acta_aprobacion"
  | "extension_solicitada"
  | "observacion_respondida"
  | "recordatorio";

export interface ContextoCorreo {
  invitacion?: {
    empresa: string;
    nombreProyecto?: string;
    urlRegistro: string;
    expiraTexto?: string;
  };
  acta?: {
    proyecto: string;
    empresa?: string | null;
    moduloNombre: string;
    version: number;
    autorNombre: string;
    /** URL firmada (temporal) al PDF del acta en Storage. */
    urlActa?: string;
    /** URL profunda al módulo dentro del portal. */
    urlModulo?: string;
  };
  observaciones?: {
    proyecto: string;
    moduloNombre: string;
    cantidad: number;
    urlModulo?: string;
  };
  aprobacion?: {
    proyecto: string;
    moduloNombre: string;
    urlModulo?: string;
  };
  extension?: {
    proyecto: string;
    moduloNombre: string;
    solicitanteNombre: string;
    /** Fecha límite vencida (YYYY-MM-DD) como texto ya formateado. */
    fechaLimiteTexto?: string;
    urlModulo?: string;
  };
  respuesta?: {
    proyecto: string;
    moduloNombre: string;
    campoKey: string;
    autorNombre: string;
    /** Texto de la respuesta (se escapa al renderizar). */
    mensaje: string;
    urlModulo?: string;
  };
  recordatorio?: {
    proyecto: string;
    /** Módulos pendientes: nombre + estado legible + fecha límite si tiene. */
    modulos: Array<{
      nombre: string;
      estado: string;
      fechaLimiteTexto?: string;
    }>;
    /** URL al portal del cliente (site_url + /mi-proyecto). */
    urlPortal?: string;
  };
}

export interface CorreoRenderizado {
  asunto: string;
  html: string;
  texto: string;
}

// ---------- Layout base ----------------------------------------------------

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function envolver(opciones: {
  titulo: string;
  intro: string;
  cuerpoHtml: string;
  cta?: { texto: string; url: string };
  nota?: string;
}): string {
  const { titulo, intro, cuerpoHtml, cta, nota } = opciones;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,43,142,0.06);">
          <tr>
            <td style="background:#0F2B8E;padding:24px 28px;">
              <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.5px;">EGIXIA</div>
              <div style="color:#D6DEF4;font-size:12px;margin-top:4px;">Portal de Configuración de tu Implementación</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 12px;color:#0B1E62;font-size:20px;font-weight:600;">${escaparHtml(titulo)}</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#374151;">${intro}</p>
              ${cuerpoHtml}
              ${
                cta
                  ? `<div style="margin:24px 0 8px;"><a href="${escaparHtml(cta.url)}" style="display:inline-block;background:#0F2B8E;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">${escaparHtml(cta.texto)}</a></div>`
                  : ""
              }
              ${
                nota
                  ? `<p style="margin:16px 0 0;font-size:12px;color:#6B7280;line-height:1.55;">${nota}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="background:#F0F4F8;padding:16px 28px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:11px;color:#6B7280;line-height:1.55;">
                Este mensaje fue enviado automáticamente por EGIXIA. Si no esperabas recibirlo, ignóralo — no realizamos cambios sin tu confirmación.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function tablaMeta(pares: Array<[string, string]>): string {
  const filas = pares
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;font-size:12px;color:#6B7280;width:140px;">${escaparHtml(k)}</td><td style="padding:6px 0;font-size:13px;color:#1F2937;font-weight:500;">${escaparHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;margin:8px 0 4px;">${filas}</table>`;
}

// ---------- Plantillas ----------------------------------------------------

export function renderCorreo(
  tipo: TipoCorreo,
  ctx: ContextoCorreo,
): CorreoRenderizado {
  switch (tipo) {
    case "invitacion": {
      const c = ctx.invitacion;
      if (!c) throw new Error("Falta contexto de invitación.");
      const asunto = `EGIXIA · Invitación para configurar ${c.empresa}`;
      const meta: Array<[string, string]> = [["Empresa", c.empresa]];
      if (c.nombreProyecto) meta.push(["Proyecto", c.nombreProyecto]);
      if (c.expiraTexto) meta.push(["Válida hasta", c.expiraTexto]);
      const html = envolver({
        titulo: "Te invitamos a configurar tu portal",
        intro:
          "Hola. EGIXIA implementará el Portal de Proveedores para tu empresa y necesitamos que registres la información inicial. Usa el botón para crear tu acceso.",
        cuerpoHtml: tablaMeta(meta),
        cta: { texto: "Crear mi acceso", url: c.urlRegistro },
        nota:
          "Si el botón no funciona, copia y pega este enlace en tu navegador: " +
          `<span style="word-break:break-all;color:#0F2B8E;">${escaparHtml(c.urlRegistro)}</span>`,
      });
      const texto = `EGIXIA · Invitación\n\nRegistra tu acceso: ${c.urlRegistro}\n`;
      return { asunto, html, texto };
    }

    case "acta_envio": {
      const c = ctx.acta;
      if (!c) throw new Error("Falta contexto de acta.");
      const asunto = `EGIXIA · Acta v${c.version} — ${c.moduloNombre}`;
      const meta: Array<[string, string]> = [
        ["Proyecto", c.proyecto],
        ...(c.empresa ? ([["Empresa", c.empresa]] as [string, string][]) : []),
        ["Módulo", c.moduloNombre],
        ["Diligenciado por", c.autorNombre],
        ["Versión del acta", `v${c.version}`],
      ];
      const html = envolver({
        titulo: "Módulo enviado a revisión",
        intro:
          "El proveedor completó y envió a revisión un módulo del portal. Se adjunta el acta con el resumen de la configuración registrada.",
        cuerpoHtml: tablaMeta(meta),
        cta: c.urlActa
          ? { texto: "Descargar acta (PDF)", url: c.urlActa }
          : c.urlModulo
            ? { texto: "Abrir módulo", url: c.urlModulo }
            : undefined,
        nota: c.urlModulo
          ? `También puedes abrir el módulo en el portal: <a href="${escaparHtml(c.urlModulo)}" style="color:#0F2B8E;">ir al módulo</a>.`
          : undefined,
      });
      const texto = `EGIXIA · Acta v${c.version}\nMódulo: ${c.moduloNombre}\nProyecto: ${c.proyecto}\n${c.urlActa ? `Acta PDF: ${c.urlActa}\n` : ""}${c.urlModulo ? `Módulo: ${c.urlModulo}\n` : ""}`;
      return { asunto, html, texto };
    }

    case "acta_devolucion": {
      const c = ctx.observaciones;
      if (!c) throw new Error("Falta contexto de observaciones.");
      const asunto = `EGIXIA · Módulo devuelto con observaciones — ${c.moduloNombre}`;
      const meta: Array<[string, string]> = [
        ["Proyecto", c.proyecto],
        ["Módulo", c.moduloNombre],
        ["Observaciones", String(c.cantidad)],
      ];
      const html = envolver({
        titulo: "Devolución con observaciones",
        intro: `El equipo de EGIXIA revisó el módulo y dejó ${c.cantidad} observación(es) por corregir. Cuando termines los ajustes, reenvía el módulo a revisión.`,
        cuerpoHtml: tablaMeta(meta),
        cta: c.urlModulo
          ? { texto: "Ir al módulo", url: c.urlModulo }
          : undefined,
      });
      const texto = `EGIXIA · Devolución con observaciones\nMódulo: ${c.moduloNombre}\nObservaciones: ${c.cantidad}\n${c.urlModulo ? `Módulo: ${c.urlModulo}\n` : ""}`;
      return { asunto, html, texto };
    }

    case "acta_aprobacion": {
      const c = ctx.aprobacion;
      if (!c) throw new Error("Falta contexto de aprobación.");
      const asunto = `EGIXIA · Módulo aprobado — ${c.moduloNombre}`;
      const meta: Array<[string, string]> = [
        ["Proyecto", c.proyecto],
        ["Módulo", c.moduloNombre],
      ];
      const html = envolver({
        titulo: "Módulo aprobado",
        intro:
          "El equipo de EGIXIA aprobó este módulo. Cuando todos los módulos del proyecto queden aprobados, el proyecto pasa automáticamente al estado ‘completado’.",
        cuerpoHtml: tablaMeta(meta),
        cta: c.urlModulo
          ? { texto: "Ver módulo aprobado", url: c.urlModulo }
          : undefined,
      });
      const texto = `EGIXIA · Módulo aprobado\nMódulo: ${c.moduloNombre}\nProyecto: ${c.proyecto}\n${c.urlModulo ? `Módulo: ${c.urlModulo}\n` : ""}`;
      return { asunto, html, texto };
    }

    case "extension_solicitada": {
      const c = ctx.extension;
      if (!c) throw new Error("Falta contexto de extensión.");
      const asunto = `Solicitud de extensión de plazo — ${c.moduloNombre} · ${c.proyecto}`;
      const meta: Array<[string, string]> = [
        ["Proyecto", c.proyecto],
        ["Módulo", c.moduloNombre],
        ["Solicitada por", c.solicitanteNombre],
        ...(c.fechaLimiteTexto
          ? ([["Fecha límite vencida", c.fechaLimiteTexto]] as [string, string][])
          : []),
      ];
      const html = envolver({
        titulo: "Solicitud de extensión de plazo",
        intro:
          "El plazo del módulo venció y el cliente solicitó una extensión. Para concederla, amplía la fecha límite del módulo desde su configuración.",
        cuerpoHtml: tablaMeta(meta),
        cta: c.urlModulo
          ? { texto: "Revisar módulo", url: c.urlModulo }
          : undefined,
      });
      const texto = `EGIXIA · Solicitud de extensión de plazo\nMódulo: ${c.moduloNombre}\nProyecto: ${c.proyecto}\nSolicitada por: ${c.solicitanteNombre}\n${c.urlModulo ? `Módulo: ${c.urlModulo}\n` : ""}`;
      return { asunto, html, texto };
    }

    case "observacion_respondida": {
      const c = ctx.respuesta;
      if (!c) throw new Error("Falta contexto de respuesta.");
      const asunto = `EGIXIA · Nueva respuesta en una observación — ${c.moduloNombre}`;
      const meta: Array<[string, string]> = [
        ["Proyecto", c.proyecto],
        ["Módulo", c.moduloNombre],
        ["Campo observado", c.campoKey],
        ["Respondida por", c.autorNombre],
      ];
      const html = envolver({
        titulo: "Nueva respuesta en una observación",
        intro: `${escaparHtml(c.autorNombre)} respondió a una observación del módulo:`,
        cuerpoHtml:
          tablaMeta(meta) +
          `<blockquote style="margin:16px 0 0;padding:12px 16px;border-left:3px solid #0F2B8E;background:#F0F4F8;border-radius:0 10px 10px 0;font-size:14px;line-height:1.55;color:#1F2937;white-space:pre-wrap;">${escaparHtml(c.mensaje)}</blockquote>`,
        cta: c.urlModulo
          ? { texto: "Ver la conversación", url: c.urlModulo }
          : undefined,
      });
      const texto = `EGIXIA · Nueva respuesta en una observación\nMódulo: ${c.moduloNombre}\nProyecto: ${c.proyecto}\nDe: ${c.autorNombre}\n\n${c.mensaje}\n${c.urlModulo ? `\nMódulo: ${c.urlModulo}\n` : ""}`;
      return { asunto, html, texto };
    }

    case "recordatorio": {
      const c = ctx.recordatorio;
      if (!c) throw new Error("Falta contexto de recordatorio.");
      const asunto =
        "Recordatorio: tu configuración del Portal de Proveedores está esperando";
      const filas = c.modulos
        .map(
          (m) =>
            `<tr><td style="padding:6px 0;font-size:13px;color:#1F2937;font-weight:500;">${escaparHtml(m.nombre)}</td><td style="padding:6px 0;font-size:12px;color:#6B7280;">${escaparHtml(m.estado)}</td><td style="padding:6px 0;font-size:12px;color:#6B7280;text-align:right;">${m.fechaLimiteTexto ? `vence el ${escaparHtml(m.fechaLimiteTexto)}` : ""}</td></tr>`,
        )
        .join("");
      const listaHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;margin:8px 0 4px;">${filas}</table>`;
      const html = envolver({
        titulo: "Tu configuración te está esperando",
        intro: `Hola. Notamos que hace unos días no hay avances en la configuración del proyecto <strong>${escaparHtml(c.proyecto)}</strong>. Estos módulos siguen pendientes — retomarlos toma solo unos minutos y nos ayuda a mantener tu implementación al día:`,
        cuerpoHtml: listaHtml,
        cta: c.urlPortal
          ? { texto: "Continuar mi configuración", url: c.urlPortal }
          : undefined,
        nota:
          "Si ya retomaste el diligenciamiento o tienes dudas sobre algún módulo, escríbenos — con gusto te acompañamos.",
      });
      const lineas = c.modulos
        .map(
          (m) =>
            `- ${m.nombre} · ${m.estado}${m.fechaLimiteTexto ? ` · vence el ${m.fechaLimiteTexto}` : ""}`,
        )
        .join("\n");
      const texto = `EGIXIA · Recordatorio\nProyecto: ${c.proyecto}\n\nMódulos pendientes:\n${lineas}\n${c.urlPortal ? `\nContinúa aquí: ${c.urlPortal}\n` : ""}`;
      return { asunto, html, texto };
    }
  }
}