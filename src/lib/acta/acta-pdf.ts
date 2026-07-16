import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";

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
import { fechaISOBogota, formatoFechaHoraCO } from "@/lib/fechas";

/**
 * Motor del **Acta por módulo** (Parte 13), reescrito con `pdf-lib`.
 *
 * Solo se importa dinámicamente desde el servidor, así `pdf-lib` no entra
 * al bundle del cliente. Incrusta imágenes del cliente en su sección y
 * fusiona los PDFs adjuntos al final como anexos con portada "ANEXO N".
 */

// -------- Modelo de datos del acta ----------------------------------------

export interface ImagenActa {
  bytes: Uint8Array;
  mime: string;
  nombre?: string;
}

export interface FilaActa {
  label: string;
  valor: string;
  imagen?: ImagenActa;
}

export interface SeccionActa {
  titulo: string;
  filas: FilaActa[];
}

export interface AnexoActa {
  nombre: string;
  bytes?: Uint8Array;
  motivoOmision?: string;
}

export interface DatosActa {
  proyecto: string;
  empresa: string | null;
  moduloNombre: string;
  autorNombre: string;
  autorEmail: string;
  fecha: Date;
  version: number;
  secciones: SeccionActa[];
  anexos?: AnexoActa[];
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
      const v = valor as { nombre?: string };
      return v?.nombre ? v.nombre : "—";
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
    const v = valor as { nombre?: string };
    return v?.nombre ? v.nombre : "—";
  }
  return String(valor);
}

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

// -------- Constantes visuales --------------------------------------------

const AZUL_EGIXIA: RGB = rgb(15 / 255, 43 / 255, 142 / 255);
const AZUL_OSCURO: RGB = rgb(11 / 255, 30 / 255, 98 / 255);
const GRIS_TEXTO: RGB = rgb(31 / 255, 41 / 255, 55 / 255);
const GRIS_SUAVE: RGB = rgb(107 / 255, 114 / 255, 128 / 255);
const GRIS_BORDE: RGB = rgb(224 / 255, 227 / 255, 235 / 255);
const FONDO_BAND: RGB = rgb(240 / 255, 244 / 255, 248 / 255);
const BLANCO: RGB = rgb(1, 1, 1);
const AZUL_CLARO: RGB = rgb(0.9, 0.93, 1);

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 50;
const PIE_ALTURA = 34;

// -------- Helpers de texto -----------------------------------------------

function limpiarTexto(texto: string): string {
  const salida = texto
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "·")
    .replace(/[\r\n\t]+/g, " ");
  let resultado = "";
  for (const ch of salida) {
    resultado += ch.charCodeAt(0) > 255 ? "?" : ch;
  }
  return resultado;
}

