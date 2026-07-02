import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

import type {
  CampoDefinicion,
  ColumnaTabla,
  ModuloDefinicion,
  SeccionDefinicion,
} from "@/lib/form-engine/tipos";
import {
  campoActivo,
  campoVisible,
} from "@/lib/form-engine/validacion";

/**
 * Motor del **Acta por módulo** (Parte 13).
 *
 * Este módulo es totalmente puro y sin dependencias del navegador ni
 * de Supabase, por lo que puede usarse indistintamente en:
 *   - **cliente**: previsualización/descarga inmediata para el invitado.
 *   - **servidor**: generación firmada que se persiste en el bucket
 *     privado `actas` al enviar/reenviar a revisión.
 *
 * pdf-lib se ejecuta correctamente en el runtime Worker (SSR / Edge)
 * y en el navegador, así que la misma función `generarActaPDF`
 * produce los mismos bytes en ambos entornos.
 */

// -------- Modelo de datos del acta ----------------------------------------

export interface FilaActa {
  label: string;
  valor: string;
}

export interface SeccionActa {
  titulo: string;
  filas: FilaActa[];
}

export interface DatosActa {
  proyecto: string;
  empresa: string | null;
  moduloNombre: string;
  autorNombre: string;
  autorEmail: string;
  /** Fecha/hora del acta. */
  fecha: Date;
  /** Versión secuencial del acta para el módulo (1, 2, 3, …). */
  version: number;
  secciones: SeccionActa[];
}

// -------- Formateo de valores para el resumen -----------------------------

function formatearValor(campo: CampoDefinicion, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";

  switch (campo.tipo) {
    case "select":
    case "radio_tarjetas": {
      const op = campo.opciones?.find((o) => o.valor === valor);
      return op ? op.etiqueta : String(valor);
    }
    case "checkbox_multiple": {
      if (!Array.isArray(valor) || valor.length === 0) return "—";
      return valor
        .map((v) => {
          const op = campo.opciones?.find((o) => o.valor === v);
          return op ? op.etiqueta : String(v);
        })
        .join(", ");
    }
    case "color":
      return String(valor).toUpperCase();
    case "archivo": {
      const v = valor as {
        nombre?: string;
        storagePath?: string;
        bucket?: string;
      };
      if (!v?.nombre) return "—";
      const ruta = v.bucket && v.storagePath ? ` (${v.bucket}/${v.storagePath})` : "";
      return `${v.nombre}${ruta}`;
    }
    case "numero":
      return String(valor);
    default:
      return String(valor);
  }
}

function formatearCeldaTabla(col: ColumnaTabla, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (col.tipo === "select") {
    const op = col.opciones?.find((o) => o.valor === valor);
    return op ? op.etiqueta : String(valor);
  }
  if (col.tipo === "archivo") {
    const v = valor as { nombre?: string; bucket?: string; storagePath?: string };
    if (!v?.nombre) return "—";
    return v.bucket && v.storagePath ? `${v.nombre} (${v.bucket}/${v.storagePath})` : v.nombre;
  }
  return String(valor);
}

/**
 * Transforma `datos` + `definicion` en la lista de secciones legibles
 * que compondrán la tabla del acta.
 */
export function extraerFilasActa(
  definicion: ModuloDefinicion,
  datos: Record<string, unknown>,
): SeccionActa[] {
  const out: SeccionActa[] = [];
  for (const seccion of definicion.secciones) {
    const filas: FilaActa[] = [];
    for (const campo of seccion.campos) {
      if (campo.tipo === "info") continue;
      if (!campoActivo(campo)) continue;
      if (!campoVisible(campo, datos)) continue;

      const valor = datos[campo.key];

      if (campo.tipo === "tabla" && campo.columnas) {
        const filasTabla = (valor as Array<Record<string, unknown>>) ?? [];
        if (filasTabla.length === 0) {
          filas.push({ label: campo.label, valor: "— (sin registros)" });
          continue;
        }
        filas.push({
          label: campo.label,
          valor: `${filasTabla.length} registro(s)`,
        });
        filasTabla.forEach((fila, idx) => {
          const partes = campo.columnas!.map(
            (c) => `${c.label}: ${formatearCeldaTabla(c, fila[c.key])}`,
          );
          filas.push({
            label: `   · Fila ${idx + 1}`,
            valor: partes.join(" · "),
          });
        });
      } else {
        filas.push({ label: campo.label, valor: formatearValor(campo, valor) });
      }
    }
    if (filas.length > 0) out.push({ titulo: seccion.titulo, filas });
  }
  return out;
}

// -------- Render con pdf-lib ----------------------------------------------

