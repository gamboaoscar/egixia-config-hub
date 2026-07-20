import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import { campoActivo, campoVisible } from "@/lib/form-engine/validacion";
import {
  aplicarOverrides,
  type CampoOverride,
  type SeccionOverride,
} from "@/lib/form-engine/overrides";
import type { ModuloDefinicion } from "@/lib/form-engine/tipos";
import {
  extraerFilasActa,
  generarActaPDF,
  type AnexoActa,
  type DatosActa,
  type SeccionActa,
} from "./acta-pdf";

/**
 * Helpers server-side de la Parte 13 (Acta):
 *   - `construirDatosActa`: junta información del proyecto, módulo y
 *     autor para armar el DTO que consume `generarActaPDF`.
 *   - `renderYSubirActa`: genera el PDF, lo persiste en el bucket
 *     privado `actas` y registra la nueva versión en la tabla `actas`.
 *   - `urlFirmadaActa`: emite un enlace de descarga temporal para
 *     enviar por correo o mostrar en el portal.
 *
 * El bucket `actas` es privado (Sección C: nunca URLs públicas), por lo
 * que siempre servimos el PDF mediante URL firmada de corta duración.
 */

const BUCKET_ACTAS = "actas";
const URL_FIRMADA_SEGUNDOS = 60 * 60 * 24 * 7; // 7 días

const MAX_ANEXO_MB = 15;
const MAX_TOTAL_MB = 30;
const MB = 1024 * 1024;

interface ValorArchivo {
  bucket?: string;
  storagePath?: string;
  nombre?: string;
  tipo?: string;
  tamano?: number;
}

function esValorArchivo(v: unknown): v is ValorArchivo {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.storagePath === "string" && typeof o.bucket === "string";
}

function esImagenEmbebible(v: ValorArchivo): boolean {
  const tipo = (v.tipo ?? "").toLowerCase();
  const nombre = (v.nombre ?? "").toLowerCase();
  return (
    tipo.includes("png") ||
    tipo.includes("jpeg") ||
    tipo.includes("jpg") ||
    nombre.endsWith(".png") ||
    nombre.endsWith(".jpg") ||
    nombre.endsWith(".jpeg")
  );
}

function esPdf(v: ValorArchivo): boolean {
  const tipo = (v.tipo ?? "").toLowerCase();
  const nombre = (v.nombre ?? "").toLowerCase();
  return tipo.includes("pdf") || nombre.endsWith(".pdf");
}