function cortarPalabra(
  palabra: string,
  font: PDFFont,
  size: number,
  maxAncho: number,
): string[] {
  const partes: string[] = [];
  let actual = "";
  for (const ch of palabra) {
    const tentativa = actual + ch;
    if (actual && font.widthOfTextAtSize(tentativa, size) > maxAncho) {
      partes.push(actual);
      actual = ch;
    } else {
      actual = tentativa;
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

function partirEnLineas(
  texto: string,
  font: PDFFont,
  size: number,
  maxAncho: number,
): string[] {
  const t = limpiarTexto(texto);
  const palabras = t.replace(/\s+/g, " ").trim().split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const tentativa = actual ? `${actual} ${p}` : p;
    if (font.widthOfTextAtSize(tentativa, size) > maxAncho && actual) {
      lineas.push(actual);
      if (font.widthOfTextAtSize(p, size) > maxAncho) {
        const partes = cortarPalabra(p, font, size, maxAncho);
        lineas.push(...partes.slice(0, -1));
        actual = partes.at(-1) ?? "";
      } else {
        actual = p;
      }
    } else if (font.widthOfTextAtSize(tentativa, size) > maxAncho) {
      const partes = cortarPalabra(p, font, size, maxAncho);
      lineas.push(...partes.slice(0, -1));
      actual = partes.at(-1) ?? "";
    } else {
      actual = tentativa;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : ["—"];
}

// -------- Contexto y paginación -----------------------------------------

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  helv: PDFFont;
  helvBold: PDFFont;
  datos: DatosActa;
  paginasActa: number[];
}

interface TextoOpts {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  color?: RGB;
}

function texto(ctx: Ctx, t: string, opts: TextoOpts) {
  ctx.page.drawText(limpiarTexto(t), {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.bold ? ctx.helvBold : ctx.helv,
    color: opts.color ?? GRIS_TEXTO,
  });
}

function encabezadoContinuacion(ctx: Ctx) {
  ctx.page.drawRectangle({
    x: 0,
    y: ALTO - 34,
    width: ANCHO,
    height: 34,
    color: AZUL_EGIXIA,
  });
  texto(ctx, "EGIXIA", {
    x: MARGEN,
    y: ALTO - 22,
    size: 11,
    bold: true,
    color: BLANCO,
  });
  texto(
    ctx,
    `Acta de configuración · ${ctx.datos.moduloNombre} · v${ctx.datos.version}`,
    {
      x: MARGEN + 70,
      y: ALTO - 22,
      size: 9,
      color: AZUL_CLARO,
    },
  );
}

function nuevaPagina(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([ANCHO, ALTO]);
  ctx.paginasActa.push(ctx.doc.getPages().length - 1);
  encabezadoContinuacion(ctx);
  ctx.y = ALTO - 34 - 24;
}

function asegurar(ctx: Ctx, alto: number) {
  if (ctx.y - alto < MARGEN + PIE_ALTURA) {
    nuevaPagina(ctx);
  }
}

// -------- Portada, metadatos, secciones ---------------------------------

function portada(ctx: Ctx) {
  const d = ctx.datos;
  ctx.page.drawRectangle({
    x: 0,
    y: ALTO - 90,
    width: ANCHO,
    height: 90,
    color: AZUL_EGIXIA,
  });
  texto(ctx, "EGIXIA", {
    x: MARGEN,
    y: ALTO - 45,
    size: 22,
    bold: true,
    color: BLANCO,
  });
  texto(ctx, "Portal de Configuración de tu Implementación", {
    x: MARGEN,
    y: ALTO - 65,
    size: 10,
    color: AZUL_CLARO,
  });
  const versionLabel = `Acta v${d.version}`;
  const wv = ctx.helvBold.widthOfTextAtSize(versionLabel, 12);
  texto(ctx, versionLabel, {
    x: ANCHO - MARGEN - wv,
    y: ALTO - 45,
    size: 12,
    bold: true,
    color: BLANCO,
  });

  ctx.y = ALTO - 90 - 30;
  texto(ctx, "Acta de configuración del módulo", {
    x: MARGEN,
    y: ctx.y,
    size: 16,
    bold: true,
    color: AZUL_OSCURO,
  });
  ctx.y -= 22;
  texto(ctx, d.moduloNombre, {
    x: MARGEN,
    y: ctx.y,
    size: 13,
    color: GRIS_TEXTO,
  });
  ctx.y -= 22;

  const alto = 92;
  ctx.page.drawRectangle({
    x: MARGEN,
    y: ctx.y - alto,
    width: ANCHO - MARGEN * 2,
    height: alto,
    color: FONDO_BAND,
    borderColor: GRIS_BORDE,
    borderWidth: 0.5,
  });
  const pad = 12;
  const col1 = MARGEN + pad;
  const col2 = MARGEN + (ANCHO - MARGEN * 2) / 2 + pad;
  const filas: Array<[string, string, string, string]> = [
    ["Proyecto", d.proyecto, "Empresa", d.empresa ?? "—"],
    ["Diligenciado por", d.autorNombre, "Correo", d.autorEmail],
    [
      "Fecha y hora (Hora Colombia)",
      `${formatoFechaHoraCO(d.fecha)} (America/Bogota)`,
      "Versión del acta",
      `v${d.version}`,
    ],
  ];
  let y = ctx.y - pad - 10;
  for (const [l1, v1, l2, v2] of filas) {
    texto(ctx, l1.toUpperCase(), { x: col1, y, size: 7, bold: true, color: GRIS_SUAVE });
    texto(ctx, v1, { x: col1, y: y - 10, size: 10, color: GRIS_TEXTO });
    texto(ctx, l2.toUpperCase(), { x: col2, y, size: 7, bold: true, color: GRIS_SUAVE });
    texto(ctx, v2, { x: col2, y: y - 10, size: 10, color: GRIS_TEXTO });
    y -= 24;
  }
  ctx.y -= alto + 16;
}

async function imagenEmbebida(
  ctx: Ctx,
  img: ImagenActa,
): Promise<PDFImage | null> {
  const mime = (img.mime || "").toLowerCase();
  const nombre = (img.nombre || "").toLowerCase();
  const pareceP = mime.includes("png") || nombre.endsWith(".png");
  try {
    if (pareceP) return await ctx.doc.embedPng(img.bytes);
    return await ctx.doc.embedJpg(img.bytes);
  } catch {
    try {
      return pareceP
        ? await ctx.doc.embedJpg(img.bytes)
        : await ctx.doc.embedPng(img.bytes);
    } catch {
      return null;
    }
  }
}

async function dibujarFila(ctx: Ctx, fila: FilaActa) {
  const anchoLabel = 180;
  const anchoValor = ANCHO - MARGEN * 2 - anchoLabel - 10;
  const lineasLabel = partirEnLineas(fila.label, ctx.helvBold, 9, anchoLabel);
  const lineasValor = partirEnLineas(fila.valor, ctx.helv, 9, anchoValor);
  const nLineas = Math.max(lineasLabel.length, lineasValor.length);
  const altoTexto = nLineas * 12 + 6;
  asegurar(ctx, altoTexto);

  lineasLabel.forEach((ln, i) => {
    texto(ctx, ln, {
      x: MARGEN,
      y: ctx.y - i * 12,
      size: 9,
      bold: true,
      color: GRIS_TEXTO,
    });
  });
  lineasValor.forEach((ln, i) => {
    texto(ctx, ln, {
      x: MARGEN + anchoLabel + 10,
      y: ctx.y - i * 12,
      size: 9,
      color: GRIS_TEXTO,
    });
  });
  ctx.y -= altoTexto;

  if (fila.imagen) {
    const img = await imagenEmbebida(ctx, fila.imagen);
    if (img) {
      const maxW = 220;
      const maxH = 130;
      const factor = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * factor;
      const h = img.height * factor;
      const marcoW = w + 8;
      const marcoH = h + 8;
      const captionH = 14;
      asegurar(ctx, marcoH + captionH + 4);
      const xMarco = MARGEN + anchoLabel + 10;
      const yMarco = ctx.y - marcoH;
      ctx.page.drawRectangle({
        x: xMarco,
        y: yMarco,
        width: marcoW,
        height: marcoH,
        color: BLANCO,
        borderColor: GRIS_BORDE,
        borderWidth: 0.75,
      });
      ctx.page.drawImage(img, {
        x: xMarco + 4,
        y: yMarco + 4,
        width: w,
        height: h,
      });
      ctx.y = yMarco - 2;
      const caption = `Imagen adjunta: ${fila.imagen.nombre ?? ""}`.trim();
      texto(ctx, caption, {
        x: xMarco,
        y: ctx.y - 8,
        size: 7.5,
        color: GRIS_SUAVE,
      });
      ctx.y -= captionH;
    }
  }

  ctx.page.drawLine({
    start: { x: MARGEN, y: ctx.y + 2 },
    end: { x: ANCHO - MARGEN, y: ctx.y + 2 },
    thickness: 0.3,
    color: GRIS_BORDE,
  });
  ctx.y -= 4;
}

async function dibujarSeccion(ctx: Ctx, seccion: SeccionActa) {
  asegurar(ctx, 40);
  texto(ctx, seccion.titulo.toUpperCase(), {
    x: MARGEN,
    y: ctx.y,
    size: 10,
    bold: true,
    color: AZUL_EGIXIA,
  });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGEN, y: ctx.y },
    end: { x: ANCHO - MARGEN, y: ctx.y },
    thickness: 0.6,
    color: AZUL_EGIXIA,
  });
  ctx.y -= 14;

  for (const fila of seccion.filas) {
    await dibujarFila(ctx, fila);
  }
  ctx.y -= 12;
}

