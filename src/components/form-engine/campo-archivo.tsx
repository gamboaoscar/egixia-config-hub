import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConfigArchivo } from "@/lib/form-engine/tipos";
import {
  dimensionesDe,
  esImagenRaster,
  esPdf,
  esSvg,
  esValorArchivo,
  firmarUrl,
  formatoPermitido,
  redimensionarCover,
  subirArchivo,
  tamanoMaxBytes,
  type ValorArchivo,
} from "@/lib/form-engine/archivo";

interface Props {
  campoKey: string;
  config: ConfigArchivo;
  valor: unknown;
  disabled?: boolean;
  proyectoId: string;
  moduloId: string;
  onChange: (v: ValorArchivo | null) => void;
}

interface AjusteState {
  file: File;
  previewUrl: string;
  offset: { x: number; y: number };
}

function humanTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CampoArchivo({
  campoKey,
  config,
  valor,
  disabled,
  proyectoId,
  moduloId,
  onChange,
}: Props) {
  const valorActual = esValorArchivo(valor) ? valor : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<AjusteState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const aceptar = useMemo(
    () => config.formatosPermitidos.join(","),
    [config.formatosPermitidos],
  );

  // URL firmada para la miniatura del archivo ya guardado.
  useEffect(() => {
    let cancelado = false;
    if (!valorActual) {
      setPreviewUrl(null);
      return;
    }
    firmarUrl(valorActual.bucket, valorActual.storagePath).then((u) => {
      if (!cancelado) setPreviewUrl(u);
    });
    return () => {
      cancelado = true;
    };
  }, [valorActual]);

  const seleccionar = () => inputRef.current?.click();

  const verArchivo = async () => {
    if (!valorActual) return;
    setAbriendo(true);
    try {
      const url = await firmarUrl(valorActual.bucket, valorActual.storagePath);
      if (!url) throw new Error("No se pudo obtener el enlace del archivo.");
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo abrir el archivo.",
      );
    } finally {
      setAbriendo(false);
    }
  };

  const descargarArchivo = async () => {
    if (!valorActual) return;
    setDescargando(true);
    try {
      const url = await firmarUrl(
        valorActual.bucket,
        valorActual.storagePath,
        3600,
        valorActual.nombre,
      );
      if (!url) throw new Error("No se pudo obtener el enlace de descarga.");
      window.location.href = url;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo descargar el archivo.",
      );
    } finally {
      setDescargando(false);
    }
  };

  const procesarArchivo = async (file: File) => {
    setError(null);

    if (!formatoPermitido(file, config)) {
      setError(
        `Formato no permitido. Acepta: ${config.formatosPermitidos.join(", ")}.`,
      );
      return;
    }
    if (file.size > tamanoMaxBytes(config)) {
      setError(
        `El archivo supera el tamaño máximo de ${config.tamanoMaxMB ?? 5} MB.`,
      );
      return;
    }

    // PDF: se sube tal cual.
    if (esPdf(file)) {
      await ejecutarSubida(file, file, null, false);
      return;
    }

    // SVG: se valida y se sube sin redimensionar.
    if (esSvg(file)) {
      try {
        const texto = await file.text();
        if (!/<svg[\s>]/i.test(texto)) {
          setError("El archivo no parece un SVG válido.");
          return;
        }
      } catch {
        setError("No se pudo leer el archivo SVG.");
        return;
      }
      await ejecutarSubida(file, file, null, false);
      return;
    }

    // Imagen raster con dimensiones exactas requeridas.
    if (esImagenRaster(file) && config.dimensiones) {
      const dims = await dimensionesDe(file);
      if (
        dims &&
        dims.ancho === config.dimensiones.ancho &&
        dims.alto === config.dimensiones.alto
      ) {
        // Ya coincide: subir directo.
        await ejecutarSubida(file, file, `${dims.ancho}x${dims.alto}`, false);
        return;
      }
      // Abrir panel de ajuste con preview.
      const url = URL.createObjectURL(file);
      setAjuste({ file, previewUrl: url, offset: { x: 0.5, y: 0.5 } });
      return;
    }

    // Imagen raster sin dimensiones exactas: subir tal cual.
    const dims = await dimensionesDe(file);
    await ejecutarSubida(
      file,
      file,
      dims ? `${dims.ancho}x${dims.alto}` : null,
      false,
    );
  };

  const ejecutarSubida = async (
    original: File,
    data: Blob,
    dimensiones: string | null,
    ajustado: boolean,
  ) => {
    setSubiendo(true);
    setError(null);
    try {
      const valorNuevo = await subirArchivo({
        proyectoId,
        moduloId,
        campoKey,
        bucket: config.bucket,
        data,
        nombreOriginal: original.name,
        contentType: original.type || data.type || "application/octet-stream",
        dimensiones,
        ajustado,
        reemplazaPath: valorActual?.storagePath
          ? `${valorActual.bucket}/${valorActual.storagePath}`
          : undefined,
      });
      onChange(valorNuevo);
      cerrarAjuste();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo subir el archivo.",
      );
    } finally {
      setSubiendo(false);
    }
  };

  const confirmarAjuste = async () => {
    if (!ajuste || !config.dimensiones) return;
    setSubiendo(true);
    try {
      const { blob } = await redimensionarCover(
        ajuste.file,
        config.dimensiones.ancho,
        config.dimensiones.alto,
        ajuste.offset,
      );
      const finalFile = new File(
        [blob],
        ajuste.file.name.replace(/\.[^.]+$/, "") + ".png",
        { type: "image/png" },
      );
      await ejecutarSubida(
        finalFile,
        blob,
        `${config.dimensiones.ancho}x${config.dimensiones.alto}`,
        true,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo ajustar la imagen.",
      );
      setSubiendo(false);
    }
  };

  const cerrarAjuste = () => {
    if (ajuste) URL.revokeObjectURL(ajuste.previewUrl);
    setAjuste(null);
  };

  const quitar = async () => {
    if (!valorActual) return;
    // Borrado best-effort del binario. La fila de `archivos` queda como
    // histórico; se limpia con el módulo si aplica.
    await import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.storage.from(valorActual.bucket).remove([valorActual.storagePath]),
    );
    onChange(null);
  };

  // ── Render ───────────────────────────────────────────────────────────

  if (ajuste && config.dimensiones) {
    return (
      <PanelAjuste
        ajuste={ajuste}
        dims={config.dimensiones}
        subiendo={subiendo}
        error={error}
        onCancelar={() => {
          cerrarAjuste();
          setError(null);
        }}
        onOffset={(o) => setAjuste({ ...ajuste, offset: o })}
        onConfirmar={confirmarAjuste}
      />
    );
  }

  if (valorActual) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-4">
          <Miniatura
            valor={valorActual}
            previewUrl={previewUrl}
            onVer={verArchivo}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {valorActual.nombre}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {humanTamano(valorActual.tamano)}
              {valorActual.dimensiones && ` · ${valorActual.dimensiones} px`}
            </div>
            {valorActual.ajustado && config.dimensiones && (
              <div className="mt-1 inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                Ajustado a {config.dimensiones.ancho}×{config.dimensiones.alto} px
              </div>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={verArchivo}
                disabled={abriendo}
              >
                {abriendo ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                )}
                Ver
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={descargarArchivo}
                disabled={descargando}
              >
                {descargando ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Descargar
              </Button>
              {!disabled && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={subiendo}
                    onClick={seleccionar}
                  >
                    {subiendo ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Reemplazar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={subiendo}
                    onClick={quitar}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Quitar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={aceptar}
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await procesarArchivo(f);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center",
        disabled && "opacity-60",
      )}
    >
      {subiendo ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      ) : (
        <UploadCloud className="h-6 w-6 text-primary" />
      )}
      <div className="text-sm font-medium text-foreground">
        {subiendo ? "Subiendo…" : "Arrastra o selecciona un archivo"}
      </div>
      <p className="text-xs text-muted-foreground">
        Formatos: {config.formatosPermitidos.join(", ")} · Máx {config.tamanoMaxMB ?? 5} MB
        {config.dimensiones &&
          ` · Se ajustará a ${config.dimensiones.ancho}×${config.dimensiones.alto} px`}
      </p>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <label className="cursor-pointer">
        <input
          ref={inputRef}
          type="file"
          accept={aceptar}
          className="hidden"
          disabled={disabled || subiendo}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await procesarArchivo(f);
          }}
        />
        <span
          className={cn(
            "inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium",
            !disabled && !subiendo && "hover:bg-primary-soft hover:text-primary",
          )}
          onClick={(e) => {
            e.preventDefault();
            seleccionar();
          }}
        >
          Seleccionar archivo
        </span>
      </label>
    </div>
  );
}

