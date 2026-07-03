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
 * El PDF se escribe con un generador mínimo propio para evitar dependencias
 * de empaquetado que fallan en producción al descargar el acta.
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

// -------- Render PDF sin dependencias externas -----------------------------

type Color = [number, number, number];
type FontKey = "regular" | "bold";

const AZUL_EGIXIA: Color = [15 / 255, 43 / 255, 142 / 255]; // #0F2B8E
const AZUL_OSCURO: Color = [11 / 255, 30 / 255, 98 / 255]; // #0B1E62
const GRIS_TEXTO: Color = [31 / 255, 41 / 255, 55 / 255];
const GRIS_SUAVE: Color = [107 / 255, 114 / 255, 128 / 255];
const GRIS_BORDE: Color = [224 / 255, 227 / 255, 235 / 255];
const FONDO_BAND: Color = [240 / 255, 244 / 255, 248 / 255];
const BLANCO: Color = [1, 1, 1];
const AZUL_CLARO: Color = [0.9, 0.93, 1];

interface PaginaPDF {
  contenido: string[];
}

interface Ctx {
  paginas: PaginaPDF[];
  pagina: PaginaPDF;
  /** Cursor vertical (desde arriba). */
  y: number;
  /** Márgenes. */
  margin: number;
  ancho: number;
  alto: number;
}

function numero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function colorFill([r, g, b]: Color): string {
  return `${numero(r)} ${numero(g)} ${numero(b)} rg`;
}

function colorStroke([r, g, b]: Color): string {
  return `${numero(r)} ${numero(g)} ${numero(b)} RG`;
}

function limpiarTextoPDF(texto: string): string {
  return texto
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "·")
    .replace(/[\r\n\t]+/g, " ");
}

function textoLiteralPDF(texto: string): string {
  let out = "";
  for (const char of limpiarTextoPDF(texto)) {
    let code = char.charCodeAt(0);
    if (code > 255) code = 63;
    if (code === 40 || code === 41 || code === 92) {
      out += `\\${String.fromCharCode(code)}`;
    } else if (code < 32 || code > 126) {
      out += `\\${code.toString(8).padStart(3, "0")}`;
    } else {
      out += String.fromCharCode(code);
    }
  }
  return `(${out})`;
}

function anchoTexto(texto: string, font: FontKey, size: number): number {
  let unidades = 0;
  for (const char of limpiarTextoPDF(texto)) {
    if (char === " ") unidades += 0.28;
    else if (".,;:!|'".includes(char)) unidades += 0.24;
    else if ("ilI[]()".includes(char)) unidades += 0.3;
    else if ("mwMW@#".includes(char)) unidades += 0.82;
    else if (/[A-ZÁÉÍÓÚÑ]/.test(char)) unidades += 0.62;
    else unidades += 0.52;
  }
  return unidades * size * (font === "bold" ? 1.03 : 1);
}

