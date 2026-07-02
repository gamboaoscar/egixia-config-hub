import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GuiaCampo } from "@/lib/form-engine/tipos";

interface Props {
  guia: GuiaCampo;
  campoLabel: string;
}

/**
 * Botón discreto "i" con popover que explica qué ingresar en el campo.
 * La guía nunca se muestra expandida por defecto (evita saturar).
 */
export function CampoInfo({ guia, campoLabel }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ayuda para ${campoLabel}`}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-72 space-y-2 text-sm"
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Qué ingresar
          </div>
          <p className="mt-0.5 text-foreground">{guia.que}</p>
        </div>
        {guia.formato && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Formato
            </div>
            <p className="mt-0.5 text-foreground">{guia.formato}</p>
          </div>
        )}
        {guia.tamano && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tamaño recomendado
            </div>
            <p className="mt-0.5 rounded-md bg-primary-soft px-2 py-1 font-medium text-primary">
              {guia.tamano}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}