const AZUL_EGIXIA = rgb(15 / 255, 43 / 255, 142 / 255); // #0F2B8E
const AZUL_OSCURO = rgb(11 / 255, 30 / 255, 98 / 255); // #0B1E62
const GRIS_TEXTO = rgb(31 / 255, 41 / 255, 55 / 255);
const GRIS_SUAVE = rgb(107 / 255, 114 / 255, 128 / 255);
const GRIS_BORDE = rgb(224 / 255, 227 / 255, 235 / 255);
const FONDO_BAND = rgb(240 / 255, 244 / 255, 248 / 255);

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  /** Cursor vertical (desde arriba). */
  y: number;
  /** Márgenes. */
  margin: number;
  ancho: number;
  alto: number;
}

function partirEnLineas(texto: string, font: PDFFont, size: number, maxAncho: number): string[] {
  const palabras = texto.replace(/\s+/g, " ").trim().split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const tentativa = actual ? `${actual} ${p}` : p;
    const w = font.widthOfTextAtSize(tentativa, size);
    if (w > maxAncho && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = tentativa;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function nuevaPagina(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([612, 792]);
  ctx.y = ctx.alto - ctx.margin;
}

function asegurarEspacio(ctx: Ctx, alto: number) {
  if (ctx.y - alto < ctx.margin + 40) {
    nuevaPagina(ctx);
  }
}

function pieDePagina(ctx: Ctx) {
  const paginas = ctx.pdf.getPages();
  const total = paginas.length;
  paginas.forEach((page, i) => {
    const texto = `EGIXIA · Acta generada el ${new Date().toISOString().slice(0, 10)} · Página ${i + 1} de ${total}`;
    page.drawText(texto, {
      x: ctx.margin,
      y: 24,
      size: 8,
      font: ctx.regular,
      color: GRIS_SUAVE,
    });
  });
}

function drawEncabezado(ctx: Ctx, datos: DatosActa) {
  // Banda azul superior
  ctx.page.drawRectangle({
    x: 0,
    y: ctx.alto - 90,
    width: ctx.ancho,
    height: 90,
    color: AZUL_EGIXIA,
  });
  ctx.page.drawText("EGIXIA", {
    x: ctx.margin,
    y: ctx.alto - 45,
    size: 22,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });
  ctx.page.drawText("Portal de Configuración de tu Implementación", {
    x: ctx.margin,
    y: ctx.alto - 65,
    size: 10,
    font: ctx.regular,
    color: rgb(0.9, 0.93, 1),
  });
  ctx.page.drawText(`Acta v${datos.version}`, {
    x: ctx.ancho - ctx.margin - 70,
    y: ctx.alto - 45,
    size: 12,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  });

  ctx.y = ctx.alto - 90 - 30;

  // Título del acta
  ctx.page.drawText("Acta de configuración del módulo", {
    x: ctx.margin,
    y: ctx.y,
    size: 16,
    font: ctx.bold,
    color: AZUL_OSCURO,
  });
  ctx.y -= 22;
  ctx.page.drawText(datos.moduloNombre, {
    x: ctx.margin,
    y: ctx.y,
    size: 13,
    font: ctx.regular,
    color: GRIS_TEXTO,
  });
  ctx.y -= 22;
}

function drawMetaBox(ctx: Ctx, datos: DatosActa) {
  const alto = 90;
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: ctx.y - alto,
    width: ctx.ancho - ctx.margin * 2,
    height: alto,
    color: FONDO_BAND,
    borderColor: GRIS_BORDE,
    borderWidth: 0.5,
  });
  const pad = 12;
  const col1 = ctx.margin + pad;
  const col2 = ctx.margin + (ctx.ancho - ctx.margin * 2) / 2 + pad;
  const filas: Array<[string, string, string, string]> = [
    ["Proyecto", datos.proyecto, "Empresa", datos.empresa ?? "—"],
    ["Diligenciado por", datos.autorNombre, "Correo", datos.autorEmail],
    [
      "Fecha y hora",
      datos.fecha.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" }),
      "Versión del acta",
      `v${datos.version}`,
    ],
  ];
  let y = ctx.y - pad - 10;
  for (const [l1, v1, l2, v2] of filas) {
    ctx.page.drawText(l1.toUpperCase(), { x: col1, y, size: 7, font: ctx.bold, color: GRIS_SUAVE });
    ctx.page.drawText(v1, { x: col1, y: y - 10, size: 10, font: ctx.regular, color: GRIS_TEXTO });
    ctx.page.drawText(l2.toUpperCase(), { x: col2, y, size: 7, font: ctx.bold, color: GRIS_SUAVE });
    ctx.page.drawText(v2, { x: col2, y: y - 10, size: 10, font: ctx.regular, color: GRIS_TEXTO });
    y -= 24;
  }
  ctx.y -= alto + 16;
}