async function descargarDeStorage(
  bucket: string,
  path: string,
): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function adjuntarArchivosActa(
  definicion: ModuloDefinicion,
  datos: Record<string, unknown>,
  secciones: SeccionActa[],
): Promise<AnexoActa[]> {
  const anexos: AnexoActa[] = [];
  let totalBytes = 0;

  const asignarImagen = (
    tituloSeccion: string,
    label: string,
    imagen: { bytes: Uint8Array; mime: string; nombre?: string },
  ) => {
    const sec = secciones.find((s) => s.titulo === tituloSeccion);
    if (!sec) return;
    const fila = sec.filas.find((f) => f.label === label && !f.imagen);
    if (fila) fila.imagen = imagen;
  };

  const procesarArchivo = async (
    tituloSeccion: string,
    label: string,
    v: ValorArchivo,
  ) => {
    const nombre = v.nombre ?? "archivo";
    if (esPdf(v)) {
      if ((v.tamano ?? 0) > MAX_ANEXO_MB * MB) {
        anexos.push({
          nombre,
          motivoOmision: `supera el tamaño máximo de anexos (${MAX_ANEXO_MB} MB)`,
        });
        return;
      }
      const bytes = await descargarDeStorage(v.bucket!, v.storagePath!);
      if (!bytes) {
        anexos.push({
          nombre,
          motivoOmision: "no se pudo descargar del almacenamiento",
        });
        return;
      }
      if (totalBytes + bytes.byteLength > MAX_TOTAL_MB * MB) {
        anexos.push({
          nombre,
          motivoOmision: "se alcanzó el tamaño máximo total del acta",
        });
        return;
      }
      totalBytes += bytes.byteLength;
      anexos.push({ nombre, bytes });
      return;
    }
    if (esImagenEmbebible(v)) {
      if ((v.tamano ?? 0) > MAX_ANEXO_MB * MB) return;
      const bytes = await descargarDeStorage(v.bucket!, v.storagePath!);
      if (!bytes) return;
      if (totalBytes + bytes.byteLength > MAX_TOTAL_MB * MB) return;
      totalBytes += bytes.byteLength;
      asignarImagen(tituloSeccion, label, {
        bytes,
        mime: v.tipo ?? "",
        nombre: v.nombre,
      });
      return;
    }
    // SVG/WEBP/ICO u otros: no se incrustan; quedan listados por nombre en el resumen.
  };

  for (const seccion of definicion.secciones) {
    for (const campo of seccion.campos) {
      if (campo.tipo === "info") continue;
      if (!campoActivo(campo)) continue;
      if (!campoVisible(campo, datos)) continue;

      const valor = datos[campo.key];

      if (campo.tipo === "archivo" && esValorArchivo(valor)) {
        await procesarArchivo(seccion.titulo, campo.label, valor);
      } else if (campo.tipo === "tabla" && campo.columnas) {
        const filas = (valor as Array<Record<string, unknown>>) ?? [];
        for (let i = 0; i < filas.length; i++) {
          const fila = filas[i];
          for (const col of campo.columnas) {
            if (col.tipo !== "archivo") continue;
            const cel = fila[col.key];
            if (esValorArchivo(cel)) {
              await procesarArchivo(
                seccion.titulo,
                `   · Fila ${i + 1}`,
                cel,
              );
            }
          }
        }
      }
    }
  }

  return anexos;
}

async function cargarOverrides(proyectoId: string, moduloKey: string) {
  const [{ data: ovCampos }, { data: ovSecciones }] = await Promise.all([
    supabaseAdmin
      .from("catalogo_overrides")
      .select("modulo_key, campo_key, activo, label, requerido, guia, opciones_permitidas")
      .eq("proyecto_id", proyectoId)
      .eq("modulo_key", moduloKey),
    supabaseAdmin
      .from("catalogo_overrides_seccion")
      .select("modulo_key, seccion_key, habilitada, obligatoria")
      .eq("proyecto_id", proyectoId)
      .eq("modulo_key", moduloKey),
  ]);
  return {
    campos: (ovCampos ?? []) as unknown as CampoOverride[],
    secciones: (ovSecciones ?? []) as unknown as SeccionOverride[],
  };
}

/**
 * Definición EFECTIVA del módulo para un proyecto: definición base del
 * catálogo + overrides de campos (`catalogo_overrides`) y de secciones
 * (`catalogo_overrides_seccion`). Es la misma definición que ve el
 * cliente en el formulario y la que usa el acta; toda revalidación
 * server-side debe partir de aquí para no exigir campos ocultos o
 * marcados como no requeridos en este proyecto.
 */
export async function cargarDefinicionEfectiva(
  proyectoId: string,
  moduloKey: string,
): Promise<ModuloDefinicion> {
  const overrides = await cargarOverrides(proyectoId, moduloKey);
  return aplicarOverrides(
    definicionModulo(moduloKey),
    overrides.campos,
    overrides.secciones,
  );
}

