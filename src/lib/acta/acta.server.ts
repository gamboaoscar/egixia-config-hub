import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import {
  extraerFilasActa,
  generarActaPDF,
  type DatosActa,
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

  const definicion = definicionModulo(modulo.modulo_key);
  const secciones = extraerFilasActa(
    definicion,
    (modulo.datos as Record<string, unknown>) ?? {},
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