function Miniatura({
  valor,
  previewUrl,
  onVer,
}: {
  valor: ValorArchivo;
  previewUrl: string | null;
  onVer: () => void;
}) {
  const esImagen = valor.tipo.startsWith("image/");
  if (esImagen && previewUrl) {
    return (
      <button
        type="button"
        onClick={onVer}
        aria-label="Ver archivo"
        className="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-muted transition hover:border-primary"
      >
        <img
          src={previewUrl}
          alt={valor.nombre}
          className="h-full w-full object-contain"
        />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onVer}
      aria-label="Ver archivo"
      className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <FileText className="h-8 w-8" />
    </button>
  );
}

function PanelAjuste({
  ajuste,
  dims,
  subiendo,
  error,
  onCancelar,
  onOffset,
  onConfirmar,
}: {
  ajuste: AjusteState;
  dims: { ancho: number; alto: number };
  subiendo: boolean;
  error: string | null;
  onCancelar: () => void;
  onOffset: (o: { x: number; y: number }) => void;
  onConfirmar: () => void;
}) {
  // Preview: caja proporcional al target, imagen en modo cover con
  // objectPosition controlado por dos sliders (X, Y).
  const aspecto = dims.ancho / dims.alto;
  const previewW = Math.min(360, dims.ancho);
  const previewH = Math.round(previewW / aspecto);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3">
        <div className="text-sm font-medium text-foreground">
          Ajustar imagen a {dims.ancho}×{dims.alto} px
        </div>
        <p className="text-xs text-muted-foreground">
          La imagen se recortará automáticamente. Mueve los deslizadores para
          reposicionar el encuadre.
        </p>
      </div>
      <div
        className="mx-auto overflow-hidden rounded-lg border border-border bg-muted"
        style={{ width: previewW, height: previewH }}
      >
        <img
          src={ajuste.previewUrl}
          alt="Vista previa"
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${ajuste.offset.x * 100}% ${ajuste.offset.y * 100}%`,
          }}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Horizontal
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ajuste.offset.x}
            onChange={(e) =>
              onOffset({ x: Number(e.target.value), y: ajuste.offset.y })
            }
            className="mt-1 w-full accent-[hsl(var(--primary))]"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Vertical
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ajuste.offset.y}
            onChange={(e) =>
              onOffset({ x: ajuste.offset.x, y: Number(e.target.value) })
            }
            className="mt-1 w-full accent-[hsl(var(--primary))]"
          />
        </label>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancelar}
          disabled={subiendo}
        >
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={onConfirmar} disabled={subiendo}>
          {subiendo && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Confirmar y subir
        </Button>
      </div>
    </div>
  );
}