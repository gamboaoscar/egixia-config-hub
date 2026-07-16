import { supabase } from "@/integrations/supabase/client";
import type { ConfigArchivo } from "./tipos";

/**
 * Metadatos que se guardan en `proyecto_modulos.datos[campoKey]` para
 * los campos de tipo `archivo`. El binario vive en Storage; aquí
 * dejamos la referencia y lo necesario para pintar la miniatura.
 */
export interface ValorArchivo {
  archivoId: string;
  bucket: string;
  storagePath: string;
  nombre: string;
  tipo: string;
  tamano: number;
  dimensiones?: string | null;
  /** true si el motor auto-ajustó la imagen a las dimensiones exactas. */
  ajustado?: boolean;
}

const MB = 1024 * 1024;

export function tamanoMaxBytes(config: ConfigArchivo): number {
  return (config.tamanoMaxMB ?? 5) * MB;
}

/** ¿El archivo cumple con la lista de formatos permitidos? */
export function formatoPermitido(
  file: File,
  config: ConfigArchivo,
): boolean {
  const mime = file.type.toLowerCase();
  const nombre = file.name.toLowerCase();
  return config.formatosPermitidos.some((f) => {
    const norm = f.toLowerCase().trim();
    if (norm.startsWith(".")) return nombre.endsWith(norm);
    if (norm.includes("/")) return mime === norm;
    return mime.endsWith(`/${norm}`) || nombre.endsWith(`.${norm}`);
  });
}

export function esSvg(file: File): boolean {
  return (
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")
  );
}
export function esPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
export function esImagenRaster(file: File): boolean {
  const t = file.type.toLowerCase();
  return (
    t === "image/png" ||
    t === "image/jpeg" ||
    t === "image/webp" ||
    t === "image/x-icon" ||
    t === "image/vnd.microsoft.icon"
  );
}

/** Lee un File a un HTMLImageElement (para obtener dimensiones / canvas). */
function cargarImagen(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      // el objectURL se libera cuando ya no se necesita el bitmap
      setTimeout(() => URL.revokeObjectURL(url), 0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

/**
 * Redimensiona (cover, recorte centrado) a las dimensiones exactas
 * pedidas. Devuelve un `Blob` PNG listo para subir. El offset permite
 * al usuario reposicionar el encuadre.
 */
export async function redimensionarCover(
  file: File,
  ancho: number,
  alto: number,
  offset: { x: number; y: number } = { x: 0.5, y: 0.5 },
): Promise<{ blob: Blob; ancho: number; alto: number }> {
  const img = await cargarImagen(file);
  const escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
  const anchoEsc = img.naturalWidth * escala;
  const altoEsc = img.naturalHeight * escala;
  const sobraX = anchoEsc - ancho;
  const sobraY = altoEsc - alto;
  const dx = -sobraX * offset.x;
  const dy = -sobraY * offset.y;

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el lienzo para redimensionar.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, anchoEsc, altoEsc);

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png", 0.95),
  );
  if (!blob) throw new Error("No se pudo generar la imagen ajustada.");
  return { blob, ancho, alto };
}

/** Lee dimensiones de un archivo de imagen sin subirlo. */
export async function dimensionesDe(file: File): Promise<{ ancho: number; alto: number } | null> {
  if (esSvg(file) || esPdf(file)) return null;
  if (!esImagenRaster(file)) return null;
  try {
    const img = await cargarImagen(file);
    return { ancho: img.naturalWidth, alto: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Sanitiza un nombre de archivo para usarlo como path de Storage. */
function slug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

interface SubirParams {
  proyectoId: string;
  moduloId: string;
  campoKey: string;
  bucket: string;
  data: Blob;
  nombreOriginal: string;
  contentType: string;
  dimensiones?: string | null;
  ajustado?: boolean;
  /** Ruta anterior (para limpiar cuando se reemplaza). */
  reemplazaPath?: string;
}

/**
 * Sube el binario al bucket privado (path
 * `{proyecto_id}/{modulo_id}/{campo_key}/...`) y registra los
 * metadatos en la tabla `archivos`. Si se pasa `reemplazaPath`
 * elimina el archivo anterior.
 */
export async function subirArchivo(p: SubirParams): Promise<ValorArchivo> {
  const nombreBase = slug(p.nombreOriginal) || "archivo";
  const storagePath = `${p.proyectoId}/${p.moduloId}/${p.campoKey}/${Date.now()}-${nombreBase}`;

  const { error: upErr } = await supabase.storage
    .from(p.bucket)
    .upload(storagePath, p.data, {
      contentType: p.contentType,
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: registro, error: dbErr } = await supabase
    .from("archivos")
    .insert({
      proyecto_modulo_id: p.moduloId,
      campo_key: p.campoKey,
      nombre_original: p.nombreOriginal,
      storage_path: `${p.bucket}/${storagePath}`,
      tipo: p.contentType,
      tamano:
        typeof (p.data as Blob).size === "number" ? (p.data as Blob).size : null,
      dimensiones: p.dimensiones ?? null,
    })
    .select("id")
    .single();

  if (dbErr) {
    // rollback del binario si falló el registro
    await supabase.storage.from(p.bucket).remove([storagePath]);
    throw new Error(dbErr.message);
  }

  // Best-effort: borrar el archivo anterior en Storage.
  if (p.reemplazaPath) {
    const [bucketAnt, ...restoAnt] = p.reemplazaPath.split("/");
    if (bucketAnt && restoAnt.length > 0) {
      await supabase.storage.from(bucketAnt).remove([restoAnt.join("/")]);
    }
  }

  return {
    archivoId: registro.id,
    bucket: p.bucket,
    storagePath,
    nombre: p.nombreOriginal,
    tipo: p.contentType,
    tamano: (p.data as Blob).size,
    dimensiones: p.dimensiones ?? null,
    ajustado: p.ajustado,
  };
}

/** Obtiene una URL firmada de corta duración para previsualizar. */
export async function firmarUrl(
  bucket: string,
  path: string,
  segundos = 3600,
  download?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, segundos, download ? { download } : undefined);
  if (error) return null;
  return data.signedUrl;
}

export function esValorArchivo(v: unknown): v is ValorArchivo {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as ValorArchivo).storagePath === "string" &&
    typeof (v as ValorArchivo).bucket === "string"
  );
}