export async function construirDatosActa(
  moduloId: string,
  actorId: string,
  version: number,
): Promise<DatosActa> {
  const { data: modulo, error: modErr } = await supabaseAdmin
    .from("proyecto_modulos")
    .select("id, proyecto_id, modulo_key, datos")
    .eq("id", moduloId)
    .maybeSingle();
  if (modErr || !modulo) throw new Error("No se pudo cargar el módulo para el acta.");

  const { data: proyecto } = await supabaseAdmin
    .from("proyectos")
    .select("nombre, empresa")
    .eq("id", modulo.proyecto_id)
    .maybeSingle();

  const { data: autor } = await supabaseAdmin
    .from("profiles")
    .select("nombre, apellido, email")
    .eq("id", actorId)
    .maybeSingle();

  const definicion = await cargarDefinicionEfectiva(
    modulo.proyecto_id as string,
    modulo.modulo_key as string,
  );
  const secciones = extraerFilasActa(
    definicion,
    (modulo.datos as Record<string, unknown>) ?? {},
  );

  const anexos = await adjuntarArchivosActa(
    definicion,
    (modulo.datos as Record<string, unknown>) ?? {},
    secciones,
  );

  return {
    proyecto: proyecto?.nombre ?? "Proyecto",
    empresa: proyecto?.empresa ?? null,
    moduloNombre: definicion.nombre,
    autorNombre: [autor?.nombre, autor?.apellido].filter(Boolean).join(" ") ||
      autor?.email ||
      "Usuario",
    autorEmail: autor?.email ?? "",
    fecha: new Date(),
    version,
    secciones,
    anexos,
  };
}

function storagePathActa(proyectoId: string, moduloId: string, version: number) {
  return `${proyectoId}/${moduloId}/acta-v${version}.pdf`;
}

/**
 * Genera el PDF del acta, lo sube al bucket privado y registra la fila
 * en `actas`. Devuelve la nueva versión y la ruta en Storage.
 */
export async function renderYSubirActa(
  moduloId: string,
  actorId: string,
): Promise<{ version: number; storagePath: string; archivoUrl: string }> {
  const { data: modulo } = await supabaseAdmin
    .from("proyecto_modulos")
    .select("proyecto_id")
    .eq("id", moduloId)
    .maybeSingle();
  if (!modulo) throw new Error("Módulo no encontrado para generar acta.");

  const { data: previa } = await supabaseAdmin
    .from("actas")
    .select("version")
    .eq("proyecto_modulo_id", moduloId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((previa?.version as number | undefined) ?? 0) + 1;

  const datos = await construirDatosActa(moduloId, actorId, version);
  const bytes = await generarActaPDF(datos);

  const path = storagePathActa(modulo.proyecto_id, moduloId, version);
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET_ACTAS)
    .upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(`No se pudo guardar el acta: ${upErr.message}`);

  const archivoUrl = `${BUCKET_ACTAS}/${path}`;
  const { error: insErr } = await supabaseAdmin.from("actas").insert({
    proyecto_modulo_id: moduloId,
    version,
    archivo_url: archivoUrl,
    generada_por: actorId,
  });
  if (insErr) throw new Error(`No se pudo registrar el acta: ${insErr.message}`);

  return { version, storagePath: path, archivoUrl };
}

/**
 * Devuelve una URL firmada de descarga para el acta almacenada en el
 * bucket privado. Recibe la ruta `bucket/path` almacenada en
 * `actas.archivo_url`.
 */
export async function urlFirmadaActa(archivoUrl: string): Promise<string | null> {
  if (!archivoUrl) return null;
  // Formato esperado: "actas/<proyecto>/<modulo>/acta-vN.pdf".
  const [bucket, ...resto] = archivoUrl.split("/");
  if (bucket !== BUCKET_ACTAS || resto.length === 0) return null;
  const path = resto.join("/");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_ACTAS)
    .createSignedUrl(path, URL_FIRMADA_SEGUNDOS);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Descarga los bytes crudos del acta desde el bucket privado. Se usa
 * para servir el PDF same-origin (evita URLs de Storage bloqueadas por
 * ad-blockers y sesiones cruzadas).
 */
export async function descargarBytesActa(
  archivoUrl: string,
): Promise<Uint8Array | null> {
  if (!archivoUrl) return null;
  const [bucket, ...resto] = archivoUrl.split("/");
  if (bucket !== BUCKET_ACTAS || resto.length === 0) return null;
  const path = resto.join("/");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_ACTAS)
    .download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Ruta última acta persistida para un módulo (o null). */
export async function ultimaActa(
  moduloId: string,
): Promise<{ version: number; archivoUrl: string } | null> {
  const { data } = await supabaseAdmin
    .from("actas")
    .select("version, archivo_url")
    .eq("proyecto_modulo_id", moduloId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { version: data.version as number, archivoUrl: data.archivo_url as string };
}