function cortarPalabra(palabra: string, font: FontKey, size: number, maxAncho: number): string[] {
  const partes: string[] = [];
  let actual = "";
  for (const char of palabra) {
    const tentativa = `${actual}${char}`;
    if (actual && anchoTexto(tentativa, font, size) > maxAncho) {
      partes.push(actual);
      actual = char;
    } else {
      actual = tentativa;
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

function partirEnLineas(texto: string, font: FontKey, size: number, maxAncho: number): string[] {
  const palabras = texto.replace(/\s+/g, " ").trim().split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const tentativa = actual ? `${actual} ${p}` : p;
    const w = anchoTexto(tentativa, font, size);
    if (w > maxAncho && actual) {
      lineas.push(actual);
      if (anchoTexto(p, font, size) > maxAncho) {
        const partes = cortarPalabra(p, font, size, maxAncho);
        lineas.push(...partes.slice(0, -1));
        actual = partes.at(-1) ?? "";
      } else {
        actual = p;
      }
    } else if (w > maxAncho) {
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

function drawText(
  ctx: Ctx,
  texto: string,
  opts: { x: number; y: number; size: number; font: FontKey; color: Color },
) {
  ctx.pagina.contenido.push(
    "BT",
    `/${opts.font === "bold" ? "F2" : "F1"} ${numero(opts.size)} Tf`,
    colorFill(opts.color),
    `1 0 0 1 ${numero(opts.x)} ${numero(opts.y)} Tm`,
    `${textoLiteralPDF(texto)} Tj`,
    "ET",
  );
}

function drawRect(
  ctx: Ctx,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: Color;
    borderColor?: Color;
    borderWidth?: number;
  },
) {
  ctx.pagina.contenido.push(colorFill(opts.color));
  if (opts.borderColor && opts.borderWidth) {
    ctx.pagina.contenido.push(
      colorStroke(opts.borderColor),
      `${numero(opts.borderWidth)} w`,
      `${numero(opts.x)} ${numero(opts.y)} ${numero(opts.width)} ${numero(opts.height)} re`,
      "B",
    );
  } else {
    ctx.pagina.contenido.push(
      `${numero(opts.x)} ${numero(opts.y)} ${numero(opts.width)} ${numero(opts.height)} re`,
      "f",
    );
  }
}

function drawLine(
  ctx: Ctx,
  opts: { x1: number; y1: number; x2: number; y2: number; thickness: number; color: Color },
) {
  ctx.pagina.contenido.push(
    colorStroke(opts.color),
    `${numero(opts.thickness)} w`,
    `${numero(opts.x1)} ${numero(opts.y1)} m`,
    `${numero(opts.x2)} ${numero(opts.y2)} l`,
    "S",
  );
}

function nuevaPagina(ctx: Ctx) {
  ctx.pagina = { contenido: [] };
  ctx.paginas.push(ctx.pagina);
  ctx.y = ctx.alto - ctx.margin;
}

function asegurarEspacio(ctx: Ctx, alto: number) {
  if (ctx.y - alto < ctx.margin + 40) {
    nuevaPagina(ctx);
  }
}

function pieDePagina(ctx: Ctx) {
  const total = ctx.paginas.length;
  ctx.paginas.forEach((pagina, i) => {
    const paginaActual = ctx.pagina;
    ctx.pagina = pagina;
    const texto = `EGIXIA · Acta generada el ${new Date().toISOString().slice(0, 10)} · Página ${i + 1} de ${total}`;
    drawText(ctx, texto, {
      x: ctx.margin,
      y: 24,
      size: 8,
      font: "regular",
      color: GRIS_SUAVE,
    });
    ctx.pagina = paginaActual;
  });
}

function drawEncabezado(ctx: Ctx, datos: DatosActa) {
  // Banda azul superior
  drawRect(ctx, {
    x: 0,
    y: ctx.alto - 90,
    width: ctx.ancho,
    height: 90,
    color: AZUL_EGIXIA,
  });
  drawText(ctx, "EGIXIA", {
    x: ctx.margin,
    y: ctx.alto - 45,
    size: 22,
    font: "bold",
    color: BLANCO,
  });
  drawText(ctx, "Portal de Configuración de tu Implementación", {
    x: ctx.margin,
    y: ctx.alto - 65,
    size: 10,
    font: "regular",
    color: AZUL_CLARO,
  });
  drawText(ctx, `Acta v${datos.version}`, {
    x: ctx.ancho - ctx.margin - 70,
    y: ctx.alto - 45,
    size: 12,
    font: "bold",
    color: BLANCO,
  });

  ctx.y = ctx.alto - 90 - 30;

  // Título del acta
  drawText(ctx, "Acta de configuración del módulo", {
    x: ctx.margin,
    y: ctx.y,
    size: 16,
    font: "bold",
    color: AZUL_OSCURO,
  });
  ctx.y -= 22;
  drawText(ctx, datos.moduloNombre, {
    x: ctx.margin,
    y: ctx.y,
    size: 13,
    font: "regular",
    color: GRIS_TEXTO,
  });
  ctx.y -= 22;
}

function drawMetaBox(ctx: Ctx, datos: DatosActa) {
  const alto = 90;
  drawRect(ctx, {
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
    drawText(ctx, l1.toUpperCase(), { x: col1, y, size: 7, font: "bold", color: GRIS_SUAVE });
    drawText(ctx, v1, { x: col1, y: y - 10, size: 10, font: "regular", color: GRIS_TEXTO });
    drawText(ctx, l2.toUpperCase(), { x: col2, y, size: 7, font: "bold", color: GRIS_SUAVE });
    drawText(ctx, v2, { x: col2, y: y - 10, size: 10, font: "regular", color: GRIS_TEXTO });
    y -= 24;
  }
  ctx.y -= alto + 16;
}

function drawSeccion(ctx: Ctx, seccion: SeccionActa) {
  asegurarEspacio(ctx, 40);
  // Título de sección
  drawText(ctx, seccion.titulo.toUpperCase(), {
    x: ctx.margin,
    y: ctx.y,
    size: 10,
    font: "bold",
    color: AZUL_EGIXIA,
  });
  ctx.y -= 6;
  drawLine(ctx, {
    x1: ctx.margin,
    y1: ctx.y,
    x2: ctx.ancho - ctx.margin,
    y2: ctx.y,
    thickness: 0.6,
    color: AZUL_EGIXIA,
  });
  ctx.y -= 14;

  const anchoLabel = 180;
  const anchoValor = ctx.ancho - ctx.margin * 2 - anchoLabel - 10;

  for (const fila of seccion.filas) {
    const lineasLabel = partirEnLineas(fila.label, "regular", 9, anchoLabel);
    const lineasValor = partirEnLineas(fila.valor, "regular", 9, anchoValor);
    const nLineas = Math.max(lineasLabel.length, lineasValor.length);
    const alto = nLineas * 12 + 6;
    asegurarEspacio(ctx, alto);

    lineasLabel.forEach((ln, i) => {
      drawText(ctx, ln, {
        x: ctx.margin,
        y: ctx.y - i * 12,
        size: 9,
        font: "bold",
        color: GRIS_TEXTO,
      });
    });
    lineasValor.forEach((ln, i) => {
      drawText(ctx, ln, {
        x: ctx.margin + anchoLabel + 10,
        y: ctx.y - i * 12,
        size: 9,
        font: "regular",
        color: GRIS_TEXTO,
      });
    });
    ctx.y -= alto;
    // Separador tenue
    drawLine(ctx, {
      x1: ctx.margin,
      y1: ctx.y + 2,
      x2: ctx.ancho - ctx.margin,
      y2: ctx.y + 2,
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
  const lineas = partirEnLineas(texto, "regular", 10, ctx.ancho - ctx.margin * 2 - 24);
  const altoBloque = lineas.length * 14 + 60;
  asegurarEspacio(ctx, altoBloque);

  drawRect(ctx, {
    x: ctx.margin,
    y: ctx.y - altoBloque,
    width: ctx.ancho - ctx.margin * 2,
    height: altoBloque,
    color: FONDO_BAND,
    borderColor: AZUL_EGIXIA,
    borderWidth: 0.6,
  });
  drawText(ctx, "DECLARACIÓN DE CONFORMIDAD", {
    x: ctx.margin + 12,
    y: ctx.y - 18,
    size: 9,
    font: "bold",
    color: AZUL_EGIXIA,
  });
  let y = ctx.y - 34;
  for (const ln of lineas) {
    drawText(ctx, ln, {
      x: ctx.margin + 12,
      y,
      size: 10,
      font: "regular",
      color: GRIS_TEXTO,
    });
    y -= 14;
  }
  drawText(
    ctx,
    `${datos.autorNombre} · ${datos.autorEmail}`,
    { x: ctx.margin + 12, y: y - 6, size: 9, font: "bold", color: AZUL_OSCURO },
  );
  ctx.y -= altoBloque + 8;
}

function crearPDF(paginas: PaginaPDF[]): Uint8Array {
  const objetos: string[] = [];
  const agregarObjeto = (contenido: string) => {
    objetos.push(contenido);
    return objetos.length;
  };

  const catalogId = agregarObjeto("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = agregarObjeto("");
  const regularFontId = agregarObjeto(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const boldFontId = agregarObjeto(
    // Usamos la misma fuente base para evitar diferencias de sustitución de
    // Helvetica-Bold entre visores PDF en producción.
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  const pageIds: number[] = [];
  for (const pagina of paginas) {
    const stream = `${pagina.contenido.join("\n")}\n`;
    const contentId = agregarObjeto(
      `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,
    );
    const pageId = agregarObjeto(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  objetos[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objetos.length; i++) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`;
  }
  const startxref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objetos.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

/** Genera los bytes del PDF del acta a partir de los datos ya extraídos. */
export async function generarActaPDF(datos: DatosActa): Promise<Uint8Array> {
  const pagina: PaginaPDF = { contenido: [] };
  const ctx: Ctx = {
    paginas: [pagina],
    pagina,
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
    drawText(ctx, "Este módulo no tiene datos diligenciados aún.", {
      x: ctx.margin,
      y: ctx.y,
      size: 10,
      font: "regular",
      color: GRIS_SUAVE,
    });
    ctx.y -= 20;
  }
  drawDeclaracion(ctx, datos);
  pieDePagina(ctx);

  return crearPDF(ctx.paginas);
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