function declaracion(ctx: Ctx) {
  const d = ctx.datos;
  const cuerpo =
    "El cliente confirma que la información registrada en este documento es la que EGIXIA implementará en el Portal de Proveedores. Cualquier ajuste posterior deberá gestionarse a través del proceso de observaciones y una nueva versión del acta.";
  const anchoBloque = ANCHO - MARGEN * 2;
  const lineas = partirEnLineas(cuerpo, ctx.helv, 10, anchoBloque - 24);
  const altoBloque = lineas.length * 14 + 60;
  asegurar(ctx, altoBloque);

  ctx.page.drawRectangle({
    x: MARGEN,
    y: ctx.y - altoBloque,
    width: anchoBloque,
    height: altoBloque,
    color: FONDO_BAND,
    borderColor: AZUL_EGIXIA,
    borderWidth: 0.6,
  });
  texto(ctx, "DECLARACIÓN DE CONFORMIDAD", {
    x: MARGEN + 12,
    y: ctx.y - 18,
    size: 9,
    bold: true,
    color: AZUL_EGIXIA,
  });
  let y = ctx.y - 34;
  for (const ln of lineas) {
    texto(ctx, ln, { x: MARGEN + 12, y, size: 10, color: GRIS_TEXTO });
    y -= 14;
  }
  texto(ctx, `${d.autorNombre} · ${d.autorEmail}`, {
    x: MARGEN + 12,
    y: y - 6,
    size: 9,
    bold: true,
    color: AZUL_OSCURO,
  });
  ctx.y -= altoBloque + 8;
}

// -------- Anexos ----------------------------------------------------------

