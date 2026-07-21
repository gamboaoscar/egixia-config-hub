import { CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { firmarUrl } from "@/lib/form-engine/archivo";
import type { GuiaCampo, ImagenGuia } from "@/lib/form-engine/tipos";

interface Props {
  label: string;
  guia: GuiaCampo;
}

/**
 * Botón discreto de ayuda junto a la etiqueta de un campo (o al
 * encabezado de una columna de tabla). Abre un Dialog con el título,
 * los textos de guía y las imágenes parametrizadas por el implementador
 * desde el Catálogo. Las imágenes viven en el bucket privado `ayudas` y
 * se firman al abrir el diálogo.
 */
export function BotonAyudaCampo({ label, guia }: Props) {
  const [open, setOpen] = useState(false);
  const titulo = guia.titulo?.trim() ? guia.titulo.trim() : label;
  const imagenes = (guia.imagenes ?? []).filter(
    (img) => !!img && !!img.bucket && !!img.storagePath,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label="Ayuda de este campo"
        onClick={() => setOpen(true)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
      <DialogContent className="max-h-[85vh] gap-3 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="sr-only">
            Ayuda del campo {label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {guia.que?.trim() && (
            <p className="leading-relaxed text-foreground">{guia.que}</p>
          )}

          {guia.formato?.trim() && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Formato
              </div>
              <p className="mt-0.5 text-foreground">{guia.formato}</p>
            </div>
          )}

          {guia.tamano?.trim() && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recomendación
              </div>
              <p className="mt-0.5 inline-block rounded-md bg-primary-soft px-2 py-1 font-medium text-primary">
                {guia.tamano}
              </p>
            </div>
          )}

          {imagenes.length > 0 && <ImagenesAyuda imagenes={imagenes} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Firma y pinta las imágenes de guía a ancho completo, con caption
 * debajo. Mientras firma muestra skeletons; si una imagen no se puede
 * firmar, se omite en silencio.
 */
function ImagenesAyuda({ imagenes }: { imagenes: ImagenGuia[] }) {
  const [urls, setUrls] = useState<Array<string | null> | null>(null);

  useEffect(() => {
    let activo = true;
    void Promise.all(
      imagenes.map((img) =>
        firmarUrl(img.bucket, img.storagePath).catch(() => null),
      ),
    ).then((res) => {
      if (activo) setUrls(res);
    });
    return () => {
      activo = false;
    };
  }, [imagenes]);

  if (!urls) {
    return (
      <div className="space-y-3">
        {imagenes.map((img) => (
          <Skeleton
            key={img.storagePath}
            className="h-40 w-full rounded-lg"
          />
        ))}
      </div>
    );
  }

  const firmadas = imagenes
    .map((img, i) => ({ img, url: urls[i] }))
    .filter((x): x is { img: ImagenGuia; url: string } => !!x.url);
  if (firmadas.length === 0) return null;

  return (
    <div className="space-y-4">
      {firmadas.map(({ img, url }) => (
        <figure key={img.storagePath} className="space-y-1">
          <img
            src={url}
            alt={img.caption || img.nombre || "Imagen de ayuda"}
            className="w-full rounded-lg border border-border bg-muted/30"
            loading="lazy"
          />
          {img.caption?.trim() && (
            <figcaption className="text-xs text-muted-foreground">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