function drawSeccion(ctx: Ctx, seccion: SeccionActa) {
  asegurarEspacio(ctx, 40);
  // Título de sección
  ctx.page.drawText(seccion.titulo.toUpperCase(), {
    x: ctx.margin,
    y: ctx.y,
    size: 10,
    font: ctx.bold,
    color: AZUL_EGIXIA,
  });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.y },
    end: { x: ctx.ancho - ctx.margin, y: ctx.y },
    thickness: 0.6,
    color: AZUL_EGIXIA,
  });
  ctx.y -= 14;

  const anchoLabel = 180;
  const anchoValor = ctx.ancho - ctx.margin * 2 - anchoLabel - 10;

  for (const fila of seccion.filas) {
    const lineasLabel = partirEnLineas(fila.label, ctx.regular, 9, anchoLabel);
    const lineasValor = partirEnLineas(fila.valor, ctx.regular, 9, anchoValor);
    const nLineas = Math.max(lineasLabel.length, lineasValor.length);
    const alto = nLineas * 12 + 6;
    asegurarEspacio(ctx, alto);

    lineasLabel.forEach((ln, i) => {
      ctx.page.drawText(ln, {
        x: ctx.margin,
        y: ctx.y - i * 12,
        size: 9,
        font: ctx.bold,
        color: GRIS_TEXTO,
      });
    });
    lineasValor.forEach((ln, i) => {
      ctx.page.drawText(ln, {
        x: ctx.margin + anchoLabel + 10,
        y: ctx.y - i * 12,
        size: 9,
        font: ctx.regular,
        color: GRIS_TEXTO,
      });
    });
    ctx.y -= alto;
    // Separador tenue
    ctx.page.drawLine({
      start: { x: ctx.margin, y: ctx.y + 2 },
      end: { x: ctx.ancho - ctx.margin, y: ctx.y + 2 },
      thickness: 0.3,
      color: GRIS_BORDE,
    });
    ctx.y -= 4;
  }
  ctx.y -= 12;
}

function drawDeclaracion(ctx: Ctx, datos: DatosActa) {
  const texto =
    "El cliente confirma que la información registrada en este documento es la que EGIXIA implementará en el Portal de Proveedores. Cualquier ajuste posterior deberá gestionarse a través del proceso de observaciones y una nueva versión del acta.";
  const lineas = partirEnLineas(texto, ctx.regular, 10, ctx.ancho - ctx.margin * 2 - 24);
  const altoBloque = lineas.length * 14 + 60;
  asegurarEspacio(ctx, altoBloque);

  ctx.page.drawRectangle({
    x: ctx.margin,
    y: ctx.y - altoBloque,
    width: ctx.ancho - ctx.margin * 2,
    height: altoBloque,
    color: FONDO_BAND,
    borderColor: AZUL_EGIXIA,
    borderWidth: 0.6,
  });
  ctx.page.drawText("DECLARACIÓN DE CONFORMIDAD", {
    x: ctx.margin + 12,
    y: ctx.y - 18,
    size: 9,
    font: ctx.bold,
    color: AZUL_EGIXIA,
  });
  let y = ctx.y - 34;
  for (const ln of lineas) {
    ctx.page.drawText(ln, {
      x: ctx.margin + 12,
      y,
      size: 10,
      font: ctx.regular,
      color: GRIS_TEXTO,
    });
    y -= 14;
  }
  ctx.page.drawText(
    `${datos.autorNombre} · ${datos.autorEmail}`,
    { x: ctx.margin + 12, y: y - 6, size: 9, font: ctx.bold, color: AZUL_OSCURO },
  );
  ctx.y -= altoBloque + 8;
}

/** Genera los bytes del PDF del acta a partir de los datos ya extraídos. */
export async function generarActaPDF(datos: DatosActa): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Acta ${datos.moduloNombre} v${datos.version}`);
  pdf.setAuthor("EGIXIA");
  pdf.setSubject("Acta de configuración por módulo");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const ctx: Ctx = {
    pdf,
    page,
    regular,
    bold,
    y: 792 - 50,
    margin: 50,
    ancho: 612,
    alto: 792,
  };

  drawEncabezado(ctx, datos);
  drawMetaBox(ctx, datos);
  for (const seccion of datos.secciones) {
    drawSeccion(ctx, seccion);
  }
  if (datos.secciones.length === 0) {
    ctx.page.drawText("Este módulo no tiene datos diligenciados aún.", {
      x: ctx.margin,
      y: ctx.y,
      size: 10,
      font: ctx.regular,
      color: GRIS_SUAVE,
    });
    ctx.y -= 20;
  }
  drawDeclaracion(ctx, datos);
  pieDePagina(ctx);

  return pdf.save();
}

/** Utilidad conveniente: `Uint8Array` → base64 (sin dependencias). */
export function bytesABase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)),
    );
  }
  // eslint-disable-next-line no-restricted-globals
  return typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
}

/** base64 → Uint8Array (para el cliente al descargar). */
export function base64ABytes(b64: string): Uint8Array {
  // eslint-disable-next-line no-restricted-globals
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Re-export para servidores que necesiten armar el DTO en un paso.
export type { SeccionDefinicion };
