import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Info, Loader2, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatoFechaHoraCO, formatoFechaPlanaCortaCO } from "@/lib/fechas";
import {
  diasHasta,
  vencimientoBloqueaEdicion,
  type ComportamientoVencimiento,
} from "@/lib/modulo-estado";

// Re-export para compatibilidad: la semántica vive en `modulo-estado.ts`
// (también la usa el server) y aquí solo se consume.
export { vencimientoBloqueaEdicion };

interface Props {
  fechaLimite: string | null;
  comportamiento: ComportamientoVencimiento | null;
  className?: string;
  /**
   * Flujo de extensión (solo aplica con `extension_implementador` vencido):
   * si hay una solicitud pendiente se muestra su fecha; si no y se pasa
   * `onSolicitarExtension`, se ofrece el botón "Solicitar extensión".
   */
  extensionSolicitadaAt?: string | null;
  onSolicitarExtension?: () => void;
  solicitandoExtension?: boolean;
}

function formatoFecha(iso: string) {
  // Fecha plana sin corrimiento de zona (helper centralizado).
  return formatoFechaPlanaCortaCO(iso);
}

export function VencimientoBanner({
  fechaLimite,
  comportamiento,
  className,
  extensionSolicitadaAt,
  onSolicitarExtension,
  solicitandoExtension,
}: Props) {
  if (!fechaLimite) return null;
  const dias = diasHasta(fechaLimite);
  if (dias === null) return null;

  const vencido = dias < 0;
  const proximo = dias >= 0 && dias <= 3;

  // Nada que decir si aún queda tiempo cómodo y no hay comportamiento estricto.
  if (!vencido && !proximo) return null;

  let tono = "bg-slate-50 border-slate-200 text-slate-700";
  let icono = <Info className="h-4 w-4" />;
  let mensaje = "";
  let accion: ReactNode = null;

  if (vencido) {
    switch (comportamiento) {
      case "bloquear":
        tono = "bg-red-50 border-red-200 text-red-800";
        icono = <AlertTriangle className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}. El módulo quedó en solo lectura.`;
        break;
      case "editable_avisar":
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <AlertTriangle className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}, pero aún puedes continuar diligenciando.`;
        break;
      case "extension_implementador":
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <CalendarClock className="h-4 w-4" />;
        if (extensionSolicitadaAt) {
          mensaje = `Extensión solicitada el ${formatoFechaHoraCO(extensionSolicitadaAt)} — tu implementador la está revisando.`;
        } else {
          mensaje =
            "El plazo de este módulo venció. Puedes solicitar una extensión a tu implementador.";
          if (onSolicitarExtension) {
            accion = (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white/70 text-amber-900 hover:bg-white"
                onClick={onSolicitarExtension}
                disabled={solicitandoExtension}
              >
                {solicitandoExtension ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1 h-3.5 w-3.5" />
                )}
                Solicitar extensión
              </Button>
            );
          }
        }
        break;
      case "solo_avisar":
      default:
        tono = "bg-amber-50 border-amber-200 text-amber-800";
        icono = <Info className="h-4 w-4" />;
        mensaje = `El plazo venció el ${formatoFecha(fechaLimite)}.`;
        break;
    }
  } else if (proximo) {
    tono = "bg-blue-50 border-blue-200 text-blue-800";
    icono = <Timer className="h-4 w-4" />;
    mensaje =
      dias === 0
        ? `Hoy es la fecha límite (${formatoFecha(fechaLimite)}).`
        : `Faltan ${dias} día${dias === 1 ? "" : "s"} para el cierre (${formatoFecha(fechaLimite)}).`;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        tono,
        className,
      )}
      role="status"
    >
      <span className="flex flex-1 items-start gap-2">
        <span className="mt-0.5">{icono}</span>
        <span>{mensaje}</span>
      </span>
      {accion}
    </div>
  );
}