function portadaAnexo(ctx: Ctx, n: number, anexo: AnexoActa) {
  const page = ctx.doc.addPage([ANCHO, ALTO]);
  const drawT = (t: string, opts: TextoOpts) => {
    page.drawText(limpiarTexto(t), {
      x: opts.x,
      y: opts.y,
      size: opts.size,
      font: opts.bold ? ctx.helvBold : ctx.helv,
      color: opts.color ?? GRIS_TEXTO,
    });
  };
  drawT(`ANEXO ${n}`, {
    x: MARGEN,
    y: ALTO - 120,
    size: 26,
    bold: true,
    color: AZUL_EGIXIA,
  });
  page.drawLine({
    start: { x: MARGEN, y: ALTO - 130 },
    end: { x: ANCHO - MARGEN, y: ALTO - 130 },
    thickness: 0.8,
    color: AZUL_EGIXIA,
  });

  const lineasNombre = partirEnLineas(
    anexo.nombre,
    ctx.helvBold,
    13,
    ANCHO - MARGEN * 2,
  );
  let y = ALTO - 160;
  for (const ln of lineasNombre) {
    drawT(ln, { x: MARGEN, y, size: 13, bold: true, color: AZUL_OSCURO });
    y -= 16;
  }

  const nota = anexo.motivoOmision
    ? `Este documento no pudo incluirse en el acta: ${anexo.motivoOmision}. Está disponible en el expediente digital del proyecto.`
    : "Documento adjuntado por el cliente en el formulario. Se incluye íntegro a continuación.";
  const lineasNota = partirEnLineas(nota, ctx.helv, 10, ANCHO - MARGEN * 2);
  y -= 12;
  for (const ln of lineasNota) {
    drawT(ln, { x: MARGEN, y, size: 10, color: GRIS_SUAVE });
    y -= 14;
  }
}

async function agregarAnexos(ctx: Ctx) {
  const anexos = ctx.datos.anexos ?? [];
  let n = 1;
  for (const anexo of anexos) {
    if (!anexo.bytes) {
      portadaAnexo(ctx, n, anexo);
      n += 1;
      continue;
    }
    try {
      const src = await PDFDocument.load(anexo.bytes, {
        ignoreEncryption: true,
      });
      portadaAnexo(ctx, n, { nombre: anexo.nombre });
      const paginas = await ctx.doc.copyPages(src, src.getPageIndices());
      for (const p of paginas) ctx.doc.addPage(p);
    } catch {
      portadaAnexo(ctx, n, {
        nombre: anexo.nombre,
        motivoOmision:
          "el archivo no es un PDF válido o está protegido",
      });
    }
    n += 1;
  }
}

// -------- Pies de página -------------------------------------------------

function piesDePagina(ctx: Ctx) {
  const paginas = ctx.doc.getPages();
  const total = paginas.length;
  const setActa = new Set(ctx.paginasActa);
  const fecha = fechaISOBogota(ctx.datos.fecha);
  paginas.forEach((page, i) => {
    if (setActa.has(i)) {
      page.drawText(
        limpiarTexto(
          `EGIXIA · Acta generada el ${fecha} (Hora Colombia) · Página ${i + 1} de ${total}`,
        ),
        {
          x: MARGEN,
          y: 24,
          size: 8,
          font: ctx.helv,
          color: GRIS_SUAVE,
        },
      );
    } else {
      page.drawText(
        limpiarTexto(`Página ${i + 1} de ${total} · Anexo del acta EGIXIA`),
        {
          x: 24,
          y: 12,
          size: 7,
          font: ctx.helv,
          color: GRIS_SUAVE,
        },
      );
    }
  });
}

// -------- API pública ----------------------------------------------------

export async function generarActaPDF(datos: DatosActa): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `Acta de configuración — ${datos.moduloNombre} (v${datos.version})`,
  );
  doc.setAuthor("EGIXIA");
  doc.setSubject(`Proyecto ${datos.proyecto}`);
  doc.setCreator("EGIXIA Configurator");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([ANCHO, ALTO]);
  const ctx: Ctx = {
    doc,
    page,
    y: ALTO - MARGEN,
    helv,
    helvBold,
    datos,
    paginasActa: [0],
  };

  portada(ctx);
  for (const seccion of datos.secciones) {
    await dibujarSeccion(ctx, seccion);
  }
  if (datos.secciones.length === 0) {
    texto(ctx, "Este módulo no tiene datos diligenciados aún.", {
      x: MARGEN,
      y: ctx.y,
      size: 10,
      color: GRIS_SUAVE,
    });
    ctx.y -= 20;
  }
  declaracion(ctx);

  await agregarAnexos(ctx);
  piesDePagina(ctx);

  return doc.save();
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

export type { SeccionDefinicion };
